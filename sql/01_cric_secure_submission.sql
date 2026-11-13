-- A executer dans Supabase SQL Editor AVANT le deploiement des fonctions.
ALTER TABLE public.madic_cric_prevalidations
  ADD COLUMN IF NOT EXISTS registry_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_by uuid;

-- Les prevalidations deja creees ne sont PAS automatiquement declarees verifiees.
-- Effectuer une nouvelle verification CCIC pour creer une nouvelle ligne registry_verified=true.

CREATE OR REPLACE FUNCTION public.madic_submit_verified_cric(
  p_user_id uuid,
  p_email text,
  p_token_hash text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v public.madic_cric_prevalidations%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Identite du compte incomplete';
  END IF;
  SELECT * INTO v FROM public.madic_cric_prevalidations
    WHERE lookup_token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR v.registry_verified IS DISTINCT FROM true
     OR v.expires_at <= now() OR v.status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'Prevalidation CCIC absente, non confirmee ou expiree';
  END IF;
  IF v.claimed_by IS NOT NULL AND v.claimed_by <> p_user_id THEN
    RAISE EXCEPTION 'Cette prevalidation est deja utilisee';
  END IF;
  IF EXISTS (SELECT 1 FROM public.madic_cric_applications WHERE license_number = v.license_number AND user_id <> p_user_id) THEN
    RAISE EXCEPTION 'Ce permis est deja associe a une autre demande';
  END IF;
  IF EXISTS (SELECT 1 FROM public.madic_cric_applications WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Ce compte a deja soumis une demande CRIC';
  END IF;
  UPDATE public.madic_cric_prevalidations SET claimed_by = p_user_id WHERE id = v.id;
  INSERT INTO public.madic_cric_applications
    (user_id, full_name, license_number, professional_email, status)
  VALUES (p_user_id, v.full_name, v.license_number, lower(trim(p_email)), 'pending');
END;
$$;
REVOKE ALL ON FUNCTION public.madic_submit_verified_cric(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.madic_submit_verified_cric(uuid,text,text) TO service_role;
