-- MADIC MVP schema. Run in Supabase SQL Editor on a NEW project.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 first_name text not null default '', last_name text not null default '',
 email text not null default '', phone text not null default '', country text not null default '',
 role text not null default 'client' check(role in ('client','admin')),
 created_at timestamptz not null default now()
);
create table public.dossiers (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.profiles(id) on delete restrict,
 reference text not null unique,
 category text not null default 'Autre',
 status text not null default 'en_attente' check(status in ('en_attente','actif','ferme')),
 created_at timestamptz not null default now()
);
create table public.documents (
 id uuid primary key default gen_random_uuid(),
 dossier_id uuid not null references public.dossiers(id) on delete restrict,
 client_id uuid not null references public.profiles(id) on delete restrict,
 original_name text not null, storage_path text not null unique,
 mime_type text not null, size_bytes bigint not null check(size_bytes > 0 and size_bytes <= 10485760),
 status text not null default 'recu' check(status in ('recu','a_verifier','accepte','a_remplacer')),
 created_at timestamptz not null default now()
);
create index dossiers_client_idx on public.dossiers(client_id);
create index documents_client_idx on public.documents(client_id);
create index documents_dossier_idx on public.documents(dossier_id);
-- Admin status is stored in database, NEVER read from editable user metadata.
create or replace function public.is_madic_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;
revoke all on function public.is_madic_admin() from public;
grant execute on function public.is_madic_admin() to authenticated;
create or replace function public.on_madic_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,email,first_name,last_name)
 values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'first_name',''),120),left(coalesce(new.raw_user_meta_data->>'last_name',''),120));
 return new;
end $$;
create trigger madic_signup after insert on auth.users for each row execute function public.on_madic_signup();
alter table public.profiles enable row level security;
alter table public.dossiers enable row level security;
alter table public.documents enable row level security;
create policy profile_read on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_madic_admin()));
create policy profile_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Restrict editable columns so clients cannot elevate their own role.
revoke update on public.profiles from authenticated;
grant update(first_name,last_name,phone,country) on public.profiles to authenticated;
create policy dossier_read on public.dossiers for select to authenticated using (client_id = (select auth.uid()) or (select public.is_madic_admin()));
create policy dossier_admin_insert on public.dossiers for insert to authenticated with check ((select public.is_madic_admin()));
create policy dossier_admin_update on public.dossiers for update to authenticated using ((select public.is_madic_admin())) with check ((select public.is_madic_admin()));
create policy document_read on public.documents for select to authenticated using (client_id = (select auth.uid()) or (select public.is_madic_admin()));
create policy document_insert on public.documents for insert to authenticated with check (
 client_id = (select auth.uid()) and exists(select 1 from public.dossiers d where d.id = dossier_id and d.client_id = (select auth.uid()) and d.status = 'actif')
);
create policy document_admin_update on public.documents for update to authenticated using ((select public.is_madic_admin())) with check ((select public.is_madic_admin()));
-- Private bucket: the client can upload only inside own UUID prefix and active dossier.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('madic-documents','madic-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf','image/jpeg','image/png'];
create policy madic_file_read on storage.objects for select to authenticated using (
 bucket_id = 'madic-documents' and (
 (storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_madic_admin()))
);
create policy madic_file_upload on storage.objects for insert to authenticated with check (
 bucket_id = 'madic-documents' and (storage.foldername(name))[1] = (select auth.uid())::text
 and exists(select 1 from public.dossiers d where d.id::text = (storage.foldername(name))[2]
 and d.client_id = (select auth.uid()) and d.status = 'actif')
);
-- No client delete/update storage policies: immutable uploaded files.
-- Initial admin: sign up normally, then promote explicitly in SQL editor:
-- update public.profiles set role='admin' where email='YOUR_ADMIN_EMAIL';
-- For invited clients use Supabase Dashboard > Authentication > Users > Invite user.
