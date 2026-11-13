
create or replace function public.madic_client_first_context(p_dossier_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_d record; p record; a record; r record; pay record;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 select d.id,d.client_id,d.space_id,s.owner_user_id into v_d
 from public.dossiers d join public.madic_cric_spaces s on s.id=d.space_id
 join public.madic_cric_clients cc on cc.space_id=d.space_id and cc.client_id=d.client_id
 where d.id=p_dossier_id and d.client_id=auth.uid() and s.access_status='active';
 if not found then raise exception 'Dossier non autorise'; end if;
 select user_id,service_type,tariff_code into r from public.madic_initial_service_requests where user_id=auth.uid();
 if r.user_id is null or r.service_type<>'consultation' or r.tariff_code not in ('hourly','single','couple') then raise exception 'Demande de consultation et tarif requis'; end if;
 select id,status,updated_at into pay from public.madic_service_payment_declarations where client_id=auth.uid() and client_confirmed=true;
 if pay.id is null or pay.status not in ('pending','declared','verified') then raise exception 'Declaration de paiement requise'; end if;
 select * into p from public.madic_cric_professional_profiles where space_id=v_d.space_id;
 select full_name,license_number,professional_email into a from public.madic_cric_applications where user_id=v_d.owner_user_id and status='approved';
 if a.full_name is null or p.space_id is null then raise exception 'Profil CRIC incomplet'; end if;
 return jsonb_build_object('space_id',v_d.space_id,'dossier_id',v_d.id,'payment_id',pay.id,'payment_updated_at',pay.updated_at,'tariff_code',r.tariff_code,
 'consultant_name',a.full_name,'license_number',a.license_number,'email',a.professional_email,
 'business_name',p.business_name,'business_address',p.business_address,'phone',p.phone,'website_url',p.website_url,'payment_details',p.payment_details);
end;$$;
revoke all on function public.madic_client_first_context(uuid) from public,anon;
grant execute on function public.madic_client_first_context(uuid) to authenticated;

-- Signature client; le contrat CRIC -> client n'est pas touche.
create or replace function public.madic_client_first_sign(p_dossier_id uuid,p_snapshot jsonb,p_full_name text,p_initials text,p_city text,p_accept boolean)
returns uuid language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_context jsonb; v_payment uuid; v_payment_time timestamptz; v_id uuid; v_tariff text; v_existing uuid;
begin
 if auth.uid() is null or p_accept is distinct from true then raise exception 'Consentement requis'; end if;
 if length(trim(coalesce(p_full_name,'')))<3 or length(trim(coalesce(p_initials,'')))<1 or length(trim(coalesce(p_city,'')))<2
 or length(p_full_name)>200 or length(p_initials)>12 or length(p_city)>120 then raise exception 'Signature invalide'; end if;
 v_context:=public.madic_client_first_context(p_dossier_id);
 v_payment:=(v_context->>'payment_id')::uuid; v_payment_time:=(v_context->>'payment_updated_at')::timestamptz; v_tariff:=v_context->>'tariff_code';
 if jsonb_typeof(p_snapshot) is distinct from 'object' or length(coalesce(p_snapshot->>'html',''))<500 or length(p_snapshot::text)>6000000
 then raise exception 'Document invalide'; end if;
 if p_snapshot->>'tariff_code' is distinct from v_tariff or p_snapshot->>'client_id' is distinct from auth.uid()::text
 or p_snapshot->>'dossier_id' is distinct from p_dossier_id::text
 or p_snapshot->>'consultant_name' is distinct from v_context->>'consultant_name'
 or p_snapshot->>'consultant_license' is distinct from v_context->>'license_number'
 then raise exception 'Donnees du contrat non concordantes'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_payment::text,0));
 select id into v_existing from public.madic_initial_contracts where client_id=auth.uid() and payment_updated_at=v_payment_time and signature_flow='client_to_cric';
 if v_existing is not null then raise exception 'Cette demande possede deja un contrat signe. Contactez votre CRIC pour une nouvelle demande.'; end if;
 insert into public.madic_initial_contracts(space_id,client_id,dossier_id,created_by,signature_flow,payment_id,payment_updated_at,status,document_snapshot,client_signed_name,client_initials,client_signature_city,signed_digest)
 values ((v_context->>'space_id')::uuid,auth.uid(),p_dossier_id,(select owner_user_id from public.madic_cric_spaces where id=(v_context->>'space_id')::uuid),'client_to_cric',v_payment,v_payment_time,'client_signe',p_snapshot,trim(p_full_name),trim(p_initials),trim(p_city),encode(digest(p_snapshot::text,'sha256'),'hex')) returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.madic_client_first_sign(uuid,jsonb,text,text,text,boolean) from public,anon;
grant execute on function public.madic_client_first_sign(uuid,jsonb,text,text,text,boolean) to authenticated;

-- Contresignature du CRIC, sans alteration de la signature client ni du snapshot.
create or replace function public.madic_client_first_countersign(p_contract_id uuid,p_city text,p_accept boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c record; a record;
begin
 if auth.uid() is null or p_accept is distinct from true or length(trim(coalesce(p_city,'')))<2 or length(p_city)>120
 then raise exception 'Consentement ou ville invalide'; end if;
 select * into c from public.madic_initial_contracts where id=p_contract_id for update;
 if not found or c.signature_flow<>'client_to_cric' or c.status<>'client_signe' or public.madic_can_manage_cric_space(c.space_id) is distinct from true then
 raise exception 'Contrat non disponible pour contresignature'; end if;
 select full_name,license_number into a from public.madic_cric_applications where user_id=auth.uid() and status='approved';
 if a.full_name is null or a.license_number is null or c.document_snapshot->>'consultant_name' is distinct from a.full_name
 or c.document_snapshot->>'consultant_license' is distinct from a.license_number then raise exception 'Identite professionnelle non verifiee'; end if;
 update public.madic_initial_contracts set status='deux_signatures',cric_signed_name=a.full_name,cric_signature_city=trim(p_city),cric_signed_at=now() where id=p_contract_id and signature_flow='client_to_cric';
end;$$;
revoke all on function public.madic_client_first_countersign(uuid,text,boolean) from public,anon;
grant execute on function public.madic_client_first_countersign(uuid,text,boolean) to authenticated;

