-- A executer apres madic_service_tracking.sql.
-- Lecture du statut d'un contrat initial reservee au CRIC du cabinet concerne.
create or replace function public.madic_service_contract_state(p_space_id uuid,p_client_id uuid)
returns table(contract_status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null
     or not coalesce(public.madic_can_manage_cric_space(p_space_id),false)
     or not exists (select 1 from public.madic_cric_spaces s where s.id=p_space_id and s.access_status='active')
     or not exists (select 1 from public.madic_cric_clients c where c.space_id=p_space_id and c.client_id=p_client_id)
  then
    raise exception 'Acces non autorise' using errcode='42501';
  end if;
  return query
  select ic.status::text
  from public.madic_initial_contracts ic
  where ic.space_id=p_space_id and ic.client_id=p_client_id
    and ic.status in ('publie','signe')
  order by ic.created_at desc limit 1;
end $$;
revoke all on function public.madic_service_contract_state(uuid,uuid) from public,anon;
grant execute on function public.madic_service_contract_state(uuid,uuid) to authenticated;
