BEGIN;

-- MADIC / Contrats initiaux - migration additive. Tester d'abord sur un projet de developpement.
-- IMPORTANT: ne publier aucun contrat avant validation juridique des textes et tarifs.

create table if not exists public.madic_contract_templates (
 id uuid primary key default gen_random_uuid(),
 kind text not null unique check (kind in ('horaire','forfait')),
 title text not null,
 body text not null,
 rate numeric(12,2) not null check(rate >= 0),
 spouse_extra numeric(12,2) not null default 0 check(spouse_extra >= 0),
 currency text not null default 'USD' check(currency in ('CAD','USD')),
 business_address text not null,
 consultant_name text not null default 'Moussa ABDI DIRANEH',
 consultant_licence text not null default 'R712951',
 updated_at timestamptz not null default now()
);

create table if not exists public.madic_contracts (
 id uuid primary key default gen_random_uuid(),
 dossier_id uuid not null references public.dossiers(id),
 client_id uuid not null references auth.users(id),
 template_kind text not null check(template_kind in ('horaire','forfait')),
 title text not null,
 body_snapshot text not null,
 rate numeric(12,2) not null,
 spouse_extra numeric(12,2) not null,
 currency text not null,
 business_address text not null,
 consultant_name text not null,
 consultant_licence text not null,
 client_snapshot jsonb not null,
 status text not null default 'brouillon' check(status in ('brouillon','publie','signe')),
 version integer not null default 1,
 created_at timestamptz not null default now(),
 published_at timestamptz,
 signed_at timestamptz,
 signed_name text,
 consent_text text,
 signed_user_id uuid references auth.users(id),
 signed_digest text,
 constraint madic_contract_client_snapshot_object check(jsonb_typeof(client_snapshot)='object')
);
create index if not exists madic_contracts_client_idx on public.madic_contracts(client_id,created_at desc);
create index if not exists madic_contracts_dossier_idx on public.madic_contracts(dossier_id);

create table if not exists public.madic_contract_events (
 id bigint generated always as identity primary key,
 contract_id uuid not null references public.madic_contracts(id),
 actor_id uuid not null references auth.users(id),
 event_type text not null check(event_type in ('cree','publie','signe')),
 created_at timestamptz not null default now(),
 details jsonb not null default '{}'::jsonb
);

alter table public.madic_contract_templates enable row level security;
alter table public.madic_contracts enable row level security;
alter table public.madic_contract_events enable row level security;

-- Pas de droits d'ecriture directe depuis le navigateur. Ecritures via RPC controlees.
revoke all on public.madic_contract_templates from anon, authenticated;
revoke all on public.madic_contracts from anon, authenticated;
revoke all on public.madic_contract_events from anon, authenticated;
grant select on public.madic_contract_templates, public.madic_contracts, public.madic_contract_events to authenticated;

-- Fonctions privees (security definer, chemin fige) : verifier les roles dans la table profiles.
create or replace function public.madic_contract_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin');
$$;
revoke all on function public.madic_contract_is_admin() from public, anon;
grant execute on function public.madic_contract_is_admin() to authenticated;

-- Une politique de lecture ne remplace pas les GRANT ci-dessus.
drop policy if exists madic_templates_admin_read on public.madic_contract_templates;
create policy madic_templates_admin_read on public.madic_contract_templates for select to authenticated
 using (public.madic_contract_is_admin());
drop policy if exists madic_contracts_read on public.madic_contracts;
create policy madic_contracts_read on public.madic_contracts for select to authenticated
 using (public.madic_contract_is_admin() or (client_id=(select auth.uid()) and status in ('publie','signe')));
drop policy if exists madic_contract_events_read on public.madic_contract_events;
create policy madic_contract_events_read on public.madic_contract_events for select to authenticated
 using (public.madic_contract_is_admin() or exists (
  select 1 from public.madic_contracts c where c.id=contract_id and c.client_id=(select auth.uid()) and c.status='signe'
 ));

