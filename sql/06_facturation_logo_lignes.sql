-- MADIC Phase 3.1. Appliquer APRES 05_facturation_cric.sql, en environnement de test.
-- Les factures existantes restent lisibles : si items est NULL, le PDF utilise description/amount_cents.
alter table public.madic_cric_invoices add column if not exists items jsonb;
alter table public.madic_cric_invoices add column if not exists logo_data_url text;
-- Le logo est un instantané propre à chaque facture (PNG/JPG <= 100 Ko avant encodage).
create or replace function public.madic_create_cric_invoice_v2(
 p_space_id uuid,p_client_id uuid,p_dossier_id uuid,p_items jsonb,
 p_tax_rate numeric,p_due_on date,p_cabinet_name text,
 p_cabinet_address text default null,p_cabinet_tax_numbers text default null,
 p_notes text default null,p_logo_data_url text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare n bigint; result uuid; item jsonb; descr text; q bigint; price bigint; subtotal bigint:=0; count_items integer:=0;
begin
 if auth.uid() is null or not public.madic_invoice_space_allowed(p_space_id,p_client_id,p_dossier_id) then raise exception 'Accès refusé'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Lignes invalides'; end if;
 if p_tax_rate is null or p_tax_rate<0 or p_tax_rate>1 or length(trim(coalesce(p_cabinet_name,''))) not between 1 and 200 then raise exception 'Paramètres invalides'; end if;
 if length(coalesce(p_cabinet_address,''))>500 or length(coalesce(p_cabinet_tax_numbers,''))>200 or length(coalesce(p_notes,''))>1000 then raise exception 'Texte trop long'; end if;
 if p_logo_data_url is not null and (length(p_logo_data_url)>140000 or p_logo_data_url !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$') then raise exception 'Logo invalide'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'description')<>'string' or jsonb_typeof(item->'quantity')<>'number' or jsonb_typeof(item->'unit_price_cents')<>'number' then raise exception 'Format de ligne invalide'; end if;
  descr:=trim(item->>'description');
  if length(descr) not between 1 and 500 or (item->>'quantity') !~ '^[0-9]+$' or (item->>'unit_price_cents') !~ '^[0-9]+$' then raise exception 'Ligne invalide'; end if;
  q:=(item->>'quantity')::bigint;price:=(item->>'unit_price_cents')::bigint;
  if q<1 or q>100000 or price<0 or price>10000000000 then raise exception 'Montant de ligne invalide'; end if;
  subtotal:=subtotal+q*price;
  if subtotal>10000000000 then raise exception 'Total trop élevé'; end if;
  count_items:=count_items+1;
 end loop;
 insert into public.madic_cric_invoice_sequences(space_id,next_number) values(p_space_id,2)
 on conflict(space_id) do update set next_number=public.madic_cric_invoice_sequences.next_number+1
 returning next_number-1 into n;
 insert into public.madic_cric_invoices(space_id,client_id,dossier_id,invoice_number,description,amount_cents,tax_rate,due_on,cabinet_name,cabinet_address,cabinet_tax_numbers,notes,items,logo_data_url)
 values(p_space_id,p_client_id,p_dossier_id,'FAC-'||extract(year from current_date)::text||'-'||lpad(n::text,5,'0'),left(p_items->0->>'description',1000),subtotal,p_tax_rate,p_due_on,trim(p_cabinet_name),p_cabinet_address,p_cabinet_tax_numbers,p_notes,p_items,p_logo_data_url)
 returning id into result;
 return result;
end $$;
revoke all on function public.madic_create_cric_invoice_v2(uuid,uuid,uuid,jsonb,numeric,date,text,text,text,text,text) from public;
grant execute on function public.madic_create_cric_invoice_v2(uuid,uuid,uuid,jsonb,numeric,date,text,text,text,text,text) to authenticated;
-- Important : la politique RLS existante et madic_invoice_space_allowed doivent être auditées.
