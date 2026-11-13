-- Phase 4.1: demandes documentaires, isolées par cabinet. Vérifier avant exécution.
create table if not exists public.madic_cric_document_requests (
 id uuid primary key default gen_random_uuid(),
 space_id uuid not null references public.madic_cric_spaces(id),
 client_id uuid not null references auth.users(id),
 dossier_id uuid not null references public.dossiers(id),
 title text not null check (char_length(btrim(title)) between 1 and 200),
 instructions text check (char_length(instructions)<=2000),
 due_on date,
 status text not null default 'requested' check (status in ('requested','completed','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists madic_doc_requests_space_client_idx on public.madic_cric_document_requests(space_id,client_id);
alter table public.madic_cric_document_requests enable row level security;
-- La fonction d'autorisation CRIC existante contrôle l'appartenance au cabinet.
drop policy if exists madic_docreq_cric_read on public.madic_cric_document_requests;
create policy madic_docreq_cric_read on public.madic_cric_document_requests for select to authenticated
 using (public.madic_can_manage_cric_space(space_id));
drop policy if exists madic_docreq_client_read on public.madic_cric_document_requests;
create policy madic_docreq_client_read on public.madic_cric_document_requests for select to authenticated
 using (client_id=auth.uid() and exists(select 1 from public.madic_cric_clients cc where cc.space_id=madic_cric_document_requests.space_id and cc.client_id=auth.uid()));
drop policy if exists madic_docreq_cric_insert on public.madic_cric_document_requests;
create policy madic_docreq_cric_insert on public.madic_cric_document_requests for insert to authenticated
 with check (public.madic_can_manage_cric_space(space_id)
 and exists(select 1 from public.madic_cric_clients cc where cc.space_id=madic_cric_document_requests.space_id and cc.client_id=madic_cric_document_requests.client_id)
 and exists(select 1 from public.dossiers d where d.id=dossier_id and d.space_id=madic_cric_document_requests.space_id and d.client_id=madic_cric_document_requests.client_id));
drop policy if exists madic_docreq_cric_update on public.madic_cric_document_requests;
create policy madic_docreq_cric_update on public.madic_cric_document_requests for update to authenticated
 using (public.madic_can_manage_cric_space(space_id))
 with check (public.madic_can_manage_cric_space(space_id)
 and exists(select 1 from public.madic_cric_clients cc where cc.space_id=madic_cric_document_requests.space_id and cc.client_id=madic_cric_document_requests.client_id)
 and exists(select 1 from public.dossiers d where d.id=dossier_id and d.space_id=madic_cric_document_requests.space_id and d.client_id=madic_cric_document_requests.client_id));
-- Réduire les colonnes modifiables : les clients n'ont aucun droit d'écriture.
revoke all on public.madic_cric_document_requests from anon;
revoke all on public.madic_cric_document_requests from authenticated;
grant select, insert on public.madic_cric_document_requests to authenticated;
grant update (status) on public.madic_cric_document_requests to authenticated;
