-- SEC-017: durable adult-worker age verification provenance.
--
-- Existing worker rows are preserved. New rows must carry a verified date of
-- birth plus a non-sensitive evidence reference. Full government identifiers
-- must not be stored in these fields.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'worker_age_verification_method') THEN
    CREATE TYPE public.worker_age_verification_method AS ENUM (
      'government_id',
      'birth_certificate',
      'school_record',
      'other'
    );
  END IF;
END;
$$;

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS age_verification_method public.worker_age_verification_method,
  ADD COLUMN IF NOT EXISTS age_verification_reference TEXT,
  ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS age_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.fixed_workers
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS age_verification_method public.worker_age_verification_method,
  ADD COLUMN IF NOT EXISTS age_verification_reference TEXT,
  ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS age_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.require_worker_age_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_birth IS NULL
     OR NEW.age_verification_method IS NULL
     OR NULLIF(btrim(NEW.age_verification_reference), '') IS NULL
     OR length(btrim(NEW.age_verification_reference)) < 4
     OR NEW.age_verified_at IS NULL
     OR NEW.age_verified_by IS NULL THEN
    RAISE EXCEPTION 'verified date of birth and age evidence reference are required'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'worker must be at least 18 years old'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.date_of_birth < DATE '1900-01-01' OR NEW.date_of_birth > CURRENT_DATE THEN
    RAISE EXCEPTION 'worker date of birth is outside the supported range'
      USING ERRCODE = '23514';
  END IF;

  NEW.age_verification_reference := btrim(NEW.age_verification_reference);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_workers_age_verification ON public.workers;
CREATE TRIGGER require_workers_age_verification
  BEFORE INSERT OR UPDATE OF date_of_birth, age_verification_method,
    age_verification_reference, age_verified_at, age_verified_by
  ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.require_worker_age_verification();

DROP TRIGGER IF EXISTS require_fixed_workers_age_verification ON public.fixed_workers;
CREATE TRIGGER require_fixed_workers_age_verification
  BEFORE INSERT OR UPDATE OF date_of_birth, age_verification_method,
    age_verification_reference, age_verified_at, age_verified_by
  ON public.fixed_workers
  FOR EACH ROW EXECUTE FUNCTION public.require_worker_age_verification();

REVOKE ALL ON FUNCTION public.require_worker_age_verification() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_worker_age_verification() TO authenticated, service_role;

COMMENT ON COLUMN public.workers.age_verification_reference IS
  'Non-sensitive evidence reference only (for example document type plus last four characters); never store a full government identifier.';
COMMENT ON COLUMN public.fixed_workers.age_verification_reference IS
  'Non-sensitive evidence reference only (for example document type plus last four characters); never store a full government identifier.';
