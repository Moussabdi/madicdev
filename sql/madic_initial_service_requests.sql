-- MADIC : demandes de service initiales des clients. Exécuter dans Supabase SQL Editor.
create table if not exists public.madic_initial_service_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  service_type text not null check (service_type in ('consultation','proposition')),
  updated_at timestamptz not null default now()
);
alter table public.madic_initial_service_requests enable row level security;
drop policy if exists "Client reads own initial request" on public.madic_initial_service_requests;
create policy "Client reads own initial request" on public.madic_initial_service_requests for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Client inserts own initial request" on public.madic_initial_service_requests;
create policy "Client inserts own initial request" on public.madic_initial_service_requests for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Client updates own initial request" on public.madic_initial_service_requests;
create policy "Client updates own initial request" on public.madic_initial_service_requests for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- L'accès CRIC à ces demandes nécessitera une politique RLS spécifique
-- basée sur le schéma réel d'association CRIC-client ; aucune ouverture générale n'est créée ici.
