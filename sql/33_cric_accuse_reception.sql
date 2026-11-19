begin;

create table if not exists public.madic_cric_receipt_email_queue (
  id uuid primary key default gen_random_uuid(),
  prevalidation_id uuid not null unique references public.madic_cric_prevalidations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists madic_cric_receipt_email_ready_idx
  on public.madic_cric_receipt_email_queue (status, next_attempt_at, created_at)
  where status in ('pending', 'processing');

alter table public.madic_cric_receipt_email_queue enable row level security;
revoke all on public.madic_cric_receipt_email_queue from public, anon, authenticated;
grant select, update on public.madic_cric_receipt_email_queue to service_role;

create or replace function public.madic_queue_cric_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.madic_cric_receipt_email_queue (prevalidation_id)
  values (new.id)
  on conflict (prevalidation_id) do nothing;
  return new;
end;
$$;

revoke all on function public.madic_queue_cric_receipt() from public, anon, authenticated;

drop trigger if exists madic_queue_cric_receipt on public.madic_cric_prevalidations;
create trigger madic_queue_cric_receipt
after update of professional_email on public.madic_cric_prevalidations
for each row
when (
  old.professional_email is null
  and new.professional_email is not null
  and new.professional_phone is not null
  and new.professional_address is not null
  and new.registry_verified is true
  and new.status = 'pending'
)
execute function public.madic_queue_cric_receipt();

create or replace function public.madic_claim_cric_receipt_emails(p_limit integer default 20)
returns table (id uuid, attempts integer, recipient_email text)
language sql
security definer
set search_path = ''
as $$
  with picked as (
    select q.id
    from public.madic_cric_receipt_email_queue q
    where (q.status = 'pending' and q.next_attempt_at <= now())
       or (q.status = 'processing' and q.locked_at < now() - interval '15 minutes')
    order by q.created_at
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
    for update skip locked
  ), claimed as (
    update public.madic_cric_receipt_email_queue q
    set status = 'processing', locked_at = now(), attempts = q.attempts + 1
    from picked
    where q.id = picked.id
    returning q.id, q.attempts, q.prevalidation_id
  )
  select c.id, c.attempts, p.professional_email
  from claimed c
  join public.madic_cric_prevalidations p on p.id = c.prevalidation_id;
$$;

revoke all on function public.madic_claim_cric_receipt_emails(integer) from public, anon, authenticated;
grant execute on function public.madic_claim_cric_receipt_emails(integer) to service_role;

commit;
