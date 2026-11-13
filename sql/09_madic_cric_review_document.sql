-- Exécuter dans Supabase SQL Editor. Ne modifie ni les RLS ni les données.
-- Nécessite public.documents.review_status et review_reason (déjà présents).
CREATE OR REPLACE FUNCTION public.madic_cric_review_document(
  p_document_id uuid, p_status text, p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_updated integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('accepte', 'refuse') THEN
    RAISE EXCEPTION 'Évaluation invalide';
  END IF;
  IF p_status = 'refuse' AND (p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000) THEN
    RAISE EXCEPTION 'Motif du refus obligatoire (1 à 1000 caractères)';
  END IF;
  -- La propriété du cabinet, son activité, l'approbation CRIC, l'association
  -- du client et l'appartenance du document au dossier sont contrôlées en base.
  UPDATE public.documents AS doc
     SET review_status = p_status,
         review_reason = CASE WHEN p_status = 'refuse' THEN btrim(p_reason) ELSE NULL END
   WHERE doc.id = p_document_id
     AND EXISTS (
       SELECT 1
         FROM public.dossiers AS d
         JOIN public.madic_cric_spaces AS s ON s.id = d.space_id
         JOIN public.madic_cric_clients AS cc ON cc.space_id = s.id AND cc.client_id = d.client_id
         JOIN public.madic_cric_applications AS app ON app.user_id = s.owner_user_id
        WHERE d.id = doc.dossier_id
          AND d.client_id = doc.client_id
          AND s.owner_user_id = (SELECT auth.uid())
          AND s.access_status = 'active'
          AND app.status = 'approved'
     );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.madic_cric_review_document(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.madic_cric_review_document(uuid,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.madic_cric_review_document(uuid,text,text) TO authenticated;
