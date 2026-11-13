-- Migration additive : executer apres la migration initiale des contrats.
begin;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists residential_address text;
-- Permet a la fonction de creation de copier les nouvelles informations dans le contrat.
create or replace function public.madic_create_contract(p_dossier_id uuid,p_kind text)
returns uuid language plpgsql security definer set search_path='' as $$
declare d record; t record; p record; new_id uuid; snap jsonb;
begin
 if not public.madic_contract_is_admin() then raise exception 'Acces reserve a MADIC'; end if;
 select id,client_id,status into d from public.dossiers where id=p_dossier_id;
 if not found or d.status <> 'actif' then raise exception 'Le dossier doit etre actif'; end if;
 select * into t from public.madic_contract_templates where kind=p_kind;
 if not found then raise exception 'Modele introuvable'; end if;
 select first_name,last_name,email,phone,country,date_of_birth,residential_address into p from public.profiles where id=d.client_id;
 if not found then raise exception 'Profil client introuvable'; end if;
 if p.date_of_birth is null or nullif(trim(coalesce(p.residential_address,'')),'') is null then
  raise exception 'Le client doit completer sa date de naissance et son adresse de residence avant la creation du contrat';
 end if;
 snap=jsonb_build_object('first_name',p.first_name,'last_name',p.last_name,'email',p.email,'phone',p.phone,'country',p.country,
  'date_of_birth',to_char(p.date_of_birth,'YYYY-MM-DD'),'residential_address',p.residential_address);
 insert into public.madic_contracts(dossier_id,client_id,template_kind,title,body_snapshot,rate,spouse_extra,currency,
 business_address,consultant_name,consultant_licence,client_snapshot)
 values(d.id,d.client_id,p_kind,t.title,t.body,t.rate,t.spouse_extra,t.currency,t.business_address,
 t.consultant_name,t.consultant_licence,snap) returning id into new_id;
 insert into public.madic_contract_events(contract_id,actor_id,event_type) values(new_id,auth.uid(),'cree');
 return new_id;
end;$$;
revoke all on function public.madic_create_contract(uuid,text) from public, anon;
grant execute on function public.madic_create_contract(uuid,text) to authenticated;
-- Completer les modeles uniquement s'ils n'ont pas encore ces variables.
update public.madic_contract_templates
set body=body || E'\n\nRenseignements du client :\nNom : {{client_last_name}}\nPrenom : {{client_first_name}}\nDate de naissance : {{client_date_of_birth}}\nAdresse de residence : {{client_residential_address}}',updated_at=now()
where body not like '%{{client_date_of_birth}}%';
notify pgrst, 'reload schema';
commit;
