-- MADIC Phase 3.2. Testez d'abord dans un environnement de test.
-- Lecture réservée au client authentifié, dans son cabinet, pour les factures émises.
-- Ne crée aucune politique RLS générale sur les factures.
create or replace function public.madic_my_issued_invoices(p_space_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if not exists (
    select 1 from public.madic_cric_clients cc
    join public.madic_cric_spaces s on s.id = cc.space_id
    where cc.space_id = p_space_id
      and cc.client_id = auth.uid()
      and s.access_status = 'active'
  ) then raise exception 'Cabinet non autorisé'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'invoice_number', i.invoice_number,
    'issued_on', i.issued_on, 'due_on', i.due_on,
    'description', i.description, 'items', i.items,
    'currency', i.currency, 'amount_cents', i.amount_cents,
    'tax_rate', i.tax_rate, 'paid_cents', i.paid_cents,
    'status', i.status, 'cabinet_name', i.cabinet_name,
    'cabinet_address', i.cabinet_address,
    'cabinet_tax_numbers', i.cabinet_tax_numbers,
    'notes', i.notes, 'logo_data_url', i.logo_data_url
  ) order by i.issued_on desc, i.invoice_number desc), '[]'::jsonb)
  into result
  from public.madic_cric_invoices i
  where i.space_id = p_space_id
    and i.client_id = auth.uid()
    and i.status = 'issued';
  return result;
end;
$$;
revoke all on function public.madic_my_issued_invoices(uuid) from public;
revoke all on function public.madic_my_issued_invoices(uuid) from anon;
grant execute on function public.madic_my_issued_invoices(uuid) to authenticated;
