-- MADIC : lecture securisee des PDF de contrats initiaux signes.
-- Ne modifie ni les signatures, ni les fichiers, ni les autres politiques.
-- Le CRIC doit pouvoir gerer l'espace du dossier correspondant.

DROP POLICY IF EXISTS "madic_cric_read_signed_initial_contract_pdf" ON storage.objects;
CREATE POLICY "madic_cric_read_signed_initial_contract_pdf"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'madic-documents'
  AND EXISTS (
    SELECT 1
    FROM public.madic_initial_contracts AS c
    JOIN public.dossiers AS d
      ON d.id = c.dossier_id
     AND d.client_id = c.client_id
    WHERE c.status = 'signe'
      AND name = ('contrats-signes/' || c.client_id::text || '/' || c.id::text || '.pdf')
      AND public.madic_can_manage_cric_space(d.space_id) = true
  )
);

-- Controle non destructif : existence reelle du PDF du contrat concerne.
SELECT name, bucket_id, created_at, metadata->>'size' AS size_bytes
FROM storage.objects
WHERE bucket_id = 'madic-documents'
  AND name = 'contrats-signes/6d077aa2-87d3-404e-beca-63fa79f64d78/8a41961c-b230-46dd-8556-8229bc6c8d23.pdf';
