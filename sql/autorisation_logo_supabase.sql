CREATE OR REPLACE FUNCTION public.madic_client_first_logo_path(p_space_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
 SELECT p.logo_path
 FROM public.madic_cric_professional_profiles AS p
 WHERE p.space_id = p_space_id
   AND auth.uid() IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM public.madic_cric_clients AS cc
     WHERE cc.space_id = p.space_id AND cc.client_id = auth.uid()
   )
 LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.madic_client_first_logo_path(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.madic_client_first_logo_path(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.madic_client_can_read_cric_logo(p_bucket text, p_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
 SELECT p_bucket = 'madic-cric-branding'
   AND auth.uid() IS NOT NULL
   AND EXISTS (
     SELECT 1
     FROM public.madic_cric_professional_profiles AS p
     JOIN public.madic_cric_clients AS cc ON cc.space_id = p.space_id
     WHERE cc.client_id = auth.uid()
       AND p.logo_path = p_name
       AND p.logo_path IS NOT NULL
       AND p.logo_path <> ''
   )
$$;
REVOKE ALL ON FUNCTION public.madic_client_can_read_cric_logo(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.madic_client_can_read_cric_logo(text,text) TO authenticated;

DROP POLICY IF EXISTS "madic_client_read_associated_cric_logo" ON storage.objects;
CREATE POLICY "madic_client_read_associated_cric_logo"
ON storage.objects FOR SELECT TO authenticated
USING (public.madic_client_can_read_cric_logo(bucket_id, name));
