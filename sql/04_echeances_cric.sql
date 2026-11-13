-- MADIC - Echeances par cabinet. A executer une seule fois APRES verification des dependances.
-- Ne modifie pas les politiques existantes des dossiers, clients ou documents.
create table if not exists public.madic_cric_deadlines (
 id uuid primary key default gen_random_uuid(),
 space_id uuid not null references public.madic_cric_spaces(id) on delete cascade,
 dossier_id uuid not null references public.dossiers(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 180),
 due_date date not null,
 completed boolean not null default false,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 unique(id,space_id)
);
create index if not exists madic_cric_deadlines_space_date on public.madic_cric_deadlines(space_id,due_date);
alter table public.madic_cric_deadlines enable row level security;
revoke all on public.madic_cric_deadlines from anon;
grant select,insert,update,delete on public.madic_cric_deadlines to authenticated;
-- Fonction de verification du dossier : le dossier doit appartenir au meme espace.
create or replace function public.madic_deadline_dossier_in_space(p_dossier_id uuid,p_space_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.dossiers d where d.id=p_dossier_id and d.space_id=p_space_id);
$$;
revoke all on function public.madic_deadline_dossier_in_space(uuid,uuid) from public,anon;
grant execute on function public.madic_deadline_dossier_in_space(uuid,uuid) to authenticated;
-- Utilise la fonction d'autorisation CRIC deja existante. Aucun droit super-admin implicite.
create policy madic_deadlines_select on public.madic_cric_deadlines for select to authenticated
 using (public.madic_can_manage_cric_space(space_id));
create policy madic_deadlines_insert on public.madic_cric_deadlines for insert to authenticated
 with check (created_by=auth.uid() and public.madic_can_manage_cric_space(space_id)
 and public.madic_deadline_dossier_in_space(dossier_id,space_id));
create policy madic_deadlines_update on public.madic_cric_deadlines for update to authenticated
 using (public.madic_can_manage_cric_space(space_id))
 with check (public.madic_can_manage_cric_space(space_id)
 and public.madic_deadline_dossier_in_space(dossier_id,space_id));
create policy madic_deadlines_delete on public.madic_cric_deadlines for delete to authenticated
 using (public.madic_can_manage_cric_space(space_id));
