-- Installer AVANT de publier avec les nouveaux fichiers.
-- Ne modifie aucun contrat deja publie ou signe.
CREATE OR REPLACE FUNCTION public.madic_activate_initial_contract(
 p_space_id uuid, p_client_id uuid, p_dossier_id uuid, p_snapshot jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
 v_id uuid; v_owner uuid; v_active text;
 v_name text; v_number text; v_signature jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
 SELECT owner_user_id,access_status INTO v_owner,v_active
 FROM public.madic_cric_spaces WHERE id=p_space_id;
 IF v_owner IS DISTINCT FROM auth.uid() OR v_active IS DISTINCT FROM 'active' THEN
  RAISE EXCEPTION 'Espace CRIC non autorise';
 END IF;
 SELECT full_name,license_number INTO v_name,v_number
 FROM public.madic_cric_applications
 WHERE user_id=auth.uid() AND status='approved';
 IF NOT FOUND THEN RAISE EXCEPTION 'CRIC non approuve'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.madic_cric_clients WHERE space_id=p_space_id AND client_id=p_client_id)
 THEN RAISE EXCEPTION 'Client non associe a cet espace'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.dossiers WHERE id=p_dossier_id AND client_id=p_client_id AND space_id=p_space_id)
 THEN RAISE EXCEPTION 'Dossier non associe au client'; END IF;
 IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object' OR length(coalesce(p_snapshot->>'html',''))<100
 THEN RAISE EXCEPTION 'Document manquant'; END IF;
 IF length(p_snapshot::text)>6000000 THEN RAISE EXCEPTION 'Document trop volumineux'; END IF;
 v_signature:=p_snapshot->'consultant_signature';
 IF jsonb_typeof(v_signature) IS DISTINCT FROM 'object'
    OR v_signature->>'accepted' IS DISTINCT FROM 'true'
    OR trim(coalesce(v_signature->>'name','')) IS DISTINCT FROM trim(coalesce(v_name,''))
    OR trim(coalesce(v_signature->>'license_number','')) IS DISTINCT FROM trim(coalesce(v_number,''))
    OR trim(coalesce(p_snapshot->'consultant'->>'name','')) IS DISTINCT FROM trim(coalesce(v_name,''))
    OR trim(coalesce(p_snapshot->'consultant'->>'number','')) IS DISTINCT FROM trim(coalesce(v_number,''))
 THEN RAISE EXCEPTION 'Signature du CRIC absente ou identite non verifiee'; END IF;
 -- Evite les doubles publications simultanees pour le meme dossier.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text,0));
 IF EXISTS(SELECT 1 FROM public.madic_initial_contracts
           WHERE space_id=p_space_id AND client_id=p_client_id AND dossier_id=p_dossier_id
             AND status IN ('publie','signe'))
 THEN RAISE EXCEPTION 'Un contrat initial est deja publie ou signe pour ce dossier'; END IF;
 INSERT INTO public.madic_initial_contracts(space_id,client_id,dossier_id,created_by,document_snapshot)
 VALUES(p_space_id,p_client_id,p_dossier_id,auth.uid(),
        jsonb_set(p_snapshot,'{consultant_signature,server_recorded_at}',to_jsonb(now()),true))
 RETURNING id INTO v_id;
 RETURN v_id;
END;
$function$;
