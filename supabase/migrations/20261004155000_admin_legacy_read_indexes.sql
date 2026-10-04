-- Bounded, read-only formal registers use this stable keyset order. These
-- indexes do not change records, access policies, or retained legal workflows.
CREATE INDEX IF NOT EXISTS admin_grievances_recorded_page_idx
    ON public.grievances (created_at DESC NULLS LAST, id DESC);
CREATE INDEX IF NOT EXISTS admin_security_incidents_recorded_page_idx
    ON public.security_incidents (created_at DESC NULLS LAST, id DESC);
CREATE INDEX IF NOT EXISTS admin_dpas_recorded_page_idx
    ON public.dpas (created_at DESC NULLS LAST, id DESC);
CREATE INDEX IF NOT EXISTS admin_notices_recorded_page_idx
    ON public.notice_registry (created_at DESC NULLS LAST, id DESC);
CREATE INDEX IF NOT EXISTS admin_dpa_bindings_recorded_page_idx
    ON public.organization_dpas (dpa_id, created_at DESC NULLS LAST, id DESC);
