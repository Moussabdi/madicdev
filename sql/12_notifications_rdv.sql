-- MADIC module 6.1 : notifications internes de rendez-vous.
-- A executer dans Supabase SQL Editor avec un compte administrateur DB.
-- Ne cree aucune notification historique ; seuls les changements futurs sont notifies.
create table if not exists public.madic_rdv_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null,
  space_id uuid not null references public.madic_cric_spaces(id) on delete cascade,
  appointment_id uuid not null references public.madic_cric_appointments(id) on delete cascade,
  event_type text not null check (event_type in ('requested','confirmed','declined','cancelled')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists madic_rdv_notifications_recipient_idx
  on public.madic_rdv_notifications(recipient_user_id, created_at desc);
create unique index if not exists madic_rdv_notifications_event_unique_idx
  on public.madic_rdv_notifications(appointment_id, recipient_user_id, event_type, created_at);
alter table public.madic_rdv_notifications enable row level security;
revoke all on public.madic_rdv_notifications from anon, authenticated;
grant select on public.madic_rdv_notifications to authenticated;
drop policy if exists madic_rdv_notifications_read_self on public.madic_rdv_notifications;
create policy madic_rdv_notifications_read_self on public.madic_rdv_notifications
for select to authenticated using (recipient_user_id = (select auth.uid()));

create or replace function public.madic_rdv_mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.madic_rdv_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_user_id = (select auth.uid());
  if not found then raise exception 'Notification introuvable ou accès refusé'; end if;
end; $$;
revoke all on function public.madic_rdv_mark_notification_read(uuid) from public, anon;
grant execute on function public.madic_rdv_mark_notification_read(uuid) to authenticated;

create or replace function public.madic_rdv_notify_appointment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  select s.owner_user_id into v_owner
  from public.madic_cric_spaces s where s.id = new.space_id;
  if new.status = 'requested' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if v_owner is not null then
      insert into public.madic_rdv_notifications(recipient_user_id, space_id, appointment_id, event_type)
      values (v_owner, new.space_id, new.id, 'requested');
    end if;
  elsif new.status in ('confirmed','declined') then
    insert into public.madic_rdv_notifications(recipient_user_id, space_id, appointment_id, event_type)
    values (new.client_id, new.space_id, new.id, new.status);
  elsif new.status = 'cancelled' then
    -- Informer les deux parties, sauf l'acteur qui annule.
    if new.client_id is distinct from auth.uid() then
      insert into public.madic_rdv_notifications(recipient_user_id, space_id, appointment_id, event_type)
      values (new.client_id, new.space_id, new.id, 'cancelled');
    end if;
    if v_owner is not null and v_owner is distinct from auth.uid() then
      insert into public.madic_rdv_notifications(recipient_user_id, space_id, appointment_id, event_type)
      values (v_owner, new.space_id, new.id, 'cancelled');
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.madic_rdv_notify_appointment() from public, anon, authenticated;
drop trigger if exists madic_rdv_notify_appointment_trg on public.madic_cric_appointments;
create trigger madic_rdv_notify_appointment_trg
  after insert or update of status on public.madic_cric_appointments
  for each row execute function public.madic_rdv_notify_appointment();
