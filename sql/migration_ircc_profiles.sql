
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ircc_application_category text,
  ADD COLUMN IF NOT EXISTS ircc_application_type text;

