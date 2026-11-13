-- Executer dans Supabase SQL Editor. Aucun acces anonyme a la liste des prevalidations.
CREATE OR REPLACE FUNCTION public.madic_admin_list_cric_prevalidations()
RETURNS TABLE(id uuid, full_name text, license_number text, registry_verified boolean, status text, created_at timestamptz, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.madic_is_super_admin() THEN
    RAISE EXCEPTION 'Acces reserve au super administrateur';
  END IF;
  RETURN QUERY
  SELECT DISTINCT ON (p.license_number)
    p.id, p.full_name::text, p.license_number::text, p.registry_verified,
    p.status::text, p.created_at, p.expires_at
  FROM public.madic_cric_prevalidations p
  WHERE p.registry_verified IS TRUE
  ORDER BY p.license_number, p.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.madic_admin_list_cric_prevalidations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.madic_admin_list_cric_prevalidations() TO authenticated;

-- Approuver/refuser une prevalidation ne cree ni compte Auth, ni espace CRIC.
-- L'administrateur confirme hors plateforme l'identite du titulaire avant approbation.
CREATE OR REPLACE FUNCTION public.madic_admin_review_cric_prevalidation(
  p_id uuid, p_approve boolean, p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v public.madic_cric_prevalidations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.madic_is_super_admin() THEN
    RAISE EXCEPTION 'Acces reserve au super administrateur';
  END IF;
  IF p_approve IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'Decision invalide';
  END IF;
  IF length(trim(coalesce(p_note, ''))) < 5 THEN
    RAISE EXCEPTION 'Veuillez documenter la decision (5 caracteres minimum)';
  END IF;
  SELECT * INTO v FROM public.madic_cric_prevalidations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v.registry_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Prevalidation CCIC non confirmee';
  END IF;
  IF v.status <> 'pending' THEN
    RAISE EXCEPTION 'Cette demande a deja ete traitee';
  END IF;
  IF p_approve AND v.expires_at <= now() THEN
    RAISE EXCEPTION 'Prevalidation expiree : nouvelle verification requise';
  END IF;
  UPDATE public.madic_cric_prevalidations
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
  WHERE id = p_id;
  -- Journal prive et non modifiable par les utilisateurs du portail.
  INSERT INTO public.madic_cric_prevalidation_decisions
    (prevalidation_id, decided_by, approved, note)
  VALUES (p_id, auth.uid(), p_approve, trim(p_note));
END;
$$;

CREATE TABLE IF NOT EXISTS public.madic_cric_prevalidation_decisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prevalidation_id uuid NOT NULL REFERENCES public.madic_cric_prevalidations(id),
  decided_by uuid NOT NULL,
  approved boolean NOT NULL,
  note text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.madic_cric_prevalidation_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.madic_cric_prevalidation_decisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.madic_admin_review_cric_prevalidation(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.madic_admin_review_cric_prevalidation(uuid,boolean,text) TO authenticated;
