begin;

-- L'API de données couvre aussi les RPC SECURITY DEFINER. Storage applique sa propre RLS.
create or replace function public.madic_require_session_mfa()
returns void
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and (auth.jwt()->>'aal') is distinct from 'aal2' then
    raise exception 'MADIC_MFA_REQUIRED' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.madic_require_session_mfa() from public;
grant execute on function public.madic_require_session_mfa() to anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_db_role_setting s
    cross join lateral unnest(s.setconfig) as setting(value)
    where s.setrole = 'authenticator'::regrole
      and s.setdatabase in (0, (select oid from pg_catalog.pg_database where datname = current_database()))
      and setting.value like 'pgrst.db_pre_request=%'
      and setting.value <> 'pgrst.db_pre_request=public.madic_require_session_mfa'
  ) then
    raise exception 'MADIC: intégrer madic_require_session_mfa au hook PostgREST existant avant de poursuivre.';
  end if;
end;
$$;
alter role authenticator set pgrst.db_pre_request to 'public.madic_require_session_mfa';

drop policy if exists madic_session_mfa on storage.objects;
create policy madic_session_mfa on storage.objects as restrictive
for all to authenticated
using ((select auth.jwt()->>'aal') = 'aal2')
with check ((select auth.jwt()->>'aal') = 'aal2');

