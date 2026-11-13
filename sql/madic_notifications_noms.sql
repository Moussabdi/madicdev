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
  IF auth.uid() IS NULL OR NOT public.madic_can_manage_cric_space(p_space_id) THEN
    RAISE EXCEPTION 'Accès non autorisé au cabinet CRIC';
  END IF;

  RETURN QUERY
  SELECT n.id, n.title::text, n.message::text, n.is_read, n.created_at,
         NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), '')::text AS client_name
  FROM public.madic_cric_notifications n
  LEFT JOIN public.madic_cric_clients c
    ON c.space_id = n.space_id AND c.client_id = n.client_id
  LEFT JOIN public.profiles p ON p.id = c.client_id
  WHERE n.space_id = p_space_id
  ORDER BY n.created_at DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.madic_cric_notifications_avec_clients(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.madic_cric_notifications_avec_clients(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.madic_cric_notifications_avec_clients(uuid) TO authenticated;
