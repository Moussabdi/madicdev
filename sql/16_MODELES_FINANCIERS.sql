-- MADIC : choix annuel du modele de compte client, isole par cabinet CRIC.
BEGIN;
CREATE TABLE IF NOT EXISTS public.madic_finance_models (
  space_id uuid NOT NULL REFERENCES public.madic_cric_spaces(id),
  audit_year integer NOT NULL CHECK (audit_year BETWEEN 2000 AND 2100),
  model text NOT NULL CHECK (model IN ('model1','model2')),
  selected_at timestamptz NOT NULL DEFAULT now(),
  selected_by uuid NOT NULL DEFAULT auth.uid(),
  PRIMARY KEY (space_id,audit_year)
);
ALTER TABLE public.madic_finance_models ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.madic_finance_models FROM anon, authenticated;
GRANT SELECT ON public.madic_finance_models TO authenticated;
DROP POLICY IF EXISTS finance_models_select ON public.madic_finance_models;
CREATE POLICY finance_models_select ON public.madic_finance_models
FOR SELECT TO authenticated
USING (public.madic_can_manage_cric_space(space_id));

CREATE OR REPLACE FUNCTION public.madic_finance_set_model(
 p_space_id uuid, p_audit_year integer, p_model text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing_model text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.madic_can_manage_cric_space(p_space_id) THEN
   RAISE EXCEPTION 'Acces non autorise';
 END IF;
 IF p_audit_year IS NULL OR p_audit_year NOT BETWEEN 2000 AND 2100 OR p_model IS NULL OR p_model NOT IN ('model1','model2') THEN
   RAISE EXCEPTION 'Annee ou modele invalide';
 END IF;
 -- Empêcher les changements pendant la saisie concurrente et les changements d'annees avec ecritures.
 PERFORM pg_advisory_xact_lock(hashtext(p_space_id::text),p_audit_year);
 SELECT model INTO existing_model FROM public.madic_finance_models
 WHERE space_id=p_space_id AND audit_year=p_audit_year FOR UPDATE;
 IF existing_model IS NOT NULL AND existing_model <> p_model AND EXISTS (
   SELECT 1 FROM public.madic_finance_ledger_entries
   WHERE space_id=p_space_id AND transaction_date >= make_date(p_audit_year,1,1)
   AND transaction_date < make_date(p_audit_year+1,1,1)
 ) THEN
   RAISE EXCEPTION 'Modele verrouille : des ecritures existent pour cette annee';
 END IF;
 INSERT INTO public.madic_finance_models(space_id,audit_year,model,selected_by)
 VALUES(p_space_id,p_audit_year,p_model,auth.uid())
 ON CONFLICT(space_id,audit_year) DO UPDATE
 SET model=EXCLUDED.model,selected_at=now(),selected_by=auth.uid()
 WHERE public.madic_finance_models.model IS DISTINCT FROM EXCLUDED.model;
END;
$$;
REVOKE ALL ON FUNCTION public.madic_finance_set_model(uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.madic_finance_set_model(uuid,integer,text) TO authenticated;
COMMIT;
