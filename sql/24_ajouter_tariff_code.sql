
ALTER TABLE public.madic_initial_service_requests
  ADD COLUMN IF NOT EXISTS tariff_code text;
ALTER TABLE public.madic_initial_service_requests
  DROP CONSTRAINT IF EXISTS madic_initial_service_requests_tariff_code_check;
ALTER TABLE public.madic_initial_service_requests
  ADD CONSTRAINT madic_initial_service_requests_tariff_code_check
  CHECK (tariff_code IS NULL OR tariff_code IN ('hourly','single','couple'));

