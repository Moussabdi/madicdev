-- Executer dans Supabase SQL Editor, apres verification sur environnement de test.
create table if not exists public.madic_cric_professional_profiles (
  space_id uuid primary key references public.madic_cric_spaces(id) on delete cascade,
  first_name text not null check (length(trim(first_name)) between 1 and 120),
  last_name text not null check (length(trim(last_name)) between 1 and 120),
  business_name text not null check (length(trim(business_name)) between 1 and 200),
  phone text not null check (length(trim(phone)) between 1 and 50),
  business_address text not null check (length(trim(business_address)) between 1 and 500),
  logo_path text not null check (length(trim(logo_path)) > 0),
  photo_path text,
  business_values text,
  updated_at timestamptz not null default now()
);
alter table public.madic_cric_professional_profiles enable row level security;
revoke all on public.madic_cric_professional_profiles from anon;
grant select, insert, update on public.madic_cric_professional_profiles to authenticated;
drop policy if exists cric_profile_select on public.madic_cric_professional_profiles;
create policy cric_profile_select on public.madic_cric_professional_profiles for select to authenticated
 using (public.madic_can_manage_cric_space(space_id));
drop policy if exists cric_profile_insert on public.madic_cric_professional_profiles;
create policy cric_profile_insert on public.madic_cric_professional_profiles for insert to authenticated
 with check (public.madic_can_manage_cric_space(space_id));
drop policy if exists cric_profile_update on public.madic_cric_professional_profiles;
create policy cric_profile_update on public.madic_cric_professional_profiles for update to authenticated
 using (public.madic_can_manage_cric_space(space_id)) with check (public.madic_can_manage_cric_space(space_id));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('madic-cric-branding','madic-cric-branding',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
-- Chaque objet est dans <space_id>/logo-<uuid>.<extension> ou photo-<uuid>.<extension>.
drop policy if exists cric_branding_read on storage.objects;
create policy cric_branding_read on storage.objects for select to authenticated
 using (bucket_id='madic-cric-branding' and public.madic_can_manage_cric_space((split_part(name,'/',1))::uuid));
drop policy if exists cric_branding_insert on storage.objects;
create policy cric_branding_insert on storage.objects for insert to authenticated
 with check (bucket_id='madic-cric-branding' and name ~ '^[0-9a-f-]{36}/(logo|photo)-[0-9a-f-]{36}\.(png|jpg|webp)$' and public.madic_can_manage_cric_space((split_part(name,'/',1))::uuid));
