-- A executer dans Supabase SQL Editor apres avoir verifie les politiques existantes.
-- La fonction de signature existante n'est pas remplacee.
-- Corrige la resolution de pgcrypto.digest() si pgcrypto est dans extensions.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto' AND n.nspname='extensions') THEN
   RAISE EXCEPTION 'pgcrypto doit etre installe dans le schema extensions. Verifier pg_extension avant execution.';
 END IF;
END $$;
ALTER FUNCTION public.madic_sign_initial_contract(uuid,text,text,text,boolean)
 SET search_path = public, extensions, pg_temp;

-- Upload exclusivement par le signataire de son contrat signe.
-- Le bucket madic-documents doit exister (prive).
DROP POLICY IF EXISTS "madic_signed_initial_contract_pdf_upload" ON storage.objects;
CREATE POLICY "madic_signed_initial_contract_pdf_upload" ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (
 bucket_id='madic-documents' AND
 EXISTS (
   SELECT 1 FROM public.madic_initial_contracts c
   WHERE c.client_id=(SELECT auth.uid()) AND c.status='signe'
     AND name=('contrats-signes/' || c.client_id::text || '/' || c.id::text || '.pdf')
 )
);

-- Inscription dans public.documents seulement apres verification de l'objet stocke.
-- Fonction SECURITY DEFINER: acces autorise exclusivement au client signataire.
CREATE OR REPLACE FUNCTION public.madic_archive_signed_initial_contract(p_contract_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,storage,pg_temp
AS $$
DECLARE c record; v_path text; v_object record; v_doc uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
 SELECT id,client_id,dossier_id,status INTO c
 FROM public.madic_initial_contracts
 WHERE id=p_contract_id AND client_id=auth.uid() AND status='signe';
 IF NOT FOUND THEN RAISE EXCEPTION 'Contrat signe inaccessible'; END IF;
 IF c.dossier_id IS NULL THEN RAISE EXCEPTION 'Dossier manquant pour ce contrat'; END IF;
 v_path := 'contrats-signes/'||c.client_id::text||'/'||c.id::text||'.pdf';
 SELECT id,metadata INTO v_object FROM storage.objects
 WHERE bucket_id='madic-documents' AND name=v_path;
 IF NOT FOUND THEN RAISE EXCEPTION 'PDF non trouve dans le stockage prive'; END IF;
 IF COALESCE((v_object.metadata->>'size')::bigint,0) <= 0 THEN
  RAISE EXCEPTION 'Fichier PDF vide';
 END IF;
 SELECT id INTO v_doc FROM public.documents
 WHERE dossier_id=c.dossier_id AND client_id=c.client_id AND storage_path=v_path
 LIMIT 1;
 IF v_doc IS NOT NULL THEN RETURN v_doc; END IF;
 INSERT INTO public.documents
 (dossier_id,client_id,original_name,storage_path,mime_type,size_bytes,status,review_status)
 VALUES (c.dossier_id,c.client_id,'Contrat_initial_signe_'||c.id::text||'.pdf',v_path,
 'application/pdf',(v_object.metadata->>'size')::bigint,'recu','en_attente')
 RETURNING id INTO v_doc;
 RETURN v_doc;
END $$;
REVOKE ALL ON FUNCTION public.madic_archive_signed_initial_contract(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.madic_archive_signed_initial_contract(uuid) TO authenticated;
