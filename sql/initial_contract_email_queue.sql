-- MADIC - Notifications par courriel pour les contrats de consultation initiale.
-- Migration additive : ne modifie ni les signatures ni les documents.
-- A appliquer dans Supabase SQL Editor, puis deployer le worker associe.

create table if not exists public.madic_initial_contract_email_queue (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.madic_initial_contracts(id) on delete cascade,
  recipient_user_id uuid not null,
  event_type text not null check (event_type in ('client_to_sign','client_signed')),
  status text not null default 'pending' check (status in ('pending','processing','sent','skipped','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique(contract_id,event_type,recipient_user_id)
);

create index if not exists madic_initial_contract_email_due_idx
 on public.madic_initial_contract_email_queue(status,next_attempt_at);
alter table public.madic_initial_contract_email_queue enable row level security;
revoke all on public.madic_initial_contract_email_queue from public, anon, authenticated;

create or replace function public.madic_initial_contract_email_enqueue()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select s.owner_user_id into v_owner from public.madic_cric_spaces s where s.id = new.space_id;
  if new.status = 'publie' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.madic_initial_contract_email_queue(contract_id,recipient_user_id,event_type)
    values(new.id,new.client_id,'client_to_sign') on conflict do nothing;
  elsif new.status = 'signe' and (tg_op = 'INSERT' or old.status is distinct from new.status) and v_owner is not null then
    insert into public.madic_initial_contract_email_queue(contract_id,recipient_user_id,event_type)
    values(new.id,v_owner,'client_signed') on conflict do nothing;
  end if;
  return new;
end; $$;
revoke all on function public.madic_initial_contract_email_enqueue() from public, anon, authenticated;
drop trigger if exists madic_initial_contract_email_enqueue_trg on public.madic_initial_contracts;
create trigger madic_initial_contract_email_enqueue_trg
 after insert or update of status on public.madic_initial_contracts
 for each row execute function public.madic_initial_contract_email_enqueue();

-- Réservation atomique des courriels par le worker (service_role uniquement).
create or replace function public.madic_initial_contract_email_claim(p_limit integer default 20)
returns table(id uuid, contract_id uuid, recipient_user_id uuid, event_type text, attempts integer)
language plpgsql security definer set search_path = '' as $$
begin
 if auth.role() <> 'service_role' then raise exception 'Accès refusé'; end if;
 return query
 with due as (
  select q.id from public.madic_initial_contract_email_queue q
  where (q.status='pending' and q.next_attempt_at <= now())
     or (q.status='processing' and q.locked_at < now()-interval '15 minutes')
  order by q.created_at
  for update skip locked
  limit least(greatest(p_limit,1),50)
 ), updated as (
  update public.madic_initial_contract_email_queue q
  set status='processing',locked_at=now(),attempts=q.attempts+1
  from due where q.id=due.id
  returning q.id,q.contract_id,q.recipient_user_id,q.event_type,q.attempts
 ) select u.id,u.contract_id,u.recipient_user_id,u.event_type,u.attempts from updated u;
end; $$;
revoke all on function public.madic_initial_contract_email_claim(integer) from public, anon, authenticated;
grant execute on function public.madic_initial_contract_email_claim(integer) to service_role;

-- Correction de la structure existante : aucun nouvel objet de stockage.
-- Les deux parties recoivent les evenements correspondant aux transitions reelles.
alter table public.madic_initial_contract_email_queue
  drop constraint if exists madic_initial_contract_email_queue_event_type_check;
alter table public.madic_initial_contract_email_queue
  add constraint madic_initial_contract_email_queue_event_type_check
  check (event_type in ('client_to_sign','client_signed'));

create or replace function public.madic_initial_contract_email_enqueue()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select s.owner_user_id into v_owner from public.madic_cric_spaces s where s.id = new.space_id;
  if new.status = 'publie' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.madic_initial_contract_email_queue(contract_id,recipient_user_id,event_type)
    select new.id, r, 'client_to_sign' from unnest(array[new.client_id,v_owner]) r
    where r is not null on conflict do nothing;
  elsif new.status = 'signe' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.madic_initial_contract_email_queue(contract_id,recipient_user_id,event_type)
    select new.id, r, 'client_signed' from unnest(array[new.client_id,v_owner]) r
    where r is not null on conflict do nothing;
  end if;
  return new;
end; $$;

-- Autoriser uniquement le service_role a traiter la file.
grant usage on schema public to service_role;
grant select, update on public.madic_initial_contract_email_queue to service_role;
grant select on public.madic_initial_contracts, public.madic_cric_spaces to service_role;
grant execute on function public.madic_initial_contract_email_claim(integer) to service_role;

-- Recuperer les evenements non envoyes des contrats actuellement publies/signés.
insert into public.madic_initial_contract_email_queue(contract_id,recipient_user_id,event_type)
select c.id, r.recipient_id, e.event_type
from public.madic_initial_contracts c
join public.madic_cric_spaces s on s.id=c.space_id
cross join lateral (values(c.client_id),(s.owner_user_id)) r(recipient_id)
cross join lateral (values('client_to_sign'),('client_signed')) e(event_type)
where r.recipient_id is not null
and ((e.event_type='client_to_sign' and c.status='publie')
  or (e.event_type='client_signed' and c.status='signe'))
on conflict do nothing;
