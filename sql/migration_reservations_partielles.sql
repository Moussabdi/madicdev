-- MADIC | Migration additive de reservations partielles (1h / 2h)
-- Executer dans Supabase SQL Editor, une seule fois.
-- Prerequis verifies: starts_at/ends_at sur appointments, contrainte madic_rdv_no_overlap.
BEGIN;

-- Les disponibilites du CRIC restent des plages; le client reserve une periode dans la plage.
CREATE OR REPLACE FUNCTION public.madic_rdv_available_periods(
  p_space_id uuid, p_duration_minutes integer DEFAULT 60
)
RETURNS TABLE(id uuid, starts_at timestamptz, ends_at timestamptz, mode text, is_open boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR NOT public.madic_rdv_is_client(p_space_id)
     OR NOT EXISTS (SELECT 1 FROM public.madic_cric_spaces c
                    WHERE c.id=p_space_id AND c.access_status='active') THEN
    RAISE EXCEPTION 'Acces non autorise' USING ERRCODE='42501';
  END IF;
  IF p_duration_minutes NOT IN (60,120) OR p_duration_minutes IS NULL THEN
    RAISE EXCEPTION 'Duree invalide';
  END IF;
  RETURN QUERY
  SELECT s.id, t.start_at, t.start_at + make_interval(mins=>p_duration_minutes), s.mode, s.is_open
  FROM public.madic_cric_appointment_slots s
  CROSS JOIN LATERAL generate_series(
    s.starts_at,
    s.ends_at - make_interval(mins=>p_duration_minutes),
    interval '1 hour'
  ) AS t(start_at)
  WHERE s.space_id=p_space_id AND s.is_open
    AND t.start_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.madic_cric_appointments a
      WHERE a.space_id=s.space_id AND a.status IN ('requested','confirmed')
        AND a.starts_at < t.start_at + make_interval(mins=>p_duration_minutes)
        AND a.ends_at > t.start_at
    )
  ORDER BY t.start_at, s.id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.madic_rdv_book_period(
  p_slot_id uuid, p_start timestamptz, p_end timestamptz
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_slot public.madic_cric_appointment_slots%ROWTYPE; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  SELECT * INTO v_slot FROM public.madic_cric_appointment_slots
    WHERE id=p_slot_id FOR UPDATE;
  IF NOT FOUND OR NOT v_slot.is_open THEN RAISE EXCEPTION 'Disponibilite fermee'; END IF;
  IF NOT public.madic_rdv_is_client(v_slot.space_id)
     OR NOT EXISTS (SELECT 1 FROM public.madic_cric_spaces c
                    WHERE c.id=v_slot.space_id AND c.access_status='active') THEN
    RAISE EXCEPTION 'Acces refuse' USING ERRCODE='42501';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start <= now()
     OR p_start < v_slot.starts_at OR p_end > v_slot.ends_at
     OR p_end - p_start NOT IN (interval '1 hour',interval '2 hours')
     OR mod(extract(epoch FROM (p_start - v_slot.starts_at))::numeric, 3600) <> 0
  THEN RAISE EXCEPTION 'Horaire ou duree invalide'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.madic_cric_appointments a
    WHERE a.space_id=v_slot.space_id AND a.status IN ('requested','confirmed')
      AND a.starts_at < p_end AND a.ends_at > p_start
  ) THEN RAISE EXCEPTION 'Cette periode est deja reservee'; END IF;
  INSERT INTO public.madic_cric_appointments(space_id,slot_id,client_id,starts_at,ends_at)
  VALUES(v_slot.space_id,p_slot_id,auth.uid(),p_start,p_end)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

-- L'ancienne RPC reste disponible pour les anciennes interfaces.
-- Adapter la verification des rendez-vous passes a l'horaire reel du client.
CREATE OR REPLACE FUNCTION public.madic_rdv_set_status(p_appointment_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_appt public.madic_cric_appointments%ROWTYPE; v_start timestamptz;
BEGIN
 SELECT * INTO v_appt FROM public.madic_cric_appointments WHERE id=p_appointment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Rendez-vous introuvable'; END IF;
 SELECT coalesce(v_appt.starts_at,s.starts_at) INTO v_start
 FROM public.madic_cric_appointment_slots s WHERE s.id=v_appt.slot_id;
 IF v_start<=now() THEN RAISE EXCEPTION 'Rendez-vous passe'; END IF;
 IF public.madic_rdv_is_owner(v_appt.space_id) THEN
  IF p_status NOT IN ('confirmed','declined','cancelled') THEN RAISE EXCEPTION 'Statut invalide'; END IF;
  IF v_appt.status NOT IN ('requested','confirmed') THEN RAISE EXCEPTION 'Rendez-vous clos'; END IF;
  IF p_status='declined' AND v_appt.status<>'requested' THEN RAISE EXCEPTION 'Refus possible uniquement pour une demande'; END IF;
 ELSIF v_appt.client_id=auth.uid() AND public.madic_rdv_is_client(v_appt.space_id) THEN
  IF p_status<>'cancelled' OR v_appt.status NOT IN ('requested','confirmed') THEN RAISE EXCEPTION 'Action non autorisee'; END IF;
 ELSE RAISE EXCEPTION 'Acces refuse'; END IF;
 UPDATE public.madic_cric_appointments SET status=p_status,updated_at=now() WHERE id=p_appointment_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.madic_rdv_available_periods(uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.madic_rdv_book_period(uuid,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.madic_rdv_available_periods(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.madic_rdv_book_period(uuid,timestamptz,timestamptz) TO authenticated;
COMMIT;
