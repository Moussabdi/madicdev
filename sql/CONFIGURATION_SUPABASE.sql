-- À exécuter une seule fois dans Supabase SQL Editor.
-- Les logos sont publics en lecture; écriture réservée au rôle admin.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('madic-contract-logos','madic-contract-logos',true,2097152,ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=true,file_size_limit=2097152,allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS madic_logos_admin_insert ON storage.objects;
DROP POLICY IF EXISTS madic_logos_admin_update ON storage.objects;
DROP POLICY IF EXISTS madic_logos_admin_delete ON storage.objects;
CREATE POLICY madic_logos_admin_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='madic-contract-logos' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin'));
CREATE POLICY madic_logos_admin_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='madic-contract-logos' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin'))
WITH CHECK (bucket_id='madic-contract-logos' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin'));
CREATE POLICY madic_logos_admin_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='madic-contract-logos' AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin'));
