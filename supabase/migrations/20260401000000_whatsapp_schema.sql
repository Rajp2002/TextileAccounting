-- ============================================================
-- MIGRATION: WhatsApp Infrastructure
-- ============================================================
-- 1. Owner opt-in fields on profiles
-- 2. Worker WhatsApp fields (piece-rate workers)
-- 3. Fixed-worker WhatsApp fields
-- 4. whatsapp_delivery_log — delivery audit for all 7 notification types
-- ============================================================

-- ─── 1. PROFILES: Owner WhatsApp opt-in ──────────────────────
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,          -- 10-digit, no country code e.g. "9898989898"
    ADD COLUMN IF NOT EXISTS whatsapp_opted_in BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS whatsapp_opted_in_at TIMESTAMPTZ;

-- ─── 2. WORKERS: Piece-rate worker WhatsApp ──────────────────
ALTER TABLE workers
    ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_language TEXT NOT NULL DEFAULT 'en'
        CHECK (whatsapp_language IN ('en', 'hi', 'gu'));

-- ─── 3. FIXED_WORKERS: Salaried worker WhatsApp ──────────────
ALTER TABLE fixed_workers
    ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_language TEXT NOT NULL DEFAULT 'en'
        CHECK (whatsapp_language IN ('en', 'hi', 'gu'));

-- ─── 4. WHATSAPP_DELIVERY_LOG ─────────────────────────────────
-- Universal delivery audit for all notification types.
-- Never truncate — this is the compliance and debug trail.

CREATE TABLE IF NOT EXISTS whatsapp_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    owner_profile_id UUID REFERENCES profiles(id),   -- NULL for worker-facing messages
    recipient_phone TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    template_name TEXT NOT NULL,
    notification_type TEXT NOT NULL,                 -- 'daily_brief' | 'payslip' | 'advance_receipt' | 'yield_alert' | 'deadline_risk' | 'access_code' | 'safety_incident'
    status TEXT NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    interakt_callback_data TEXT,                     -- echoed in Interakt webhooks for tracing
    error_message TEXT,
    payload_snapshot JSONB                           -- full payload sent to Interakt for debugging
);

-- Index: Dashboard queries (org + time)
CREATE INDEX IF NOT EXISTS idx_whatsapp_log_org_sent
    ON whatsapp_delivery_log(org_id, sent_at DESC);

-- Index: Status monitoring
CREATE INDEX IF NOT EXISTS idx_whatsapp_log_status
    ON whatsapp_delivery_log(status, sent_at DESC)
    WHERE status = 'failed';

-- ─── 5. RLS — DELIVERY LOG ───────────────────────────────────
ALTER TABLE whatsapp_delivery_log ENABLE ROW LEVEL SECURITY;

-- Owners can read their own org's delivery logs (for a future "Messages" dashboard tab)
CREATE POLICY "owners_read_own_delivery_log" ON whatsapp_delivery_log
    FOR SELECT
    USING (
        org_id = (auth.jwt() ->> 'org_id')::uuid
        AND (auth.jwt() ->> 'user_role') = 'owner'
    );

-- No INSERT policy for authenticated users — only service_role (edge functions) can insert.
-- service_role bypasses RLS entirely, so no policy is needed for it.
