-- Migration additive : conserver les données et politiques RLS existantes.
-- Exécuter une seule fois dans Supabase SQL Editor avant le déploiement du JS.
ALTER TABLE public.madic_cric_professional_profiles
  ADD COLUMN IF NOT EXISTS professional_title text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS website_url text;

-- Contraintes sur les valeurs renseignées. Les anciennes lignes restent intactes.
ALTER TABLE public.madic_cric_professional_profiles
  DROP CONSTRAINT IF EXISTS madic_cric_profile_professional_title_length,
  DROP CONSTRAINT IF EXISTS madic_cric_profile_license_number_length,
  DROP CONSTRAINT IF EXISTS madic_cric_profile_website_url_https;
ALTER TABLE public.madic_cric_professional_profiles
  ADD CONSTRAINT madic_cric_profile_professional_title_length
    CHECK (professional_title IS NULL OR length(trim(professional_title)) BETWEEN 1 AND 150),
  ADD CONSTRAINT madic_cric_profile_license_number_length
    CHECK (license_number IS NULL OR length(trim(license_number)) BETWEEN 1 AND 80),
  ADD CONSTRAINT madic_cric_profile_website_url_https
    CHECK (website_url IS NULL OR website_url = '' OR website_url ~* '^https://[^[:space:]/?#]+');

-- Les champs deviennent obligatoires pour les NOUVELLES invitations via la fonction Edge.
-- Ne pas définir NOT NULL ici : cela casserait les profils existants.
-- IMPORTANT : corriger manuellement les valeurs mal placées dans le profil de Faycal.
