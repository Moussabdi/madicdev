-- Exécuter dans Supabase SQL Editor après vérification du schéma existant.
-- Un jeton d'invitation n'est jamais stocké en clair.
create extension if not exists pgcrypto;
create table if not exists public.madic_cric_invitations (
 id uuid primary key default gen_random_uuid(),
 space_id uuid not null references public.madic_cric_spaces(id) on delete cascade,
 invited_email text not null,
 token_hash text not null unique,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '7 days'),
 accepted_at timestamptz,
 accepted_by uuid references auth.users(id)
);
create index if not exists madic_cric_invitations_space_idx on public.madic_cric_invitations(space_id);
alter table public.madic_cric_invitations enable row level security;
revoke all on public.madic_cric_invitations from anon, authenticated;

create or replace function public.madic_create_cric_invitation(p_space_id uuid,p_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text; v_email text := lower(btrim(p_email));
begin
 if auth.uid() is null or public.madic_can_manage_cric_space(p_space_id) is distinct from true then
  raise exception 'Accès non autorisé';
 end if;
 if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Courriel invalide'; end if;
 if not exists(select 1 from public.madic_cric_spaces where id=p_space_id and access_status='active') then
  raise exception 'Espace CRIC inactif';
 end if;
 v_token := encode(extensions.gen_random_bytes(32),'hex');
 insert into public.madic_cric_invitations(space_id,invited_email,token_hash,created_by)
 values(p_space_id,v_email,encode(extensions.digest(v_token,'sha256'),'hex'),auth.uid());
 return v_token;
end $$;

create or replace function public.madic_accept_cric_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.madic_cric_invitations%rowtype; v_email text; v_uid uuid := auth.uid();
begin
 if v_uid is null then raise exception 'Connexion requise'; end if;
 select lower(email) into v_email from auth.users where id=v_uid and email_confirmed_at is not null;
 if v_email is null then raise exception 'Courriel non confirmé'; end if;
 select * into v_inv from public.madic_cric_invitations
 where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found or v_inv.accepted_at is not null or v_inv.expires_at <= now() then
  raise exception 'Invitation invalide, expirée ou déjà utilisée';
 end if;
 if v_email <> v_inv.invited_email then raise exception 'Courriel différent du destinataire'; end if;
 if not exists(select 1 from public.madic_cric_spaces where id=v_inv.space_id and access_status='active') then
  raise exception 'Espace professionnel suspendu';
 end if;
 insert into public.madic_cric_clients(space_id,client_id)
 values(v_inv.space_id,v_uid) on conflict do nothing;
 update public.madic_cric_invitations set accepted_at=now(),accepted_by=v_uid where id=v_inv.id;
 return v_inv.space_id;
end $$;

create or replace function public.madic_my_cric_client_spaces()
returns table(space_id uuid,space_name text)
language sql stable security definer set search_path = '' as $$
 select s.id,s.name::text from public.madic_cric_clients c
 join public.madic_cric_spaces s on s.id=c.space_id
 where c.client_id=auth.uid() and s.access_status='active'
 order by s.name;
$$;
revoke all on function public.madic_create_cric_invitation(uuid,text) from public,anon;
revoke all on function public.madic_accept_cric_invitation(text) from public,anon;
revoke all on function public.madic_my_cric_client_spaces() from public,anon;
grant execute on function public.madic_create_cric_invitation(uuid,text) to authenticated;
grant execute on function public.madic_accept_cric_invitation(text) to authenticated;
grant execute on function public.madic_my_cric_client_spaces() to authenticated;

-- À contrôler avant déploiement : les politiques SELECT de dossiers et documents
-- doivent aussi vérifier l'appartenance (space_id, client_id) pour les clients CRIC.
