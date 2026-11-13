-- MADIC 6.2 - a executer APRES le module 6.1.
-- La file ne contient ni adresse email, ni nom, ni lien de consultation.
create table if not exists public.madic_rdv_email_queue (
 id uuid primary key default gen_random_uuid(),
 appointment_id uuid not null references public.madic_cric_appointments(id) on delete cascade,
 recipient_user_id uuid not null,
 kind text not null check (kind in ('requested','confirmed','declined','cancelled','reminder_24h','reminder_1h')),
 notification_id uuid references public.madic_rdv_notifications(id) on delete cascade,
 created_at timestamptz not null default now(),
 status text not null default 'pending' check (status in ('pending','processing','sent','skipped','failed')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 locked_at timestamptz,
 sent_at timestamptz,
 last_error text,
 constraint madic_rdv_email_queue_reminder_key unique (appointment_id,recipient_user_id,kind)
);
create unique index if not exists madic_rdv_email_notification_unique on public.madic_rdv_email_queue(notification_id) where notification_id is not null;
create index if not exists madic_rdv_email_queue_pending on public.madic_rdv_email_queue(status,next_attempt_at);
alter table public.madic_rdv_email_queue enable row level security;
revoke all on public.madic_rdv_email_queue from public, anon, authenticated;
-- Seul le role technique service_role peut utiliser cette file.
grant select, insert, update on public.madic_rdv_email_queue to service_role;

create or replace function public.madic_rdv_enqueue_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.madic_rdv_email_queue(appointment_id,recipient_user_id,kind,notification_id)
 values(new.appointment_id,new.recipient_user_id,new.event_type,new.id)
 on conflict do nothing;
 return new;
end; $$;
revoke all on function public.madic_rdv_enqueue_email() from public,anon,authenticated;
drop trigger if exists madic_rdv_enqueue_email_trg on public.madic_rdv_notifications;
create trigger madic_rdv_enqueue_email_trg after insert on public.madic_rdv_notifications
for each row execute function public.madic_rdv_enqueue_email();

-- Creation des rappels seulement dans la fenetre prevue. Une execution toutes les 5 min.
-- Fenetre de tolerance de 20 min pour les retards d'execution.
create or replace function public.madic_rdv_prepare_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Acces refuse'; end if;
 with reminders as (
  select a.id appointment_id, a.client_id recipient_user_id,
    case when s.starts_at <= now() + interval '24 hours' and s.starts_at > now() + interval '23 hours 40 minutes' then 'reminder_24h'
         when s.starts_at <= now() + interval '1 hour' and s.starts_at > now() + interval '40 minutes' then 'reminder_1h' end kind
  from public.madic_cric_appointments a
  join public.madic_cric_appointment_slots s on s.id=a.slot_id and s.space_id=a.space_id
  where a.status='confirmed' and s.starts_at>now() and s.is_open
 ), targets as (
  select r.appointment_id,r.recipient_user_id,r.kind from reminders r where r.kind is not null
  union all
  select r.appointment_id,sp.owner_user_id,r.kind from reminders r
  join public.madic_cric_appointments a on a.id=r.appointment_id
  join public.madic_cric_spaces sp on sp.id=a.space_id
  where r.kind is not null and sp.owner_user_id is not null and sp.owner_user_id<>r.recipient_user_id
 ), inserted as (
  insert into public.madic_rdv_email_queue(appointment_id,recipient_user_id,kind)
  select appointment_id,recipient_user_id,kind from targets
  on conflict do nothing returning id
 ) select count(*) into v_count from inserted;
 return v_count;
end; $$;
revoke all on function public.madic_rdv_prepare_reminders() from public,anon,authenticated;
grant execute on function public.madic_rdv_prepare_reminders() to service_role;

-- Atomiquement reserve jusqu'a 25 emails; reessaie les jobs abandonnes apres 15 min.
create or replace function public.madic_rdv_claim_emails(p_limit integer default 25)
returns setof public.madic_rdv_email_queue language plpgsql security definer set search_path = '' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Acces refuse'; end if;
 return query
 with candidates as (
   select q.id from public.madic_rdv_email_queue q
   where (q.status='pending' and q.next_attempt_at<=now())
      or (q.status='processing' and q.locked_at<now()-interval '15 minutes')
   order by q.created_at
   for update skip locked limit least(greatest(p_limit,1),25)
 )
 update public.madic_rdv_email_queue q
 set status='processing',locked_at=now(),attempts=q.attempts+1
 from candidates c where q.id=c.id returning q.*;
end; $$;
revoke all on function public.madic_rdv_claim_emails(integer) from public,anon,authenticated;
grant execute on function public.madic_rdv_claim_emails(integer) to service_role;