-- La révocation survit à la suppression du rattachement, même pour les anciennes règles
-- qui autorisent un client d'après son identifiant seulement.
create table if not exists public.madic_cric_client_revocations (
  space_id uuid not null references public.madic_cric_spaces(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  revoked_at timestamptz not null default clock_timestamp(),
  revoked_by uuid references auth.users(id) on delete set null,
  primary key (space_id, client_id)
);
alter table public.madic_cric_client_revocations enable row level security;
revoke all on public.madic_cric_client_revocations from public, anon, authenticated;

create or replace function public.madic_client_space_revoked(p_space_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select from public.madic_cric_client_revocations r
    where r.space_id = p_space_id and r.client_id = (select auth.uid())
  );
$$;
revoke all on function public.madic_client_space_revoked(uuid) from public, anon, authenticated;
grant execute on function public.madic_client_space_revoked(uuid) to authenticated;

create or replace function public.madic_revoke_cric_client(p_space_id uuid, p_client_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  email_to_revoke text;
begin
  if actor is null or actor = p_client_id
     or (auth.jwt()->>'aal') is distinct from 'aal2'
     or public.madic_can_manage_cric_space(p_space_id) is distinct from true then
    raise exception 'Révocation non autorisée' using errcode = '42501';
  end if;
  perform 1 from public.madic_cric_spaces
    where id = p_space_id and owner_user_id = actor and access_status = 'active'
    for update;
  if not found then
    raise exception 'Révocation non autorisée' using errcode = '42501';
  end if;
  if not exists (select from public.madic_cric_clients
                 where space_id = p_space_id and client_id = p_client_id) then
    if exists (select from public.madic_cric_client_revocations
               where space_id = p_space_id and client_id = p_client_id) then
      return true;
    end if;
    raise exception 'Client non rattaché à ce cabinet' using errcode = '42501';
  end if;

  select lower(btrim(email)) into email_to_revoke from auth.users where id = p_client_id;
  insert into public.madic_cric_client_revocations (space_id, client_id, revoked_by)
  values (p_space_id, p_client_id, actor)
  on conflict (space_id, client_id) do update
    set revoked_at = clock_timestamp(), revoked_by = excluded.revoked_by;
  update public.madic_cric_invitations
    set expires_at = least(expires_at, clock_timestamp())
    where space_id = p_space_id and accepted_at is null and invited_email = email_to_revoke;
  -- Refuser une suppression destructive si le schéma déployé diffère du projet.
  if exists (select from pg_catalog.pg_constraint
             where contype = 'f' and confrelid = 'public.madic_cric_clients'::regclass
               and confdeltype in ('c', 'n', 'd')) then
    raise exception 'Un lien de base de données doit être protégé avant la révocation';
  end if;
  delete from public.madic_cric_clients where space_id = p_space_id and client_id = p_client_id;
  update public.madic_client_guest_access set revoked_at = clock_timestamp(), token_hash = null
    where space_id = p_space_id and client_id = p_client_id and revoked_at is null;
  return true;
end;
$$;
revoke all on function public.madic_revoke_cric_client(uuid,uuid) from public, anon, authenticated;
grant execute on function public.madic_revoke_cric_client(uuid,uuid) to authenticated;

-- Une invitation émise après la révocation réactive uniquement le client.
-- Le verrou du cabinet ordonne la réactivation et la révocation concurrentes.
create or replace function public.madic_accept_cric_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  invitation public.madic_cric_invitations%rowtype;
  invitation_hash text;
  cabinet uuid;
  client_email text;
  client uuid := auth.uid();
begin
  if client is null or (auth.jwt()->>'aal') is distinct from 'aal2' then
    raise exception 'Authentification à deux facteurs requise' using errcode = '42501';
  end if;
  select lower(btrim(email)) into client_email from auth.users
    where id = client and email_confirmed_at is not null;
  if client_email is null then raise exception 'Courriel non confirmé'; end if;
  invitation_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select space_id into cabinet from public.madic_cric_invitations where token_hash = invitation_hash;
  if not found then raise exception 'Invitation invalide, expirée ou déjà utilisée'; end if;

  perform 1 from public.madic_cric_spaces
    where id = cabinet and access_status = 'active' for update;
  if not found then raise exception 'Espace professionnel suspendu'; end if;

  select * into invitation from public.madic_cric_invitations where token_hash = invitation_hash for update;
  if not found or invitation.accepted_at is not null or invitation.expires_at <= clock_timestamp()
     or exists (select from public.madic_cric_client_revocations r
                where r.space_id = cabinet and r.client_id = client and r.revoked_at >= invitation.created_at) then
    raise exception 'Invitation invalide, expirée ou déjà utilisée';
  end if;
  if client_email <> invitation.invited_email then raise exception 'Courriel différent du destinataire'; end if;
  delete from public.madic_cric_client_revocations where space_id = cabinet and client_id = client;
  insert into public.madic_cric_clients (space_id, client_id) values (cabinet, client) on conflict do nothing;
  update public.madic_cric_invitations set accepted_at = clock_timestamp(), accepted_by = client
    where id = invitation.id;
  return cabinet;
end;
$$;
revoke all on function public.madic_accept_cric_invitation(text) from public, anon, authenticated;
grant execute on function public.madic_accept_cric_invitation(text) to authenticated;

create or replace function public.madic_reject_revoked_membership()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select from public.madic_cric_client_revocations r
             where r.space_id = new.space_id and r.client_id = new.client_id) then
    raise exception 'Une nouvelle invitation est requise' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.madic_reject_revoked_membership() from public, anon, authenticated;
drop trigger if exists madic_reject_revoked_membership on public.madic_cric_clients;
create trigger madic_reject_revoked_membership
before insert or update of space_id, client_id on public.madic_cric_clients
for each row execute function public.madic_reject_revoked_membership();

-- Incorporer la révocation aux règles permissives existantes, sans élargir leurs droits.
do $$
declare item text;
begin
  foreach item in array array[
    'dossiers', 'madic_initial_contracts', 'madic_client_first_contracts',
    'madic_cric_document_requests', 'madic_cric_conversations', 'madic_cric_appointments',
    'madic_cric_appointment_slots', 'madic_rdv_notifications', 'madic_cric_invoices',
    'madic_cric_deadlines', 'madic_service_request_tracking', 'madic_cric_professional_profiles'
  ] loop
    if pg_catalog.to_regclass(format('public.%I', item)) is null then continue; end if;
    if not (select relrowsecurity from pg_catalog.pg_class
            where oid = pg_catalog.to_regclass(format('public.%I', item))) then
      raise exception 'Activer et vérifier les politiques RLS de % avant la migration', item;
    end if;
    execute format('drop policy if exists madic_client_revocation on public.%I', item);
    execute format('create policy madic_client_revocation on public.%I as restrictive for all to authenticated '
      'using (not public.madic_client_space_revoked(space_id)) '
      'with check (not public.madic_client_space_revoked(space_id))', item);
  end loop;
end;
$$;

create or replace function public.madic_client_dossier_revoked(p_dossier_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select from public.dossiers d
    where d.id = p_dossier_id and public.madic_client_space_revoked(d.space_id)
  );
$$;
revoke all on function public.madic_client_dossier_revoked(uuid) from public, anon, authenticated;
grant execute on function public.madic_client_dossier_revoked(uuid) to authenticated;

drop policy if exists madic_client_revocation on public.documents;
create policy madic_client_revocation on public.documents as restrictive for all to authenticated
using (not public.madic_client_dossier_revoked(dossier_id))
with check (not public.madic_client_dossier_revoked(dossier_id));

do $$
begin
  if pg_catalog.to_regclass('public.madic_contracts') is not null then
    if not (select relrowsecurity from pg_catalog.pg_class
            where oid = 'public.madic_contracts'::regclass) then
      raise exception 'Activer et vérifier les politiques RLS des contrats historiques';
    end if;
    drop policy if exists madic_client_revocation on public.madic_contracts;
    create policy madic_client_revocation on public.madic_contracts as restrictive
    for all to authenticated
    using (not public.madic_client_dossier_revoked(dossier_id))
    with check (not public.madic_client_dossier_revoked(dossier_id));
  end if;
end;
$$;

-- Les pièces jointes avaient une règle de lecture distincte de celle des conversations.
create or replace function public.madic_can_access_message_conversation(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select from public.madic_cric_conversations c
    where c.id = p_conversation_id
      and not public.madic_client_space_revoked(c.space_id)
      and (c.client_id = (select auth.uid()) or public.madic_can_manage_cric_space(c.space_id))
  );
$$;
revoke all on function public.madic_can_access_message_conversation(uuid) from public, anon;
grant execute on function public.madic_can_access_message_conversation(uuid) to authenticated;

create or replace function public.madic_client_storage_revoked(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case when p_bucket = 'madic-documents' then
    exists (select from public.madic_cric_client_revocations r
      where r.client_id = (select auth.uid()) and (
        exists (select from public.dossiers d where d.space_id = r.space_id
          and d.client_id = r.client_id and d.id::text = split_part(p_name, '/', 2)
          and split_part(p_name, '/', 1) = r.client_id::text)
        or exists (select from public.madic_initial_contracts c
          where c.space_id = r.space_id and c.client_id = r.client_id
          and split_part(p_name, '/', 1) in ('contrats-signes', 'contrats-client-cric')
          and split_part(p_name, '/', 2) = r.client_id::text
          and split_part(p_name, '/', 3) = c.id::text || '.pdf')
        or exists (select from public.documents f join public.dossiers d on d.id = f.dossier_id
          where f.storage_path = p_name and d.space_id = r.space_id and f.client_id = r.client_id)
      ))
    when p_bucket = 'madic-message-attachments' then
      exists (select from public.madic_cric_conversations c
        where c.id::text = split_part(p_name, '/', 1) and public.madic_client_space_revoked(c.space_id))
    else false end;
$$;
revoke all on function public.madic_client_storage_revoked(text,text) from public, anon, authenticated;
grant execute on function public.madic_client_storage_revoked(text,text) to authenticated;

drop policy if exists madic_client_revocation on storage.objects;
create policy madic_client_revocation on storage.objects as restrictive for all to authenticated
using (not public.madic_client_storage_revoked(bucket_id, name))
with check (not public.madic_client_storage_revoked(bucket_id, name));

-- Ces écritures peuvent venir de RPC SECURITY DEFINER qui ne passent pas par la RLS.
create or replace function public.madic_block_revoked_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (case when tg_table_name in ('documents', 'madic_contracts') then
    public.madic_client_dossier_revoked((to_jsonb(new)->>'dossier_id')::uuid)
  else
    public.madic_client_space_revoked((to_jsonb(new)->>'space_id')::uuid)
  end) then
    raise exception 'Accès au cabinet révoqué' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.madic_block_revoked_write() from public, anon, authenticated;

drop trigger if exists madic_block_revoked_write on public.madic_initial_contracts;
create trigger madic_block_revoked_write before insert or update on public.madic_initial_contracts
for each row execute function public.madic_block_revoked_write();
drop trigger if exists madic_block_revoked_write on public.documents;
create trigger madic_block_revoked_write before insert or update on public.documents
for each row execute function public.madic_block_revoked_write();

do $$
declare item text;
begin
  foreach item in array array['madic_contracts', 'madic_rdv_notifications'] loop
    if pg_catalog.to_regclass(format('public.%I', item)) is not null then
      execute format('drop trigger if exists madic_block_revoked_write on public.%I', item);
      execute format('create trigger madic_block_revoked_write before insert or update on public.%I '
        'for each row execute function public.madic_block_revoked_write()', item);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
commit;
