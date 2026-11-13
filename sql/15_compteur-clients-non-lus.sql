-- ETAPE 1 : Compteur securise des clients distincts avec connexion non lue.
-- Ne change aucune politique RLS ni les permissions des autres cabinets.
CREATE OR REPLACE FUNCTION public.madic_cric_clients_connexions_non_lues(p_space_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_total bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.madic_can_manage_cric_space(p_space_id) THEN
    RAISE EXCEPTION 'Accès non autorisé au cabinet CRIC';
  END IF;
  SELECT COUNT(DISTINCT n.client_id)
    INTO v_total
  FROM public.madic_cric_notifications n
  WHERE n.space_id = p_space_id
    AND n.is_read = false
    AND n.title = 'Connexion d''un client'
    AND n.client_id IS NOT NULL;
  RETURN v_total;
END;
$function$;
REVOKE ALL ON FUNCTION public.madic_cric_clients_connexions_non_lues(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.madic_cric_clients_connexions_non_lues(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.madic_cric_clients_connexions_non_lues(uuid) TO authenticated;
