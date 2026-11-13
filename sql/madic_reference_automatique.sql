-- À exécuter une seule fois dans Supabase > SQL Editor.
-- Les anciennes références sont conservées.
-- Le déclencheur produit MADIC-AAAA-00001, etc. de façon atomique.
CREATE OR REPLACE FUNCTION public.madic_generate_dossier_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_year text := to_char(CURRENT_DATE, 'YYYY');
  v_prefix text;
  v_next integer;
BEGIN
  -- Sérialiser les créations concurrentes pour cette année.
  PERFORM pg_catalog.pg_advisory_xact_lock(82461, v_year::integer);
  v_prefix := 'MADIC-' || v_year || '-';
  SELECT COALESCE(MAX(substring(d.reference from 12)::integer), 0) + 1
    INTO v_next
  FROM public.dossiers AS d
  WHERE d.reference ~ ('^' || v_prefix || '[0-9]{5}$');
  IF v_next > 99999 THEN
    RAISE EXCEPTION 'Limite annuelle de 99999 dossiers atteinte';
  END IF;
  NEW.reference := v_prefix || lpad(v_next::text, 5, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS madic_auto_reference ON public.dossiers;
CREATE TRIGGER madic_auto_reference
BEFORE INSERT ON public.dossiers
FOR EACH ROW
EXECUTE FUNCTION public.madic_generate_dossier_reference();
