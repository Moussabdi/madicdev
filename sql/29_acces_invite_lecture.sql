begin;

create table if not exists public.madic_client_guest_access (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.madic_cric_spaces(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token_hash text unique,
  user_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  unique (space_id, client_id)
);
create index if not exists madic_client_guest_user on public.madic_client_guest_access(user_id);
alter table public.madic_client_guest_access enable row level security;
revoke all on public.madic_client_guest_access from public, anon, authenticated;

create or replace function public.madic_guest_unlink()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.space_id = new.space_id and old.client_id = new.client_id then return null; end if;
  end if;
  update public.madic_client_guest_access set revoked_at = now(), token_hash = null
  where space_id = old.space_id and client_id = old.client_id and revoked_at is null;
  return null;
end $$;

revoke all on function public.madic_guest_unlink() from public, anon, authenticated;
drop trigger if exists madic_guest_unlink on public.madic_cric_clients;
create trigger madic_guest_unlink after delete or update of space_id, client_id on public.madic_cric_clients
for each row execute function public.madic_guest_unlink();

create or replace function public.madic_guest_check_manager(p_space uuid, p_client uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(public.madic_can_manage_cric_space(p_space), false)
     or not exists (
       select from public.madic_cric_clients c
       join public.madic_cric_spaces s on s.id = c.space_id
       where c.space_id = p_space and c.client_id = p_client and s.access_status = 'active'
     ) then
    raise exception 'Guest management denied' using errcode = '42501';
  end if;
end $$;

create or replace function public.madic_guest_manage(p_space uuid, p_client uuid, p_revoke uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare guest public.madic_client_guest_access;
begin
  perform public.madic_guest_check_manager(p_space, p_client);
  if p_revoke is not null then
    update public.madic_client_guest_access
    set revoked_at = now(), token_hash = null
    where space_id = p_space and client_id = p_client and id = p_revoke and revoked_at is null;
  end if;
  select * into guest from public.madic_client_guest_access where space_id = p_space and client_id = p_client;
  if not found then return null; end if;
  return jsonb_build_object('id', guest.id, 'email', guest.email, 'expires', guest.expires_at,
    'status', case when guest.revoked_at is not null then 'revoked'
                   when guest.accepted_at is not null then 'active'
                   when guest.expires_at <= now() then 'expired'
                   else 'pending' end);
end $$;

create or replace function public.madic_guest_create(p_space uuid, p_client uuid, p_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  address text := lower(btrim(p_email));
  secret text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  perform public.madic_guest_check_manager(p_space, p_client);
  if address is null or length(address) > 254 or address !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or address = (select lower(email) from auth.users where id = p_client)
     or address = (select lower(email) from auth.users where id = auth.uid()) then
    raise exception 'A separate email is required' using errcode = '22023';
  end if;
  insert into public.madic_client_guest_access as g (space_id, client_id, email, token_hash, expires_at)
  values (p_space, p_client, address, encode(extensions.digest(secret, 'sha256'), 'hex'), now() + interval '7 days')
  on conflict (space_id, client_id) do update
    set id = excluded.id, email = excluded.email, token_hash = excluded.token_hash,
        expires_at = excluded.expires_at, accepted_at = null, revoked_at = null, user_id = null
    where g.revoked_at is not null or (g.accepted_at is null and g.expires_at <= now());
  if not found then raise exception 'Revoke the existing invitation or access first' using errcode = '23505'; end if;
  return secret;
end $$;

create or replace function public.madic_guest_accept(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare grant_id uuid;
begin
  if auth.uid() is null or p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Guest invitation unavailable' using errcode = '42501';
  end if;
  update public.madic_client_guest_access g
  set token_hash = null, accepted_at = now(), user_id = auth.uid()
  where g.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and g.expires_at > now() and g.revoked_at is null and g.accepted_at is null
    and g.client_id <> auth.uid()
    and exists (select from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null and lower(u.email) = g.email)
    and exists (
      select from public.madic_cric_clients c join public.madic_cric_spaces s on s.id = c.space_id
      where c.space_id = g.space_id and c.client_id = g.client_id and s.access_status = 'active'
    )
  returning g.id into grant_id;
  if not found then raise exception 'Guest invitation unavailable' using errcode = '42501'; end if;
  return grant_id;
end $$;

create or replace function public.madic_guest_grants()
returns table(grant_id uuid, cabinet text, client_name text, space_id uuid, client_id uuid)
language sql stable security definer set search_path = '' as $$
  select g.id, s.name::text, coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), nullif(p.email, ''), a.email), g.space_id, g.client_id
  from public.madic_client_guest_access g
  join public.madic_cric_spaces s on s.id = g.space_id and s.access_status = 'active'
  join auth.users u on u.id = g.user_id and u.email_confirmed_at is not null and lower(u.email) = g.email
  join public.profiles p on p.id = g.client_id
  join auth.users a on a.id = g.client_id
  where g.user_id = (select auth.uid()) and g.accepted_at is not null and g.revoked_at is null
    and exists (select from public.madic_cric_clients c where c.space_id = g.space_id and c.client_id = g.client_id);
$$;

create or replace function public.madic_guest_list()
returns table(grant_id uuid, cabinet text, client_name text)
language sql stable security definer set search_path = '' as $$
  select g.grant_id, g.cabinet, g.client_name from public.madic_guest_grants() g order by g.client_name, g.cabinet;
$$;

create or replace function public.madic_guest_read(p_grant uuid, p_section text, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  g record;
  rows jsonb;
  page_offset integer := greatest(0, p_offset);
  section_name text := split_part(p_section, ':', 1);
  conversation_filter text := nullif(split_part(p_section, ':', 2), '');
begin
  select * into g from public.madic_guest_grants() a where a.grant_id = p_grant;
  if not found then raise exception 'Guest access unavailable' using errcode = '42501'; end if;
  if conversation_filter is not null and section_name not in ('messages', 'attachments') then
    raise exception 'Unknown guest section' using errcode = '22023';
  end if;
  case section_name
    when 'profile' then
      return (select jsonb_build_object('name', g.client_name, 'first_name', p.first_name, 'last_name', p.last_name, 'email', p.email, 'phone', p.phone, 'country', p.country,
                'gender', to_jsonb(p)->'gender', 'date_of_birth', to_jsonb(p)->'date_of_birth',
                'address_number', to_jsonb(p)->'address_number', 'address_street', to_jsonb(p)->'address_street',
                'address_apartment', to_jsonb(p)->'address_apartment', 'address_city', to_jsonb(p)->'address_city',
                'address_region', to_jsonb(p)->'address_region', 'address_postal_code', to_jsonb(p)->'address_postal_code',
                'ircc_application_category', to_jsonb(p)->'ircc_application_category',
                'ircc_application_type', to_jsonb(p)->'ircc_application_type',
                'ircc_followup_answer', to_jsonb(p)->'ircc_followup_answer',
                'file', case when split_part(u.raw_user_meta_data->>'madic_avatar_path','/',1) = p.id::text
                             then u.raw_user_meta_data->>'madic_avatar_path' end,
                'bucket', 'madic-profile-avatars')
              from public.profiles p join auth.users u on u.id = p.id where p.id = g.client_id);
    when 'intake' then
      return (select i.answers from public.madic_client_intake i where i.user_id = g.client_id limit 1);
    when 'dossiers' then
      select jsonb_agg(to_jsonb(x)) into rows from (
        select d.reference, d.category, d.status, d.created_at
        from public.dossiers d where d.space_id = g.space_id and d.client_id = g.client_id
        order by d.created_at desc, d.id desc limit 26 offset page_offset
      ) x;
    when 'requests' then
      select jsonb_agg(to_jsonb(x)) into rows from (
        select d.reference, r.title, r.instructions, r.status, r.due_on
        from public.madic_cric_document_requests r
        join public.dossiers d on d.id = r.dossier_id and d.space_id = r.space_id and d.client_id = r.client_id
        where r.space_id = g.space_id and r.client_id = g.client_id
        order by r.created_at desc, r.id desc limit 26 offset page_offset
      ) x;
    when 'documents' then
      select jsonb_agg(to_jsonb(x)) into rows from (
        select d.reference, f.original_name, f.status, f.created_at, f.storage_path as file,
               to_jsonb(f)->>'review_status' as review_status, to_jsonb(f)->>'review_reason' as review_reason,
               'madic-documents' as bucket
        from public.documents f join public.dossiers d on d.id = f.dossier_id and d.client_id = f.client_id
        where d.space_id = g.space_id and f.client_id = g.client_id
        order by f.created_at desc, f.id desc limit 26 offset page_offset
      ) x;
    when 'appointments' then
      select jsonb_agg(to_jsonb(x)) into rows from (
        select s.starts_at, s.ends_at, s.mode, a.status,
               case when a.status = 'confirmed' then s.location_info end as location_info
        from public.madic_cric_appointments a
        join public.madic_cric_appointment_slots s on s.id = a.slot_id and s.space_id = a.space_id
        where a.space_id = g.space_id and a.client_id = g.client_id
        order by s.starts_at desc, a.id desc limit 26 offset page_offset
      ) x;
    when 'conversations' then
      select jsonb_agg(to_jsonb(x)) into rows from (
        select c.id as conversation_id, c.subject, c.created_at
        from public.madic_cric_conversations c
        where c.space_id = g.space_id and c.client_id = g.client_id
        order by c.created_at desc, c.id desc limit 26 offset page_offset
      ) x;
    when 'messages' then
      select jsonb_agg(to_jsonb(x)) into rows from (
        select c.id as conversation_id, c.subject, m.body, m.created_at,
               case when m.sender_id = g.client_id then 'client' else 'cabinet' end as sender
        from public.madic_cric_messages m join public.madic_cric_conversations c on c.id = m.conversation_id
        where c.space_id = g.space_id and c.client_id = g.client_id
          and (conversation_filter is null or c.id::text = conversation_filter)
        order by m.created_at desc, m.id desc limit 26 offset page_offset
      ) x;
    when 'attachments' then
      select jsonb_agg(to_jsonb(x)) into rows from (
        select c.id as conversation_id, c.subject, a.filename, a.created_at, a.storage_path as file, 'madic-message-attachments' as bucket
        from public.madic_cric_message_attachments a
        join public.madic_cric_conversations c on c.id = a.conversation_id
        where c.space_id = g.space_id and c.client_id = g.client_id
          and (conversation_filter is null or c.id::text = conversation_filter)
        order by a.created_at desc, a.id desc limit 26 offset page_offset
      ) x;
    when 'invoices' then
      select jsonb_agg(to_jsonb(x)) into rows from (
        select i.invoice_number, i.description, i.issued_on, i.due_on, i.items, i.notes, i.currency,
               round(i.amount_cents * (1 + i.tax_rate))::bigint as total_cents, i.paid_cents,
               round(i.amount_cents * (1 + i.tax_rate))::bigint - i.paid_cents as balance_cents
        from public.madic_cric_invoices i where i.space_id = g.space_id and i.client_id = g.client_id and i.status = 'issued'
        order by i.issued_on desc, i.id desc limit 26 offset page_offset
      ) x;
    when 'contracts' then
      select jsonb_agg(to_jsonb(x)) into rows from (
        select d.reference, c.status, c.created_at, c.client_signed_at, c.id as contract_id,
               case c.status when 'signe' then 'contrats-signes/' || c.client_id || '/' || c.id || '.pdf'
               when 'deux_signatures' then 'contrats-client-cric/' || c.client_id || '/' || c.id || '.pdf' end as file,
               'madic-documents' as bucket
        from public.madic_initial_contracts c
        left join public.dossiers d on d.id = c.dossier_id and d.space_id = c.space_id and d.client_id = c.client_id
        where c.space_id = g.space_id and c.client_id = g.client_id
          and c.status in ('publie', 'signe', 'client_signe', 'deux_signatures')
        order by c.created_at desc, c.id desc limit 26 offset page_offset
      ) x;
    when 'legacy_contracts' then
      select jsonb_agg(to_jsonb(x)) into rows from (
        select d.reference, c.title, c.status, c.published_at, c.signed_at, c.contract_id
        from (select id as contract_id, dossier_id, client_id, title, status, published_at, signed_at
              from public.madic_contracts where status in ('publie', 'signe')) c
        join public.dossiers d on d.id = c.dossier_id and d.client_id = c.client_id
        where d.space_id = g.space_id and c.client_id = g.client_id
        order by c.published_at desc, c.contract_id desc limit 26 offset page_offset
      ) x;
    when 'service' then
      return (select jsonb_build_object('service_type', r.service_type, 'status', coalesce(t.status, 'received'), 'updated_at', r.updated_at)
        from public.madic_initial_service_requests r
        left join public.madic_service_request_tracking t on t.client_id = r.user_id and t.space_id = g.space_id
        where r.user_id = g.client_id);
    else raise exception 'Unknown guest section' using errcode = '22023';
  end case;
  return coalesce(rows, '[]'::jsonb);
end $$;

create or replace function public.madic_guest_contract(p_grant uuid, p_contract uuid)
returns text language sql stable security definer set search_path = '' as $$
  select c.document_snapshot->>'html'
  from public.madic_guest_grants() g join public.madic_initial_contracts c
    on c.space_id = g.space_id and c.client_id = g.client_id
  where g.grant_id = p_grant and c.id = p_contract and c.status in ('publie', 'signe', 'client_signe', 'deux_signatures');
$$;

create or replace function public.madic_guest_legacy_contract(p_grant uuid, p_contract uuid)
returns text language sql stable security definer set search_path = '' as $$
  select c.body_snapshot from public.madic_guest_grants() g
  join public.dossiers d on d.space_id = g.space_id and d.client_id = g.client_id
  join public.madic_contracts c on c.dossier_id = d.id and c.client_id = d.client_id
  where g.grant_id = p_grant and c.id = p_contract and c.status in ('publie', 'signe');
$$;

create or replace function public.madic_guest_file(p_grant uuid, p_bucket text, p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select from public.madic_guest_grants() g where g.grant_id = p_grant and (
      (p_bucket = 'madic-documents' and (
        exists (select from public.documents f join public.dossiers d on d.id = f.dossier_id and d.client_id = f.client_id
                where d.space_id = g.space_id and f.client_id = g.client_id and f.storage_path = p_path
                  and split_part(f.storage_path, '/', 1) = g.client_id::text and split_part(f.storage_path, '/', 2) = d.id::text)
        or exists (select from public.madic_initial_contracts c where c.space_id = g.space_id and c.client_id = g.client_id
                   and ((c.status = 'signe' and p_path = 'contrats-signes/' || c.client_id || '/' || c.id || '.pdf')
                        or (c.status = 'deux_signatures' and p_path = 'contrats-client-cric/' || c.client_id || '/' || c.id || '.pdf')))
      ))
      or (p_bucket = 'madic-profile-avatars' and split_part(p_path, '/', 1) = g.client_id::text
          and exists (select from auth.users u where u.id = g.client_id and u.raw_user_meta_data->>'madic_avatar_path' = p_path))
      or (p_bucket = 'madic-message-attachments' and exists (
        select from public.madic_cric_message_attachments f
        join public.madic_cric_conversations c on c.id = f.conversation_id
        where c.space_id = g.space_id and c.client_id = g.client_id and f.storage_path = p_path
          and split_part(f.storage_path, '/', 1) = c.id::text
      ))
    )
  );
$$;

revoke all on function public.madic_guest_check_manager(uuid,uuid), public.madic_guest_grants() from public, anon, authenticated;
revoke all on function public.madic_guest_manage(uuid,uuid,uuid), public.madic_guest_create(uuid,uuid,text),
  public.madic_guest_accept(text), public.madic_guest_list(), public.madic_guest_read(uuid,text,integer),
  public.madic_guest_contract(uuid,uuid), public.madic_guest_legacy_contract(uuid,uuid),
  public.madic_guest_file(uuid,text,text) from public, anon, authenticated;
grant execute on function public.madic_guest_manage(uuid,uuid,uuid), public.madic_guest_create(uuid,uuid,text),
  public.madic_guest_accept(text), public.madic_guest_list(), public.madic_guest_read(uuid,text,integer),
  public.madic_guest_contract(uuid,uuid), public.madic_guest_legacy_contract(uuid,uuid),
  public.madic_guest_file(uuid,text,text) to authenticated;

commit;
