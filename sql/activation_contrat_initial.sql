-- Exécuter dans Supabase SQL Editor avant de déployer les fichiers.
create extension if not exists pgcrypto;
create table if not exists public.madic_initial_contracts (
 id uuid primary key default gen_random_uuid(),
 space_id uuid not null references public.madic_cric_spaces(id),
 client_id uuid not null references auth.users(id),
 dossier_id uuid not null references public.dossiers(id),
 created_by uuid not null references auth.users(id),
 status text not null default 'publie' check(status in ('publie','signe')),
 document_snapshot jsonb not null,
 created_at timestamptz not null default now(),
 client_signed_at timestamptz,
 client_signed_name text,
 client_initials text,
 client_signature_city text,
 signed_digest text
);
create index if not exists madic_initial_contracts_client_idx on public.madic_initial_contracts(client_id,created_at desc);
alter table public.madic_initial_contracts enable row level security;
revoke all on public.madic_initial_contracts from anon;
grant select on public.madic_initial_contracts to authenticated;
drop policy if exists madic_initial_contracts_client_select on public.madic_initial_contracts;
create policy madic_initial_contracts_client_select on public.madic_initial_contracts for select to authenticated using(client_id=(select auth.uid()));
-- Aucun INSERT/UPDATE/DELETE direct n'est autorisé aux clients.
create or replace function public.madic_activate_initial_contract(p_space_id uuid,p_client_id uuid,p_dossier_id uuid,p_snapshot jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;v_owner uuid;v_active text;
begin
 if auth.uid() is null then raise exception 'Authentification requise';end if;
 select owner_user_id,access_status into v_owner,v_active from public.madic_cric_spaces where id=p_space_id;
 if v_owner is distinct from auth.uid() or v_active is distinct from 'active' then raise exception 'Espace CRIC non autorisé';end if;
 if not exists(select 1 from public.madic_cric_applications where user_id=auth.uid() and status='approved') then raise exception 'CRIC non approuvé';end if;
 if not exists(select 1 from public.madic_cric_clients where space_id=p_space_id and client_id=p_client_id) then raise exception 'Client non associé à cet espace';end if;
 if not exists(select 1 from public.dossiers where id=p_dossier_id and client_id=p_client_id and space_id=p_space_id) then raise exception 'Dossier non associé au client';end if;
 if jsonb_typeof(p_snapshot) is distinct from 'object' or length(coalesce(p_snapshot->>'html',''))<100 then raise exception 'Document manquant';end if;
 if length(p_snapshot::text)>6000000 then raise exception 'Document trop volumineux';end if;
 insert into public.madic_initial_contracts(space_id,client_id,dossier_id,created_by,document_snapshot) values(p_space_id,p_client_id,p_dossier_id,auth.uid(),p_snapshot) returning id into v_id;
 return v_id;
end;$$;
create or replace function public.madic_sign_initial_contract(p_contract_id uuid,p_full_name text,p_initials text,p_city text,p_accept boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_doc jsonb;
begin
 if auth.uid() is null or p_accept is distinct from true then raise exception 'Consentement requis';end if;
 if length(trim(coalesce(p_full_name,'')))<3 or length(trim(coalesce(p_initials,'')))<1 or length(trim(coalesce(p_city,'')))<2 then raise exception 'Renseignements de signature incomplets';end if;
 if length(p_full_name)>200 or length(p_initials)>12 or length(p_city)>120 then raise exception 'Valeurs trop longues';end if;
 select document_snapshot into v_doc from public.madic_initial_contracts where id=p_contract_id and client_id=auth.uid() and status='publie' for update;
 if not found then raise exception 'Contrat non disponible ou déjà signé';end if;
 update public.madic_initial_contracts set status='signe',client_signed_at=now(),client_signed_name=trim(p_full_name),client_initials=trim(p_initials),client_signature_city=trim(p_city),signed_digest=encode(digest(v_doc::text,'sha256'),'hex') where id=p_contract_id;
end;$$;
revoke all on function public.madic_activate_initial_contract(uuid,uuid,uuid,jsonb) from public;
revoke all on function public.madic_sign_initial_contract(uuid,text,text,text,boolean) from public;
grant execute on function public.madic_activate_initial_contract(uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.madic_sign_initial_contract(uuid,text,text,text,boolean) to authenticated;
