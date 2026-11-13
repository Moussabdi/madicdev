-- A executer dans Supabase SQL Editor avec un role administrateur de la base.
-- N'altère aucune table, réservation ni fonction existante.
create or replace function public.madic_rdv_available_slots(p_space_id uuid)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  mode text,
  is_open boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.starts_at, s.ends_at, s.mode, s.is_open
  from public.madic_cric_appointment_slots as s
  join public.madic_cric_spaces as c on c.id = s.space_id
  where auth.uid() is not null
    and s.space_id = p_space_id
    and c.access_status = 'active'
    and public.madic_rdv_is_client(p_space_id)
    and s.is_open = true
    and s.starts_at > now()
    and not exists (
      select 1
      from public.madic_cric_appointments as a
      where a.slot_id = s.id
        and a.status in ('requested', 'confirmed')
    )
  order by s.starts_at;
$$;

revoke all on function public.madic_rdv_available_slots(uuid) from public, anon;
grant execute on function public.madic_rdv_available_slots(uuid) to authenticated;
