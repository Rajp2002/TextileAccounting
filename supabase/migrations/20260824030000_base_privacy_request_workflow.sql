-- Base rollout privacy/grievance request operations.
-- The 30-day clock is Weavly's internal service target. It is not labelled as
-- a currently operative statutory deadline.

ALTER TABLE public.grievances
    ALTER COLUMN org_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS requester_email TEXT,
    ADD COLUMN IF NOT EXISTS identity_verification_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (identity_verification_status IN ('pending', 'verified', 'not_required', 'failed')),
    ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS response_summary TEXT;

CREATE OR REPLACE FUNCTION public.handle_grievance_target_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.sla_applies := NEW.target_entity = 'WEAVLY' AND NEW.grievance_type = 'DATA_PRIVACY';

    IF NEW.sla_applies THEN
        NEW.target_resolution_date :=
            (COALESCE(NEW.created_at, now()) AT TIME ZONE 'UTC')::DATE + 30;
    ELSE
        NEW.target_resolution_date := NULL;
    END IF;

    RETURN NEW;
END;
$$;

UPDATE public.grievances
SET
    sla_applies = TRUE,
    target_resolution_date = (created_at AT TIME ZONE 'UTC')::DATE + 30
WHERE target_entity = 'WEAVLY'
  AND grievance_type = 'DATA_PRIVACY'
  AND status <> 'resolved';

UPDATE public.grievances
SET
    sla_applies = FALSE,
    target_resolution_date = NULL
WHERE NOT (target_entity = 'WEAVLY' AND grievance_type = 'DATA_PRIVACY')
  AND status <> 'resolved';

COMMENT ON COLUMN public.grievances.org_id IS
    'Tenant organization when known; nullable for a Weavly-level request received before account matching.';
COMMENT ON COLUMN public.grievances.sla_applies IS
    'True when Weavly applies its internal 30-calendar-day privacy-response target.';
COMMENT ON COLUMN public.grievances.target_resolution_date IS
    'Internal service target calculated from receipt; not a representation of a currently operative statutory deadline.';
COMMENT ON COLUMN public.grievances.requester_email IS
    'Email used to receive and follow up on the request.';
COMMENT ON COLUMN public.grievances.identity_verification_status IS
    'Minimal identity or authority verification state for the request.';
COMMENT ON COLUMN public.grievances.response_summary IS
    'Concise record of the substantive response or closure outcome; avoid unnecessary personal data.';
