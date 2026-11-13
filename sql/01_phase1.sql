-- MADIC : phase 1, demandes CRIC et validation par le propriétaire.
-- A EXECUTER APRES AVOIR REMPLACE LE UUID DANS 02_owner.sql.
-- N'altère aucune politique existante sur profiles, dossiers, documents ou storage.
create table if not exists public.madic_super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.madic_cric_applications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 150),
  license_number text not null check (license_number ~ '^R[0-9]{6,}$'),
  professional_email text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create unique index if not exists madic_cric_license_unique on public.madic_cric_applications (upper(license_number));
create table if not exists public.madic_cric_spaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.madic_cric_memberships (
  space_id uuid not null references public.madic_cric_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  primary key(space_id,user_id)
);
-- RLS et privileges minimaux
alter table public.madic_super_admins enable row level security;
alter table public.madic_cric_applications enable row level security;
alter table public.madic_cric_spaces enable row level security;
alter table public.madic_cric_memberships enable row level security;
revoke all on public.madic_super_admins from anon,authenticated;
revoke all on public.madic_cric_applications from anon,authenticated;
revoke all on public.madic_cric_spaces from anon,authenticated;
revoke all on public.madic_cric_memberships from anon,authenticated;
grant select,insert on public.madic_cric_applications to authenticated;
grant select on public.madic_cric_spaces,public.madic_cric_memberships to authenticated;
-- Fonction de vérification du propriétaire : contourne uniquement la RLS de la table privée.
create or replace function public.madic_is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.madic_super_admins s where s.user_id=auth.uid());
$$;
revoke all on function public.madic_is_super_admin() from public,anon;
grant execute on function public.madic_is_super_admin() to authenticated;
-- Pour une nouvelle demande, identité = utilisateur connecté et courriel Auth.
create policy madic_cric_apply on public.madic_cric_applications
  for insert to authenticated with check (
    user_id = (select auth.uid()) and status = 'pending'
    and admin_note is null and reviewed_at is null and reviewed_by is null
    and lower(professional_email) = lower((select auth.jwt()->>'email'))
  );
-- Le demandeur lit sa demande; le propriétaire lit toutes les demandes.
create policy madic_cric_application_read on public.madic_cric_applications
  for select to authenticated using (
    user_id = (select auth.uid()) or (select public.madic_is_super_admin())
  );
create policy madic_cric_space_read on public.madic_cric_spaces
  for select to authenticated using (
    owner_user_id = (select auth.uid()) or (select public.madic_is_super_admin())
  );
create policy madic_cric_membership_read on public.madic_cric_memberships
  for select to authenticated using (
    user_id = (select auth.uid()) or (select public.madic_is_super_admin())
  );
-- Seul un super administrateur inscrit explicitement peut approuver.
create or replace function public.madic_review_cric(p_user_id uuid,p_approve boolean,p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.madic_super_admins where user_id = auth.uid()
  ) then raise exception 'Accès interdit'; end if;
  select full_name into v_name from public.madic_cric_applications
  where user_id=p_user_id and status='pending' for update;
  if not found then raise exception 'Demande introuvable ou déjà traitée'; end if;
  update public.madic_cric_applications
  set status=case when p_approve then 'approved' else 'rejected' end,
      admin_note=nullif(trim(p_note),''),reviewed_at=now(),reviewed_by=auth.uid()
  where user_id=p_user_id;
  if p_approve then
    insert into public.madic_cric_spaces(owner_user_id,name)
    values (p_user_id,v_name) on conflict (owner_user_id) do nothing;
    insert into public.madic_cric_memberships(space_id,user_id,role)
    select id,p_user_id,'owner' from public.madic_cric_spaces
    where owner_user_id=p_user_id on conflict do nothing;
  end if;
end; $$;
revoke all on function public.madic_review_cric(uuid,boolean,text) from public,anon;
grant execute on function public.madic_review_cric(uuid,boolean,text) to authenticated;
