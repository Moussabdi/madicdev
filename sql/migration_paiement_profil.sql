-- Exécuter une seule fois dans Supabase SQL Editor, après vérification de la table.
-- Aucun changement de politiques RLS : les règles existantes s'appliquent.
ALTER TABLE public.madic_cric_professional_profiles
  ADD COLUMN IF NOT EXISTS payment_details text;