insert into public.madic_contract_templates(kind,title,body,rate,spouse_extra,currency,business_address)
values
('horaire','Contrat de consultation initiale - taux horaire',
E'Je soussigné(e), {{client_name}}, demande une consultation auprès de MAD Immigration Canadienne (MADIC) inc. L’objet de la consultation est d’obtenir un avis professionnel sur mes projets ou objectifs d’immigration au Canada.\n\nHonoraires : {{rate}} {{currency}} par heure de consultation. Les modalités de facturation, les taxes applicables, le dépôt éventuel, les services inclus, les frais et les conditions de remboursement doivent être confirmés par MADIC avant publication.\n\nAdresse professionnelle : {{business_address}}.\n\nConsultant : {{consultant_name}}, permis {{consultant_licence}}.\n\nLe client confirme avoir lu le présent contrat, compris ses modalités et accepté de le signer électroniquement.',
159,0,'USD','Bureau 202, 1622 Rue Barré, Saint-Laurent, Québec, H4L 4M8'),
('forfait','Contrat de consultation initiale - taux forfaitaire',
E'Je soussigné(e), {{client_name}}, demande une consultation auprès de MAD Immigration Canadienne (MADIC) inc. L’objet de la consultation est d’obtenir un avis professionnel sur mes projets ou objectifs d’immigration au Canada.\n\nHonoraires forfaitaires : {{rate}} {{currency}} pour une personne; supplément de {{spouse_extra}} {{currency}} si le conjoint est inclus. Les services compris, les taxes applicables, le dépôt éventuel, les frais et les conditions de remboursement doivent être confirmés par MADIC avant publication.\n\nAdresse professionnelle : {{business_address}}.\n\nConsultant : {{consultant_name}}, permis {{consultant_licence}}.\n\nLe client confirme avoir lu le présent contrat, compris ses modalités et accepté de le signer électroniquement.',
599,150,'USD','Bureau 202, 1622 Rue Barré, Saint-Laurent, Québec, H4L 4M8')
on conflict(kind) do nothing;

-- Les tarifs initiaux sont des valeurs de test; valider avant publication.

