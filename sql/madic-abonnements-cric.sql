-- Exécuter dans Supabase SQL Editor après vérification des autorisations existantes.
-- Fonction d'écriture réservée aux super administrateurs.
BEGIN;
CREATE OR REPLACE FUNCTION public.madic_update_cric_subscription(
  p_space_id uuid,
  p_plan text,
  p_payment_status text,
  p_access_status text,
  p_next_payment_due date DEFAULT NULL,
  p_suspension_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.madic_super_admins WHERE user_id=auth.uid()
  ) THEN
    RAISE EXCEPTION 'Accès interdit';
  END IF;
  IF p_plan NOT IN ('free','paid') OR
     p_payment_status NOT IN ('not_applicable','current','overdue') OR
     p_access_status NOT IN ('active','suspended') THEN
    RAISE EXCEPTION 'Valeur d’abonnement invalide';
  END IF;
  IF (p_plan='free' AND (p_payment_status<>'not_applicable' OR p_next_payment_due IS NOT NULL)) OR
     (p_plan='paid' AND p_payment_status='not_applicable') THEN
    RAISE EXCEPTION 'Formule et paiement incompatibles';
  END IF;
  UPDATE public.madic_cric_spaces
  SET subscription_plan=p_plan,
      payment_status=p_payment_status,
      access_status=p_access_status,
      next_payment_due=p_next_payment_due,
      suspended_at=CASE WHEN p_access_status='suspended'
                        THEN COALESCE(suspended_at,now()) ELSE NULL END,
      suspension_reason=CASE WHEN p_access_status='suspended'
                             THEN NULLIF(trim(p_suspension_reason),'') ELSE NULL END
  WHERE id=p_space_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Espace CRIC introuvable'; END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.madic_update_cric_subscription(uuid,text,text,text,date,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.madic_update_cric_subscription(uuid,text,text,text,date,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.madic_update_cric_subscription(uuid,text,text,text,date,text) TO authenticated;
COMMIT;
-- IMPORTANT : ceci n'empêche pas les modifications directes si des politiques UPDATE
-- sur madic_cric_spaces les autorisent. Auditer ces politiques et les privilèges.
-- IMPORTANT : les politiques RLS sur dossiers/documents/contrats/Storage doivent
-- encore refuser l'accès professionnel aux espaces suspendus.
