CREATE OR REPLACE FUNCTION public.madic_cric_can_read_client_intake(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
 SELECT EXISTS (
   SELECT 1
   FROM public.madic_cric_spaces s
   JOIN public.madic_cric_clients cc ON cc.space_id = s.id
   WHERE s.owner_user_id = (SELECT auth.uid())
     AND s.access_status = 'active'
     AND cc.client_id = p_client_id
     AND EXISTS (
       SELECT 1 FROM public.madic_cric_applications app
       WHERE app.user_id = (SELECT auth.uid()) AND app.status = 'approved'
     )
 );
$$;
REVOKE ALL ON FUNCTION public.madic_cric_can_read_client_intake(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.madic_cric_can_read_client_intake(uuid) TO authenticated;
CREATE POLICY madic_intake_cric_select_own_clients
ON public.madic_client_intake
FOR SELECT TO authenticated
USING (public.madic_cric_can_read_client_intake(user_id));
