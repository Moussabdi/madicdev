-- Executer une fois dans Supabase SQL Editor.
create table if not exists public.madic_cric_prevalidations (
  id uuid primary key default gen_random_uuid(),
  lookup_token_hash text not null unique,
  full_name text not null,
  license_number text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  checked_at timestamptz,
  checked_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);
create index if not exists madic_cric_prevalidations_license_idx on public.madic_cric_prevalidations (license_number);
alter table public.madic_cric_prevalidations enable row level security;
-- Aucun acces direct navigateur : toutes les operations passent par l'Edge Function.
revoke all on public.madic_cric_prevalidations from anon, authenticated;
grant all on public.madic_cric_prevalidations to service_role;
