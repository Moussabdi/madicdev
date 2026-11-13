-- MADIC: suivi des demandes, par cabinet, sans modifier les demandes existantes.
create table if not exists public.madic_service_request_tracking (
  space_id uuid not null references public.madic_cric_spaces(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'received' check (status in ('received','reviewing','responded','closed')),
  updated_at timestamptz not null default now(),
  primary key (space_id, client_id)
);
alter table public.madic_service_request_tracking enable row level security;
revoke all on public.madic_service_request_tracking from public, anon, authenticated;

-- Un CRIC ne lit que les clients lies a son cabinet actif et autorise.
create or replace function public.madic_service_requests_for_cric(p_space_id uuid)
returns table(client_id uuid, client_name text, service_type text, request_updated_at timestamptz, request_status text, tracking_updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or not coalesce(public.madic_can_manage_cric_space(p_space_id),false)
    or not exists (select 1 from public.madic_cric_spaces s where s.id=p_space_id and s.access_status='active') then
   raise exception 'Acces CRIC non autorise' using errcode='42501';
 end if;
 return query
 select r.user_id,
   coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),'Client')::text,
   r.service_type,r.updated_at,coalesce(t.status,'received')::text,t.updated_at
 from public.madic_initial_service_requests r
 join public.madic_cric_clients c on c.client_id=r.user_id and c.space_id=p_space_id
 left join public.profiles p on p.id=r.user_id
 left join public.madic_service_request_tracking t on t.client_id=r.user_id and t.space_id=p_space_id
 order by r.updated_at desc;
end $$;

create or replace function public.madic_service_set_status(p_space_id uuid,p_client_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if p_status not in ('received','reviewing','responded','closed') then
   raise exception 'Statut invalide';
 end if;
 if auth.uid() is null or not coalesce(public.madic_can_manage_cric_space(p_space_id),false)
   or not exists (select 1 from public.madic_cric_spaces s where s.id=p_space_id and s.access_status='active')
   or not exists (select 1 from public.madic_cric_clients c where c.space_id=p_space_id and c.client_id=p_client_id)
   or not exists (select 1 from public.madic_initial_service_requests r where r.user_id=p_client_id) then
   raise exception 'Demande non autorisee ou introuvable' using errcode='42501';
 end if;
 insert into public.madic_service_request_tracking(space_id,client_id,status,updated_at)
 values(p_space_id,p_client_id,p_status,now())
 on conflict(space_id,client_id) do update set status=excluded.status,updated_at=now();
 return true;
end $$;

create or replace function public.madic_service_my_progress(p_space_id uuid)
returns table(service_type text, request_status text, request_updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists (
  select 1 from public.madic_cric_clients c
  join public.madic_cric_spaces s on s.id=c.space_id
  where c.client_id=auth.uid() and c.space_id=p_space_id and s.access_status='active'
 ) then raise exception 'Cabinet non autorise' using errcode='42501'; end if;
 return query select r.service_type,coalesce(t.status,'received')::text,r.updated_at
 from public.madic_initial_service_requests r
 left join public.madic_service_request_tracking t on t.client_id=r.user_id and t.space_id=p_space_id
 where r.user_id=auth.uid();
end $$;

revoke all on function public.madic_service_requests_for_cric(uuid) from public, anon;
revoke all on function public.madic_service_set_status(uuid,uuid,text) from public, anon;
revoke all on function public.madic_service_my_progress(uuid) from public, anon;
grant execute on function public.madic_service_requests_for_cric(uuid) to authenticated;
grant execute on function public.madic_service_set_status(uuid,uuid,text) to authenticated;
grant execute on function public.madic_service_my_progress(uuid) to authenticated;
