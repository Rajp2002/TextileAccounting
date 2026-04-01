-- ============================================================
-- MIGRATION: WhatsApp Cooldown Table
-- ============================================================
-- Prevents duplicate/noisy alert messages for the same event.
-- Used by:
--   deadline_risk  → ref_id = order UUID, 24h TTL check in app logic
--   yield_alert    → ref_id = batch UUID, fires once per batch close
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_cooldowns (
    org_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    alert_type TEXT        NOT NULL,  -- 'deadline_risk' | 'yield_alert'
    ref_id     TEXT        NOT NULL,  -- order_id (UUID as text) or batch_id
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (org_id, alert_type, ref_id)
);

-- Index for TTL expiry queries (check if sent within last N hours)
CREATE INDEX IF NOT EXISTS idx_whatsapp_cooldowns_sent_at
    ON whatsapp_cooldowns(org_id, alert_type, sent_at DESC);

-- Enable RLS (only service_role writes/reads this table via edge functions)
ALTER TABLE whatsapp_cooldowns ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — service_role bypasses RLS.
