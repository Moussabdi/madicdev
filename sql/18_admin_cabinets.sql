-- MADIC : gestion des cabinets par super administrateur uniquement.
-- A executer avec le role administrateur Supabase dans SQL Editor.
-- Les paiements reels ne sont pas encaisses ni confirmes par cette fonction.
CREATE OR REPLACE FUNCTION public.madic_admin_manage_cabinet(
  p_user_id uuid,
  p_action text,
  p_plan text DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_space public.madic_cric_spaces%ROWTYPE;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR public.madic_is_super_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Acces super administrateur requis' USING ERRCODE='42501';
  END IF;
  IF p_action NOT IN ('create','plan','suspend','activate') THEN
    RAISE EXCEPTION 'Action invalide';
  END IF;
  -- Serialize actions on a given consultant to prevent concurrent duplicate cabinets.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 94127));
  IF NOT EXISTS (
    SELECT 1 FROM public.madic_cric_applications a
    WHERE a.user_id=p_user_id AND a.status='approved'
  ) THEN RAISE EXCEPTION 'Demande CRIC non approuvee'; END IF;
  SELECT * INTO v_space FROM public.madic_cric_spaces
  WHERE owner_user_id=p_user_id FOR UPDATE;
  IF p_action='create' THEN
    IF v_space.id IS NOT NULL THEN RAISE EXCEPTION 'Cabinet deja existant'; END IF;
    -- Only approved, linked and verified prevalidations may be provisioned.
    IF NOT EXISTS (
      SELECT 1 FROM public.madic_cric_prevalidations p
      JOIN public.madic_cric_applications a ON a.user_id=p_user_id AND a.license_number=p.license_number
      WHERE p.claimed_by=p_user_id AND p.status='approved' AND p.registry_verified=true
    ) THEN RAISE EXCEPTION 'Prevalidation non verifiee ou non associee'; END IF;
    INSERT INTO public.madic_cric_spaces(owner_user_id,name,subscription_plan,payment_status,access_status)
    SELECT a.user_id,a.full_name,'free','not_applicable','active'
    FROM public.madic_cric_applications a WHERE a.user_id=p_user_id
    RETURNING id INTO v_id;
    INSERT INTO public.madic_cric_memberships(space_id,user_id,role)
    VALUES(v_id,p_user_id,'owner');
    RETURN v_id;
  END IF;
  IF v_space.id IS NULL THEN RAISE EXCEPTION 'Cabinet inexistant'; END IF;
  IF p_action='plan' THEN
    IF p_plan NOT IN ('free','paid') THEN RAISE EXCEPTION 'Formule invalide'; END IF;
    IF p_plan='free' THEN
      UPDATE public.madic_cric_spaces SET subscription_plan='free',payment_status='not_applicable',next_payment_due=NULL
      WHERE id=v_space.id;
    ELSE
      -- Never mark a paid subscription as paid without a verified transaction.
      -- Keep access suspended until payment is confirmed through a separate process.
      UPDATE public.madic_cric_spaces SET subscription_plan='paid',payment_status='pending',access_status='suspended',
        suspended_at=pg_catalog.now(),suspension_reason='Paiement requis avant activation',next_payment_due=NULL
      WHERE id=v_space.id;
    END IF;
  ELSIF p_action='suspend' THEN
    IF pg_catalog.length(pg_catalog.btrim(p_reason)) < 3 THEN RAISE EXCEPTION 'Motif de suspension requis'; END IF;
    UPDATE public.madic_cric_spaces SET access_status='suspended',suspended_at=pg_catalog.now(),suspension_reason=p_reason
    WHERE id=v_space.id;
  ELSIF p_action='activate' THEN
    IF v_space.subscription_plan <> 'free' THEN
      RAISE EXCEPTION 'Activation payante indisponible avant integration du suivi des paiements';
    END IF;
    UPDATE public.madic_cric_spaces SET access_status='active',suspended_at=NULL,suspension_reason=NULL
    WHERE id=v_space.id;
  END IF;
  RETURN v_space.id;
END;
$$;
REVOKE ALL ON FUNCTION public.madic_admin_manage_cabinet(uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.madic_admin_manage_cabinet(uuid,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.madic_admin_manage_cabinet(uuid,text,text,text) TO authenticated;
