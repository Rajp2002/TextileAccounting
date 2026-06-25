-- Batch 1B-A / SEC-006:
-- Access codes must not be recoverably stored as plaintext at rest.
--
-- This guard is intentionally non-destructive: it does not backfill or clear
-- existing organizations.last_code_plain values. It only prevents future
-- inserts/updates from writing a non-null plaintext access code.

CREATE OR REPLACE FUNCTION public.prevent_access_code_plaintext_storage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NEW.last_code_plain IS NOT NULL THEN
        RAISE EXCEPTION 'access code plaintext storage is disabled'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_organizations_last_code_plaintext ON public.organizations;

CREATE TRIGGER prevent_organizations_last_code_plaintext
    BEFORE INSERT OR UPDATE OF last_code_plain ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_access_code_plaintext_storage();

REVOKE ALL ON FUNCTION public.prevent_access_code_plaintext_storage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_access_code_plaintext_storage() TO service_role;

COMMENT ON COLUMN public.organizations.last_code_plain IS
    'Deprecated. Batch 1B-A prevents future non-null plaintext access-code writes; do not use for code recovery or display.';
