-- ============================================================
-- daily_brief_logs: Idempotency tracking for cron-based reports
-- Prevents duplicate WhatsApp messages if cron triggers twice
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_brief_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    report_date DATE NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT now(),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
    details JSONB DEFAULT '{}'::jsonb,

    -- 🔐 Physically prevent duplicate sends per org per day
    UNIQUE (org_id, report_date)
);

-- Enable RLS (only service-role should access this table)
ALTER TABLE daily_brief_logs ENABLE ROW LEVEL SECURITY;

-- No user-facing policies: only the service_role key (used by edge functions) bypasses RLS.
-- This means no authenticated user can read/write this table directly.
