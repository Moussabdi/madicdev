-- Migration additive MADIC : appliquer APRES contrats.sql et profil_contrats.sql.
-- Sauvegarder la base et tester d'abord dans un environnement de developpement.
begin;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists address_number text;
alter table public.profiles add column if not exists address_street text;
alter table public.profiles add column if not exists address_apartment text;
alter table public.profiles add column if not exists address_city text;
alter table public.profiles add column if not exists address_region text;
alter table public.profiles add column if not exists address_postal_code text;
-- Ne pas imposer NOT NULL aux clients deja inscrits.
-- Conserver le champ country existant et residential_address pour compatibilite.
create or replace function public.madic_create_contract(p_dossier_id uuid,p_kind text)
returns uuid language plpgsql security definer set search_path='' as $$
declare d record; t record; p record; new_id uuid; snap jsonb; full_address text;
begin
 if not public.madic_contract_is_admin() then raise exception 'Acces reserve a MADIC'; end if;
 select id,client_id,status into d from public.dossiers where id=p_dossier_id;
 if not found or d.status <> 'actif' then raise exception 'Le dossier doit etre actif'; end if;
 select * into t from public.madic_contract_templates where kind=p_kind;
 if not found then raise exception 'Modele introuvable'; end if;
 select first_name,last_name,email,phone,country,date_of_birth,residential_address,gender,
 address_number,address_street,address_apartment,address_city,address_region,address_postal_code
 into p from public.profiles where id=d.client_id;
 if not found then raise exception 'Profil client introuvable'; end if;
 full_address=concat_ws(', ',nullif(trim(concat_ws(' ',p.address_number,p.address_street)),''),
 case when nullif(trim(coalesce(p.address_apartment,'')),'') is not null then 'Appartement '||trim(p.address_apartment) end,
 nullif(trim(coalesce(p.address_city,'')),''),nullif(trim(coalesce(p.address_region,'')),''),
 nullif(trim(coalesce(p.address_postal_code,'')),''),nullif(trim(coalesce(p.country,'')),''));
 if p.date_of_birth is null or p.gender not in ('Homme','Femme')
 or nullif(trim(coalesce(p.address_number,'')),'') is null
 or nullif(trim(coalesce(p.address_street,'')),'') is null
 or nullif(trim(coalesce(p.address_city,'')),'') is null
 or nullif(trim(coalesce(p.address_region,'')),'') is null
 or nullif(trim(coalesce(p.country,'')),'') is null
 then raise exception 'Le profil du client doit contenir genre, naissance et adresse complete'; end if;
 snap=jsonb_build_object('first_name',p.first_name,'last_name',p.last_name,'email',p.email,
 'phone',p.phone,'country',p.country,'gender',p.gender,'date_of_birth',to_char(p.date_of_birth,'YYYY-MM-DD'),
 'address_number',p.address_number,'address_street',p.address_street,'address_apartment',p.address_apartment,
 'address_city',p.address_city,'address_region',p.address_region,'address_postal_code',p.address_postal_code,
 'residential_address',full_address);
 insert into public.madic_contracts(dossier_id,client_id,template_kind,title,body_snapshot,rate,spouse_extra,currency,
 business_address,consultant_name,consultant_licence,client_snapshot)
 values(d.id,d.client_id,p_kind,t.title,t.body,t.rate,t.spouse_extra,t.currency,t.business_address,
 t.consultant_name,t.consultant_licence,snap) returning id into new_id;
 insert into public.madic_contract_events(contract_id,actor_id,event_type) values(new_id,auth.uid(),'cree');
 return new_id;
end;$$;
revoke all on function public.madic_create_contract(uuid,text) from public,anon;
grant execute on function public.madic_create_contract(uuid,text) to authenticated;
update public.madic_contract_templates
set body=body || E'\nGenre : {{client_gender}}', updated_at=now()
where body not like '%{{client_gender}}%';
notify pgrst,'reload schema';
commit;
