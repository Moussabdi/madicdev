-- MADIC : une notification par nouvelle session d'authentification Supabase.
-- A executer dans Supabase SQL Editor AVANT de deployer les JS.
-- session_id provient du JWT valide par Supabase (jamais d'un parametre client).
ALTER TABLE public.madic_client_activity_logs
  ADD COLUMN IF NOT EXISTS auth_session_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS madic_client_login_unique_auth_session
ON public.madic_client_activity_logs(space_id, client_id, auth_session_id)
WHERE event_type = 'portal_login' AND auth_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.madic_record_client_portal_login()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
 v_client_id uuid := auth.uid();
 v_session_id uuid;
 v_space_id uuid;
 v_activity_id uuid;
 v_count integer := 0;
BEGIN
 IF v_client_id IS NULL THEN
  RAISE EXCEPTION 'Authentification requise';
 END IF;
 -- Supabase Auth emet session_id dans le JWT pour une session utilisateur.
 IF COALESCE(auth.jwt()->>'session_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
  RAISE EXCEPTION 'Identifiant de session Supabase indisponible';
 END IF;
 v_session_id := (auth.jwt()->>'session_id')::uuid;

 FOR v_space_id IN
  SELECT DISTINCT c.space_id
  FROM public.madic_cric_clients c
  JOIN public.madic_cric_spaces s ON s.id = c.space_id
  WHERE c.client_id = v_client_id AND s.access_status = 'active'
 LOOP
  -- Verrou de concurrence pour ne pas creer deux evenements pour la meme session.
  PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(v_client_id::text || ':' || v_space_id::text || ':' || v_session_id::text, 0)
  );
  IF EXISTS (
   SELECT 1 FROM public.madic_client_activity_logs a
   WHERE a.client_id = v_client_id AND a.space_id = v_space_id
     AND a.event_type = 'portal_login' AND a.auth_session_id = v_session_id
  ) THEN CONTINUE; END IF;

  INSERT INTO public.madic_client_activity_logs
    (space_id, client_id, event_type, event_description, auth_session_id)
  VALUES
    (v_space_id, v_client_id, 'portal_login',
     'Le client s''est connecte a son portail.', v_session_id)
  RETURNING id INTO v_activity_id;

  INSERT INTO public.madic_cric_notifications
    (space_id, client_id, activity_id, title, message)
  VALUES
    (v_space_id, v_client_id, v_activity_id,
     'Connexion d''un client',
     'Un client de votre cabinet s''est connecte a son portail MADIC.');
  v_count := v_count + 1;
 END LOOP;
 RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.madic_record_client_portal_login() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.madic_record_client_portal_login() FROM anon;
GRANT EXECUTE ON FUNCTION public.madic_record_client_portal_login() TO authenticated;