create or replace function public.madic_save_contract_template(
 p_kind text,p_title text,p_body text,p_rate numeric,p_spouse_extra numeric,p_currency text,p_address text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.madic_contract_is_admin() then raise exception 'Acces reserve a MADIC'; end if;
 if p_kind not in ('horaire','forfait') or p_currency not in ('CAD','USD') or p_rate is null or p_rate<0
 or p_spouse_extra is null or p_spouse_extra<0 or length(trim(p_title))<5 or length(trim(p_body))<100
 or length(trim(p_address))<5 then raise exception 'Parametres invalides'; end if;
 update public.madic_contract_templates set title=p_title,body=p_body,rate=p_rate,spouse_extra=p_spouse_extra,
 currency=p_currency,business_address=p_address,updated_at=now() where kind=p_kind;
 if not found then raise exception 'Modele introuvable'; end if;
end;$$;

create or replace function public.madic_create_contract(p_dossier_id uuid,p_kind text)
returns uuid language plpgsql security definer set search_path='' as $$
declare d record; t record; p record; new_id uuid; snap jsonb;
begin
 if not public.madic_contract_is_admin() then raise exception 'Acces reserve a MADIC'; end if;
 select id,client_id,status into d from public.dossiers where id=p_dossier_id;
 if not found or d.status <> 'actif' then raise exception 'Le dossier doit etre actif'; end if;
 select * into t from public.madic_contract_templates where kind=p_kind;
 if not found then raise exception 'Modele introuvable'; end if;
 select first_name,last_name,email,phone,country into p from public.profiles where id=d.client_id;
 if not found then raise exception 'Profil client introuvable'; end if;
 snap=jsonb_build_object('first_name',p.first_name,'last_name',p.last_name,'email',p.email,'phone',p.phone,'country',p.country);
 insert into public.madic_contracts(dossier_id,client_id,template_kind,title,body_snapshot,rate,spouse_extra,currency,
 business_address,consultant_name,consultant_licence,client_snapshot)
 values(d.id,d.client_id,p_kind,t.title,t.body,t.rate,t.spouse_extra,t.currency,t.business_address,
 t.consultant_name,t.consultant_licence,snap) returning id into new_id;
 insert into public.madic_contract_events(contract_id,actor_id,event_type) values(new_id,auth.uid(),'cree');
 return new_id;
end;$$;

create or replace function public.madic_publish_contract(p_contract_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c record;
begin
 if not public.madic_contract_is_admin() then raise exception 'Acces reserve a MADIC'; end if;
 select c.id,c.status,d.status as dossier_status into c from public.madic_contracts c
 join public.dossiers d on d.id=c.dossier_id where c.id=p_contract_id for update of c;
 if not found or c.status<>'brouillon' or c.dossier_status<>'actif' then raise exception 'Contrat ou dossier non admissible'; end if;
 update public.madic_contracts set status='publie',published_at=now() where id=p_contract_id;
 insert into public.madic_contract_events(contract_id,actor_id,event_type) values(p_contract_id,auth.uid(),'publie');
end;$$;

create or replace function public.madic_sign_contract(p_contract_id uuid,p_full_name text,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare c record; expected_name text; payload text; digest text;
begin
 if auth.uid() is null or p_accept is distinct from true then raise exception 'Consentement requis'; end if;
 select c.*,d.status as dossier_status into c from public.madic_contracts c
 join public.dossiers d on d.id=c.dossier_id where c.id=p_contract_id for update of c;
 if not found or c.client_id<>auth.uid() or c.status<>'publie' or c.dossier_status<>'actif'
 then raise exception 'Signature non autorisee'; end if;
 expected_name=trim(concat_ws(' ',c.client_snapshot->>'first_name',c.client_snapshot->>'last_name'));
 if length(trim(p_full_name))<3 or lower(trim(p_full_name))<>lower(expected_name) then
 raise exception 'Saisissez votre nom et prenom tels qu enregistres dans votre profil'; end if;
 payload=concat_ws('|',c.id::text,c.version::text,c.title,c.body_snapshot,c.rate::text,c.spouse_extra::text,
 c.currency,c.business_address,c.consultant_name,c.consultant_licence,c.client_snapshot::text,p_full_name);
 digest=encode(sha256(convert_to(payload,'UTF8')),'hex');
 update public.madic_contracts set status='signe',signed_at=now(),signed_name=trim(p_full_name),
 signed_user_id=auth.uid(),consent_text='Je reconnais avoir lu le contrat et consens a le signer electroniquement.',
 signed_digest=digest where id=p_contract_id;
 insert into public.madic_contract_events(contract_id,actor_id,event_type,details)
 values(p_contract_id,auth.uid(),'signe',jsonb_build_object('digest',digest,'method','authenticated-session + typed-name + explicit-consent'));
end;$$;

revoke all on function public.madic_save_contract_template(text,text,text,numeric,numeric,text,text) from public, anon;
revoke all on function public.madic_create_contract(uuid,text) from public, anon;
revoke all on function public.madic_publish_contract(uuid) from public, anon;
revoke all on function public.madic_sign_contract(uuid,text,boolean) from public, anon;
grant execute on function public.madic_save_contract_template(text,text,text,numeric,numeric,text,text) to authenticated;
grant execute on function public.madic_create_contract(uuid,text) to authenticated;
grant execute on function public.madic_publish_contract(uuid) to authenticated;
grant execute on function public.madic_sign_contract(uuid,text,boolean) to authenticated;

create or replace function public.madic_update_contract_draft(
 p_contract_id uuid,p_title text,p_body text,p_rate numeric,p_spouse_extra numeric,
 p_currency text,p_address text,p_client_snapshot jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.madic_contract_is_admin() then raise exception 'Acces reserve a MADIC'; end if;
 if p_currency not in ('CAD','USD') or p_rate is null or p_rate<0 or p_spouse_extra is null or p_spouse_extra<0
 or length(trim(p_title))<5 or length(trim(p_body))<100 or length(trim(p_address))<5
 or jsonb_typeof(p_client_snapshot)<>'object' or length(trim(coalesce(p_client_snapshot->>'first_name','')))<1
 or length(trim(coalesce(p_client_snapshot->>'last_name','')))<1 then raise exception 'Brouillon invalide'; end if;
 update public.madic_contracts set title=p_title,body_snapshot=p_body,rate=p_rate,
 spouse_extra=p_spouse_extra,currency=p_currency,business_address=p_address,
 client_snapshot=p_client_snapshot where id=p_contract_id and status='brouillon';
 if not found then raise exception 'Seul un brouillon peut etre modifie'; end if;
end;$$;
revoke all on function public.madic_update_contract_draft(uuid,text,text,numeric,numeric,text,text,jsonb) from public, anon;
grant execute on function public.madic_update_contract_draft(uuid,text,text,numeric,numeric,text,text,jsonb) to authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
