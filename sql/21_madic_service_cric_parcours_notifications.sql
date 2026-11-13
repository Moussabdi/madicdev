-- MADIC : migration additive. Ne supprime ni demande, ni contrat, ni rendez-vous.
-- Prerequis : madic_initial_service_requests.sql et madic_service_tracking.sql.
ALTER TABLE public.madic_initial_service_requests
 ADD COLUMN IF NOT EXISTS initiated_by text,
 ADD COLUMN IF NOT EXISTS payment_method text,
 ADD COLUMN IF NOT EXISTS payment_status text,
 ADD COLUMN IF NOT EXISTS payment_note text,
 ADD COLUMN IF NOT EXISTS initiated_space_id uuid;
UPDATE public.madic_initial_service_requests SET initiated_by='client' WHERE initiated_by IS NULL;
ALTER TABLE public.madic_initial_service_requests ALTER COLUMN initiated_by SET DEFAULT 'client';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='madic_service_origin_check') THEN
  ALTER TABLE public.madic_initial_service_requests ADD CONSTRAINT madic_service_origin_check CHECK (initiated_by IN ('client','cric'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='madic_service_payment_method_check') THEN
  ALTER TABLE public.madic_initial_service_requests ADD CONSTRAINT madic_service_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('interac','portail','especes'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='madic_service_payment_status_check') THEN
  ALTER TABLE public.madic_initial_service_requests ADD CONSTRAINT madic_service_payment_status_check CHECK (payment_status IS NULL OR payment_status IN ('declared','verified','pending'));
 END IF;
END $$;
-- Le CRIC peut seulement voir les clients de son cabinet actif; statut du formulaire lu au serveur.
CREATE OR REPLACE FUNCTION public.madic_service_eligible_clients(p_space_id uuid)
RETURNS TABLE(client_id uuid, client_name text, intake_status text, has_request boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.madic_can_manage_cric_space(p_space_id),false)
 OR NOT EXISTS(SELECT 1 FROM public.madic_cric_spaces s WHERE s.id=p_space_id AND s.access_status='active')
 THEN RAISE EXCEPTION 'Acces non autorise' USING errcode='42501'; END IF;
 RETURN QUERY SELECT c.client_id,
 coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),'Client')::text,
 coalesce(i.status,'not_started')::text,
 EXISTS(SELECT 1 FROM public.madic_initial_service_requests r WHERE r.user_id=c.client_id)
 FROM public.madic_cric_clients c
 LEFT JOIN public.profiles p ON p.id=c.client_id
 LEFT JOIN public.madic_client_intake i ON i.user_id=c.client_id
 WHERE c.space_id=p_space_id ORDER BY 2;
