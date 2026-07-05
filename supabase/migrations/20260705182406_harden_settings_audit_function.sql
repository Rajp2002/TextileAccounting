-- Follow-up hardening for Batch 24G settings audit trigger helpers.
-- The previous migration installed these functions; keep the trigger behavior
-- unchanged while fixing direct execute grants and mutable search paths.

ALTER FUNCTION public.redact_settings_audit_payload(TEXT, JSONB)
    SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.redact_settings_audit_payload(TEXT, JSONB)
    FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.log_settings_audit_event()
    SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.log_settings_audit_event()
    FROM PUBLIC, anon, authenticated;
