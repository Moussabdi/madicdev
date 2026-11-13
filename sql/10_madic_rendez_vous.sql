-- MADIC | Module rendez-vous V1 | Executer dans Supabase SQL Editor.
-- Ne donne aucun droit de lecture au superadministrateur par sa seule qualite d'administrateur.
create table if not exists public.madic_cric_appointment_slots (
 id uuid primary key default gen_random_uuid(),
 space_id uuid not null references public.madic_cric_spaces(id) on delete cascade,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 mode text not null default 'video' check (mode in ('video','phone','in_person')),
 location_info text,
 is_open boolean not null default true,
 created_at timestamptz not null default now(),
 constraint madic_slot_dates check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours')
);
create table if not exists public.madic_cric_appointments (
 id uuid primary key default gen_random_uuid(),
 space_id uuid not null references public.madic_cric_spaces(id) on delete cascade,
 slot_id uuid not null references public.madic_cric_appointment_slots(id) on delete restrict,
 client_id uuid not null references auth.users(id),
 status text not null default 'requested' check(status in ('requested','confirmed','cancelled','declined')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists madic_unique_active_booking on public.madic_cric_appointments(slot_id) where status in ('requested','confirmed');
create index if not exists madic_slots_space_time on public.madic_cric_appointment_slots(space_id,starts_at);
create index if not exists madic_appointments_space on public.madic_cric_appointments(space_id,created_at desc);
create index if not exists madic_appointments_client on public.madic_cric_appointments(client_id,created_at desc);
alter table public.madic_cric_appointment_slots enable row level security;
alter table public.madic_cric_appointments enable row level security;
revoke all on public.madic_cric_appointment_slots from anon, authenticated;
revoke all on public.madic_cric_appointments from anon, authenticated;
grant select (id,space_id,starts_at,ends_at,mode,is_open,created_at) on public.madic_cric_appointment_slots to authenticated;
grant select on public.madic_cric_appointments to authenticated;
-- Autorisation consultant : cabinet actif + propriétaire approuvé (aucun raccourci superadmin).
create or replace function public.madic_rdv_is_owner(p_space_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.madic_cric_spaces s
  join public.madic_cric_applications a on a.user_id=s.owner_user_id
  where s.id=p_space_id and s.owner_user_id=(select auth.uid())
    and s.access_status='active' and a.status='approved'
 );
$$;
create or replace function public.madic_rdv_is_client(p_space_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.madic_cric_clients c
  join public.madic_cric_spaces s on s.id=c.space_id
  where c.space_id=p_space_id and c.client_id=(select auth.uid()) and s.access_status='active'
 );
$$;
revoke all on function public.madic_rdv_is_owner(uuid) from public;
revoke all on function public.madic_rdv_is_client(uuid) from public;
grant execute on function public.madic_rdv_is_owner(uuid) to authenticated;
grant execute on function public.madic_rdv_is_client(uuid) to authenticated;
drop policy if exists madic_rdv_slots_select on public.madic_cric_appointment_slots;
create policy madic_rdv_slots_select on public.madic_cric_appointment_slots for select to authenticated using (
 public.madic_rdv_is_owner(space_id) or (is_open and starts_at > now() and public.madic_rdv_is_client(space_id) and not exists (select 1 from public.madic_cric_appointments a where a.slot_id=id and a.status in ('requested','confirmed') and a.client_id <> (select auth.uid())))
 or (public.madic_rdv_is_client(space_id) and exists(select 1 from public.madic_cric_appointments a where a.slot_id=id and a.client_id=(select auth.uid())))
);
drop policy if exists madic_rdv_bookings_select on public.madic_cric_appointments;
create policy madic_rdv_bookings_select on public.madic_cric_appointments for select to authenticated using (
 public.madic_rdv_is_owner(space_id) or (client_id=(select auth.uid()) and public.madic_rdv_is_client(space_id))
);
-- Les ecritures se font uniquement via RPC (aucune policy INSERT/UPDATE/DELETE).
create or replace function public.madic_rdv_create_slot(p_space_id uuid,p_start timestamptz,p_end timestamptz,p_mode text,p_location text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.madic_rdv_is_owner(p_space_id) then raise exception 'Accès refusé'; end if;
 if p_start <= now() or p_end <= p_start or p_end > p_start + interval '8 hours' then raise exception 'Créneau invalide'; end if;
 if p_mode not in ('video','phone','in_person') then raise exception 'Type invalide'; end if;
 if length(coalesce(p_location,''))>500 then raise exception 'Lieu trop long'; end if;
 if exists(select 1 from public.madic_cric_appointment_slots where space_id=p_space_id and is_open and starts_at<p_end and ends_at>p_start) then raise exception 'Chevauchement avec un créneau existant'; end if;
 insert into public.madic_cric_appointment_slots(space_id,starts_at,ends_at,mode,location_info)
 values(p_space_id,p_start,p_end,p_mode,nullif(trim(p_location),'')) returning id into v_id;
 return v_id;
end;$$;
create or replace function public.madic_rdv_book(p_slot_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_slot public.madic_cric_appointment_slots%rowtype; v_id uuid;
begin
 select * into v_slot from public.madic_cric_appointment_slots where id=p_slot_id for update;
 if not found or not v_slot.is_open or v_slot.starts_at<=now() then raise exception 'Créneau indisponible'; end if;
 if not public.madic_rdv_is_client(v_slot.space_id) then raise exception 'Accès refusé'; end if;
 if exists(select 1 from public.madic_cric_appointments where slot_id=p_slot_id and status in ('requested','confirmed')) then raise exception 'Créneau déjà réservé'; end if;
 insert into public.madic_cric_appointments(space_id,slot_id,client_id)
 values(v_slot.space_id,p_slot_id,(select auth.uid())) returning id into v_id;
 return v_id;
end;$$;
create or replace function public.madic_rdv_set_status(p_appointment_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_appt public.madic_cric_appointments%rowtype; v_start timestamptz;
begin
 select * into v_appt from public.madic_cric_appointments where id=p_appointment_id for update;
 if not found then raise exception 'Rendez-vous introuvable'; end if;
 select starts_at into v_start from public.madic_cric_appointment_slots where id=v_appt.slot_id;
 if v_start<=now() then raise exception 'Rendez-vous passé'; end if;
 if public.madic_rdv_is_owner(v_appt.space_id) then
  if p_status not in ('confirmed','declined','cancelled') then raise exception 'Statut invalide'; end if;
  if v_appt.status not in ('requested','confirmed') then raise exception 'Rendez-vous clos'; end if;
  if p_status='declined' and v_appt.status<>'requested' then raise exception 'Refus possible uniquement pour une demande'; end if;
 elsif v_appt.client_id=(select auth.uid()) and public.madic_rdv_is_client(v_appt.space_id) then
  if p_status<>'cancelled' or v_appt.status not in ('requested','confirmed') then raise exception 'Action non autorisée'; end if;
 else raise exception 'Accès refusé'; end if;
 update public.madic_cric_appointments set status=p_status,updated_at=now() where id=p_appointment_id;
end;$$;
create or replace function public.madic_rdv_close_slot(p_slot_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_space uuid;
begin
 select space_id into v_space from public.madic_cric_appointment_slots where id=p_slot_id for update;
 if not found or not public.madic_rdv_is_owner(v_space) then raise exception 'Accès refusé'; end if;
 if exists(select 1 from public.madic_cric_appointments where slot_id=p_slot_id and status in ('requested','confirmed')) then raise exception 'Annulez d’abord la réservation'; end if;
 update public.madic_cric_appointment_slots set is_open=false where id=p_slot_id;
end;$$;
-- Retourne les informations du lien uniquement pour une reservation confirmee et autorisee.
create or replace function public.madic_rdv_meeting_details(p_appointment_id uuid)
returns table(location_info text) language plpgsql security definer set search_path='' as $$
begin
 return query select s.location_info from public.madic_cric_appointments a
 join public.madic_cric_appointment_slots s on s.id=a.slot_id
 where a.id=p_appointment_id and a.status='confirmed' and
 (public.madic_rdv_is_owner(a.space_id) or (a.client_id=(select auth.uid()) and public.madic_rdv_is_client(a.space_id)));
end;$$;
revoke all on function public.madic_rdv_create_slot(uuid,timestamptz,timestamptz,text,text) from public;
revoke all on function public.madic_rdv_book(uuid) from public;
revoke all on function public.madic_rdv_set_status(uuid,text) from public;
revoke all on function public.madic_rdv_close_slot(uuid) from public;
revoke all on function public.madic_rdv_meeting_details(uuid) from public;
grant execute on function public.madic_rdv_create_slot(uuid,timestamptz,timestamptz,text,text) to authenticated;
grant execute on function public.madic_rdv_book(uuid) to authenticated;
grant execute on function public.madic_rdv_set_status(uuid,text) to authenticated;
grant execute on function public.madic_rdv_close_slot(uuid) to authenticated;
grant execute on function public.madic_rdv_meeting_details(uuid) to authenticated;
