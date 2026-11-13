-- Exécuter dans Supabase SQL Editor avant de remplacer les fichiers.
-- Préserve les données et les politiques RLS existantes.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'en_attente',
  ADD COLUMN IF NOT EXISTS review_reason text;

-- Valeurs autorisées pour la décision administrative.
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_review_status_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_review_status_check
  CHECK (review_status IN ('en_attente','accepte','refuse'));
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_review_reason_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_review_reason_check
  CHECK (review_status <> 'refuse' OR (review_reason IS NOT NULL AND length(btrim(review_reason)) BETWEEN 1 AND 1000));

GRANT SELECT (review_status,review_reason) ON public.documents TO authenticated;
-- Ces deux colonnes sont modifiables uniquement via les privilèges SQL
-- accordés au rôle authentifié; l'autorisation effective dépend de RLS.
-- Pour empêcher un client de modifier sa propre décision, utiliser une
-- fonction SECURITY DEFINER dédiée au contrôle administratif ci-dessous.
CREATE OR REPLACE FUNCTION public.madic_review_document(p_id uuid, p_dossier_id uuid, p_status text, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  IF NOT (SELECT public.is_madic_admin()) THEN
    RAISE EXCEPTION 'Accès administrateur requis';
  END IF;
  IF p_status NOT IN ('accepte','refuse') THEN
    RAISE EXCEPTION 'Décision invalide';
  END IF;
  IF p_status = 'refuse' AND (p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000) THEN
    RAISE EXCEPTION 'Motif du refus obligatoire';
  END IF;
  UPDATE public.documents SET review_status=p_status,
    review_reason=CASE WHEN p_status='refuse' THEN btrim(p_reason) ELSE NULL END
  WHERE id=p_id AND dossier_id=p_dossier_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count=1;
END; $$;
REVOKE ALL ON FUNCTION public.madic_review_document(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.madic_review_document(uuid,uuid,text,text) TO authenticated;

-- Lors du remplacement d'un fichier, le nouveau document repasse à vérifier.
CREATE OR REPLACE FUNCTION public.madic_reset_review_on_replace()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
    NEW.review_status := 'en_attente';
    NEW.review_reason := NULL;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS madic_reset_review_on_replace ON public.documents;
CREATE TRIGGER madic_reset_review_on_replace BEFORE UPDATE OF storage_path
ON public.documents FOR EACH ROW EXECUTE FUNCTION public.madic_reset_review_on_replace();
