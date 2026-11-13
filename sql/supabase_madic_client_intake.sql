-- Exécuter dans Supabase SQL Editor. Table isolée : aucune modification des tables existantes.
create table if not exists public.madic_client_intake (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','submitted')),
  updated_at timestamptz not null default now()
);
alter table public.madic_client_intake enable row level security;
revoke all on public.madic_client_intake from anon;
grant select, insert, update on public.madic_client_intake to authenticated;
drop policy if exists madic_intake_client_select on public.madic_client_intake;
create policy madic_intake_client_select on public.madic_client_intake for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists madic_intake_client_insert on public.madic_client_intake;
create policy madic_intake_client_insert on public.madic_client_intake for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists madic_intake_client_update on public.madic_client_intake;
create policy madic_intake_client_update on public.madic_client_intake for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- L'accès CRIC aux réponses nécessitera une politique basée sur les relations CRIC-client vérifiées.
