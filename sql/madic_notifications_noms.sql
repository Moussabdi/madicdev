CREATE OR REPLACE FUNCTION public.madic_cric_notifications_avec_clients(p_space_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  message text,
  is_read boolean,
  created_at timestamptz,
  client_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.madic_can_manage_cric_space(p_space_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Accès non autorisé au cabinet CRIC';
  END IF;

  RETURN QUERY
  SELECT n.id, n.title::text, n.message::text, n.is_read, n.created_at,
         CASE WHEN EXISTS (
           SELECT 1
           FROM public.madic_cric_clients c
           WHERE c.space_id = n.space_id AND c.client_id = n.client_id
         ) THEN COALESCE(
           NULLIF(concat_ws(' ', NULLIF(btrim(p.first_name), ''), NULLIF(btrim(p.last_name), '')), ''),
           NULLIF(btrim(u.email::text), ''),
           NULLIF(btrim(p.email), '')
         ) END AS client_name
  FROM public.madic_cric_notifications n
  LEFT JOIN public.profiles p ON p.id = n.client_id
  LEFT JOIN auth.users u ON u.id = n.client_id
  LEFT JOIN public.madic_client_activity_logs a
    ON a.id = n.activity_id
    AND a.space_id = n.space_id
    AND a.client_id = n.client_id
  WHERE n.space_id = p_space_id
    AND (
      a.event_type = 'portal_login'
      OR (n.activity_id IS NULL AND n.title = 'Connexion d''un client')
    )
  ORDER BY n.created_at DESC, n.id DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.madic_cric_notifications_avec_clients(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.madic_cric_notifications_avec_clients(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.madic_cric_notifications_avec_clients(uuid) TO authenticated;
