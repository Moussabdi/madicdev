
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE public.madic_initial_contracts ADD COLUMN IF NOT EXISTS signature_flow text;
UPDATE public.madic_initial_contracts SET signature_flow='cric_to_client' WHERE signature_flow IS NULL;
ALTER TABLE public.madic_initial_contracts ALTER COLUMN signature_flow SET DEFAULT 'cric_to_client';
ALTER TABLE public.madic_initial_contracts ALTER COLUMN signature_flow SET NOT NULL;
ALTER TABLE public.madic_initial_contracts DROP CONSTRAINT IF EXISTS madic_initial_contracts_signature_flow_check;
ALTER TABLE public.madic_initial_contracts ADD CONSTRAINT madic_initial_contracts_signature_flow_check CHECK (signature_flow IN ('cric_to_client','client_to_cric'));
ALTER TABLE public.madic_initial_contracts ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.madic_service_payment_declarations(id);
ALTER TABLE public.madic_initial_contracts ADD COLUMN IF NOT EXISTS payment_updated_at timestamptz;
ALTER TABLE public.madic_initial_contracts ADD COLUMN IF NOT EXISTS cric_signed_name text;
ALTER TABLE public.madic_initial_contracts ADD COLUMN IF NOT EXISTS cric_signature_city text;
ALTER TABLE public.madic_initial_contracts ADD COLUMN IF NOT EXISTS cric_signed_at timestamptz;
-- Le statut existant 'publie'/'signe' demeure identique pour CRIC-first.
DO $$ DECLARE x record; BEGIN FOR x IN SELECT conname FROM pg_constraint WHERE conrelid='public.madic_initial_contracts'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%status%' LOOP EXECUTE format('ALTER TABLE public.madic_initial_contracts DROP CONSTRAINT %I',x.conname); END LOOP; END $$;
ALTER TABLE public.madic_initial_contracts ADD CONSTRAINT madic_initial_contracts_status_check CHECK ((signature_flow='cric_to_client' AND status IN ('publie','signe')) OR (signature_flow='client_to_cric' AND status IN ('client_signe','deux_signatures')));
-- Conserver les UUID et toutes les preuves de signature, sans ecraser les lignes existantes.
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='madic_client_first_contracts') THEN
 IF EXISTS (SELECT 1 FROM public.madic_client_first_contracts old JOIN public.madic_initial_contracts new ON new.id=old.id WHERE new.signature_flow<>'client_to_cric' OR new.document_snapshot IS DISTINCT FROM old.document_snapshot) THEN RAISE EXCEPTION 'Collision UUID ou document different: migration annulee'; END IF;
 INSERT INTO public.madic_initial_contracts(id,space_id,client_id,dossier_id,created_by,status,document_snapshot,client_signed_at,client_signed_name,client_initials,client_signature_city,signed_digest,created_at,signature_flow,payment_id,payment_updated_at,cric_signed_name,cric_signature_city,cric_signed_at)
 SELECT old.id,old.space_id,old.client_id,old.dossier_id,s.owner_user_id,old.status,old.document_snapshot,old.client_signed_at,old.client_signed_name,old.client_initials,old.client_signature_city,old.signed_digest,old.created_at,'client_to_cric',old.payment_id,old.payment_updated_at,old.cric_signed_name,old.cric_signature_city,old.cric_signed_at
 FROM public.madic_client_first_contracts old JOIN public.madic_cric_spaces s ON s.id=old.space_id ON CONFLICT(id) DO NOTHING;
 END IF; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS madic_initial_client_first_payment_unique ON public.madic_initial_contracts(client_id,payment_updated_at) WHERE signature_flow='client_to_cric';
CREATE INDEX IF NOT EXISTS madic_initial_client_first_space_idx ON public.madic_initial_contracts(space_id,status,created_at DESC) WHERE signature_flow='client_to_cric';
DROP POLICY IF EXISTS madic_initial_contracts_cric_first_read ON public.madic_initial_contracts;
CREATE POLICY madic_initial_contracts_cric_first_read ON public.madic_initial_contracts FOR SELECT TO authenticated USING (signature_flow='client_to_cric' AND public.madic_can_manage_cric_space(space_id)=true);
COMMIT;
