-- MADIC - ajout non destructif des declarations de paiement.
-- Ne modifie pas les contrats ni les demandes existantes.
CREATE TABLE IF NOT EXISTS public.madic_service_payment_declarations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 client_id uuid NOT NULL REFERENCES auth.users(id),
 service_type text NOT NULL CHECK (service_type IN ('consultation','proposition')),
 payment_timing text NOT NULL CHECK (payment_timing IN ('already','later')),
 payment_method text NOT NULL CHECK (payment_method IN ('interac','cash','western_union','portal')),
 payment_date date,
 payment_reference text,
 proof_path text,
 client_confirmed boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','declared','verified','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 verified_at timestamptz,
 verified_by uuid REFERENCES auth.users(id),
 UNIQUE(client_id)
);
CREATE INDEX IF NOT EXISTS madic_service_payment_client_idx ON public.madic_service_payment_declarations(client_id);
ALTER TABLE public.madic_service_payment_declarations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.madic_service_payment_declarations FROM anon,authenticated;
GRANT SELECT ON public.madic_service_payment_declarations TO authenticated;
DROP POLICY IF EXISTS madic_service_payment_client_read ON public.madic_service_payment_declarations;
CREATE POLICY madic_service_payment_client_read ON public.madic_service_payment_declarations FOR SELECT TO authenticated USING (
 client_id=auth.uid() OR EXISTS (
 SELECT 1 FROM public.madic_cric_clients c JOIN public.madic_cric_spaces s ON s.id=c.space_id
 WHERE c.client_id=madic_service_payment_declarations.client_id AND s.owner_user_id=auth.uid() AND s.access_status='active'
 ));
-- Storage prive: une preuve appartient au client; nom de fichier aleatoire sous son UUID.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('madic-service-payment-proofs','madic-service-payment-proofs',false,10485760,ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS madic_service_payment_upload ON storage.objects;
CREATE POLICY madic_service_payment_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='madic-service-payment-proofs' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS madic_service_payment_read ON storage.objects;
CREATE POLICY madic_service_payment_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='madic-service-payment-proofs' AND (
 (storage.foldername(name))[1]=auth.uid()::text OR EXISTS (
 SELECT 1 FROM public.madic_cric_clients c JOIN public.madic_cric_spaces s ON s.id=c.space_id
 WHERE c.client_id::text=(storage.foldername(name))[1] AND s.owner_user_id=auth.uid() AND s.access_status='active'
 )));
-- RPC: seule l'identite connectee peut declarer son paiement; jamais auto-valide.
CREATE OR REPLACE FUNCTION public.madic_service_submit_payment(
 p_timing text,p_method text,p_payment_date date DEFAULT NULL,p_reference text DEFAULT NULL,p_proof_path text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_service text; v_id uuid; v_status text;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Connexion requise' USING errcode='42501'; END IF;
 SELECT r.service_type INTO v_service FROM public.madic_initial_service_requests r WHERE r.user_id=v_user;
 IF v_service IS NULL THEN RAISE EXCEPTION 'Demande de service introuvable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.madic_client_intake i WHERE i.user_id=v_user AND i.status='submitted') THEN
 RAISE EXCEPTION 'Formulaire non soumis'; END IF;
 IF p_timing NOT IN ('already','later') OR p_method NOT IN ('interac','cash','western_union','portal') THEN
 RAISE EXCEPTION 'Choix de paiement invalide'; END IF;
 IF p_timing='later' AND p_method='portal' THEN RAISE EXCEPTION 'Paiement en ligne indisponible : session securisee non configuree'; END IF;
 IF length(coalesce(p_reference,''))>200 THEN RAISE EXCEPTION 'Reference trop longue'; END IF;
 IF p_timing='already' THEN
   IF p_payment_date IS NULL OR p_payment_date>current_date OR p_payment_date<date '2000-01-01' THEN
     RAISE EXCEPTION 'Date de paiement invalide'; END IF;
   IF nullif(trim(coalesce(p_reference,'')),'') IS NULL THEN RAISE EXCEPTION 'Reference obligatoire'; END IF;
   IF p_proof_path IS NULL OR split_part(p_proof_path,'/',1)<>v_user::text OR NOT EXISTS (
     SELECT 1 FROM storage.objects o WHERE o.bucket_id='madic-service-payment-proofs' AND o.name=p_proof_path
   ) THEN RAISE EXCEPTION 'Preuve de paiement obligatoire'; END IF;
 ELSE
   IF p_payment_date IS NOT NULL OR p_proof_path IS NOT NULL THEN RAISE EXCEPTION 'Paiement non encore effectue'; END IF;
 END IF;
 v_status:=CASE WHEN p_timing='already' THEN 'declared' ELSE 'pending' END;
 -- Interdire de modifier une confirmation deja verifiee.
 IF EXISTS(SELECT 1 FROM public.madic_service_payment_declarations WHERE client_id=v_user AND status='verified') THEN
 RAISE EXCEPTION 'Paiement confirme : contactez votre CRIC pour toute modification'; END IF;
 INSERT INTO public.madic_service_payment_declarations(client_id,service_type,payment_timing,payment_method,payment_date,payment_reference,proof_path,client_confirmed,status)
 VALUES(v_user,v_service,p_timing,p_method,p_payment_date,nullif(trim(coalesce(p_reference,'')),''),p_proof_path,true,v_status)
 ON CONFLICT(client_id) DO UPDATE SET
 service_type=EXCLUDED.service_type,payment_timing=EXCLUDED.payment_timing,payment_method=EXCLUDED.payment_method,
 payment_date=EXCLUDED.payment_date,payment_reference=EXCLUDED.payment_reference,proof_path=EXCLUDED.proof_path,
 client_confirmed=true,status=EXCLUDED.status,updated_at=now(),verified_at=NULL,verified_by=NULL
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.madic_service_submit_payment(text,text,date,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.madic_service_submit_payment(text,text,date,text,text) TO authenticated;
