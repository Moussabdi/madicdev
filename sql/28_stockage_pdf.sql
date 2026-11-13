drop policy if exists madic_client_first_pdf_upload on storage.objects;
create policy madic_client_first_pdf_upload on storage.objects for insert to authenticated with check (
 bucket_id='madic-documents' and exists(select 1 from public.madic_initial_contracts c
 where c.signature_flow='client_to_cric' and c.status='deux_signatures' and public.madic_can_manage_cric_space(c.space_id)=true
 and name='contrats-client-cric/'||c.client_id::text||'/'||c.id::text||'.pdf')
);
drop policy if exists madic_client_first_pdf_read on storage.objects;
create policy madic_client_first_pdf_read on storage.objects for select to authenticated using (
 bucket_id='madic-documents' and exists(select 1 from public.madic_initial_contracts c
 where c.signature_flow='client_to_cric' and c.status='deux_signatures' and (c.client_id=auth.uid() or public.madic_can_manage_cric_space(c.space_id)=true)
 and name='contrats-client-cric/'||c.client_id::text||'/'||c.id::text||'.pdf')
);