END $$;
CREATE OR REPLACE FUNCTION public.madic_service_create_by_cric(p_space_id uuid,p_client_id uuid,p_service_type text,p_payment_method text,p_payment_note text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.madic_can_manage_cric_space(p_space_id),false)
 OR NOT EXISTS(SELECT 1 FROM public.madic_cric_spaces s WHERE s.id=p_space_id AND s.access_status='active')
 OR NOT EXISTS(SELECT 1 FROM public.madic_cric_clients c WHERE c.space_id=p_space_id AND c.client_id=p_client_id)
 THEN RAISE EXCEPTION 'Acces non autorise' USING errcode='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.madic_client_intake i WHERE i.user_id=p_client_id AND i.status='submitted')
 THEN RAISE EXCEPTION 'Le formulaire du client doit etre soumis et complet' USING errcode='22023'; END IF;
 IF p_service_type NOT IN ('consultation','proposition') THEN RAISE EXCEPTION 'Service non pris en charge' USING errcode='22023'; END IF;
 IF p_payment_method NOT IN ('interac','portail','especes') THEN RAISE EXCEPTION 'Mode de paiement invalide' USING errcode='22023'; END IF;
 IF length(coalesce(p_payment_note,''))>500 THEN RAISE EXCEPTION 'Note trop longue' USING errcode='22023'; END IF;
 -- Ne jamais remplacer une demande existante (cle primaire user_id).
 INSERT INTO public.madic_initial_service_requests(user_id,service_type,updated_at,initiated_by,payment_method,payment_status,payment_note,initiated_space_id)
 VALUES(p_client_id,p_service_type,now(),'cric',p_payment_method,'declared',nullif(trim(p_payment_note),''),p_space_id)
 ON CONFLICT(user_id) DO NOTHING;
 IF NOT FOUND THEN RAISE EXCEPTION 'Une demande existe deja pour ce client; aucune donnee modifiee' USING errcode='23505'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.madic_service_eligible_clients(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.madic_service_create_by_cric(uuid,uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.madic_service_eligible_clients(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.madic_service_create_by_cric(uuid,uuid,text,text,text) TO authenticated;
-- Journal de courriels: independant des queues contrat et rendez-vous deja existantes.
CREATE TABLE IF NOT EXISTS public.madic_service_email_queue (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 client_id uuid NOT NULL, space_id uuid NOT NULL,
 recipient_user_id uuid NOT NULL, event_type text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed','skipped')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 locked_at timestamptz, sent_at timestamptz, last_error text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS madic_service_email_queue_pending_idx ON public.madic_service_email_queue(status,next_attempt_at);
ALTER TABLE public.madic_service_email_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.madic_service_email_queue FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.madic_service_queue_event(p_client_id uuid,p_space_id uuid,p_event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_owner uuid;
BEGIN
 SELECT s.owner_user_id INTO v_owner FROM public.madic_cric_spaces s WHERE s.id=p_space_id AND s.access_status='active';
 IF v_owner IS NULL OR NOT EXISTS(SELECT 1 FROM public.madic_cric_clients c WHERE c.space_id=p_space_id AND c.client_id=p_client_id) THEN RETURN; END IF;
 INSERT INTO public.madic_service_email_queue(client_id,space_id,recipient_user_id,event_type)
 VALUES(p_client_id,p_space_id,p_client_id,p_event),(p_client_id,p_space_id,v_owner,p_event);
END $$;
REVOKE ALL ON FUNCTION public.madic_service_queue_event(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.madic_service_email_on_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_space uuid;
BEGIN
 IF TG_OP='INSERT' THEN
  -- Pour les demandes CRIC, le cabinet est connu; pour les demandes client, notifier chaque cabinet lie.
  FOR v_space IN SELECT c.space_id FROM public.madic_cric_clients c JOIN public.madic_cric_spaces s ON s.id=c.space_id AND s.access_status='active'
    WHERE c.client_id=NEW.user_id AND (NEW.initiated_space_id IS NULL OR c.space_id=NEW.initiated_space_id)
  LOOP PERFORM public.madic_service_queue_event(NEW.user_id,v_space,'created'); END LOOP;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS madic_service_email_request_trigger ON public.madic_initial_service_requests;
CREATE TRIGGER madic_service_email_request_trigger AFTER INSERT ON public.madic_initial_service_requests FOR EACH ROW EXECUTE FUNCTION public.madic_service_email_on_request();
CREATE OR REPLACE FUNCTION public.madic_service_email_on_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
  PERFORM public.madic_service_queue_event(NEW.client_id,NEW.space_id,'status_'||NEW.status);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS madic_service_email_status_trigger ON public.madic_service_request_tracking;
CREATE TRIGGER madic_service_email_status_trigger AFTER UPDATE ON public.madic_service_request_tracking FOR EACH ROW EXECUTE FUNCTION public.madic_service_email_on_status();
-- Le suivi existant effectue un UPSERT: le premier statut peut etre insere plutot que mis a jour.
CREATE OR REPLACE FUNCTION public.madic_service_email_on_status_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status <> 'received' THEN PERFORM public.madic_service_queue_event(NEW.client_id,NEW.space_id,'status_'||NEW.status); END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS madic_service_email_status_insert_trigger ON public.madic_service_request_tracking;
CREATE TRIGGER madic_service_email_status_insert_trigger AFTER INSERT ON public.madic_service_request_tracking FOR EACH ROW EXECUTE FUNCTION public.madic_service_email_on_status_insert();
-- Reservation atomique des travaux, appelee seulement par la cle service_role.
CREATE OR REPLACE FUNCTION public.madic_service_claim_emails(p_limit integer DEFAULT 20)
RETURNS SETOF public.madic_service_email_queue LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Interdit' USING errcode='42501'; END IF;
 RETURN QUERY WITH picked AS (
  SELECT q.id FROM public.madic_service_email_queue q WHERE (q.status='pending' AND q.next_attempt_at<=now())
  OR (q.status='processing' AND q.locked_at<now()-interval '15 minutes')
  ORDER BY q.created_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(p_limit,1),50)
 ) UPDATE public.madic_service_email_queue q SET status='processing',locked_at=now(),attempts=q.attempts+1
 FROM picked WHERE q.id=picked.id RETURNING q.*;
END $$;
REVOKE ALL ON FUNCTION public.madic_service_claim_emails(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.madic_service_claim_emails(integer) TO service_role;
