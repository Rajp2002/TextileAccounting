-- ============================================================
-- MIGRATION: WhatsApp Webhook Support
-- ============================================================
-- Adds interakt_message_id to whatsapp_delivery_log so that
-- incoming Interakt delivery callbacks can be correlated with
-- the original sent record and upserted.
--
-- Also adds an UPDATE policy (service_role only via bypass)
-- and an index for fast webhook lookups.
-- ============================================================

-- ─── 1. Add interakt_message_id column ───────────────────────
-- Populated by send-* functions from the Interakt API response.
-- Used as the join key in the whatsapp-webhook handler.
ALTER TABLE whatsapp_delivery_log
    ADD COLUMN IF NOT EXISTS interakt_message_id TEXT;

-- Unique partial index: only non-NULL IDs need to be unique
-- (NULLs are fine before the callback arrives)
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_log_interakt_message_id
    ON whatsapp_delivery_log(interakt_message_id)
    WHERE interakt_message_id IS NOT NULL;

-- General lookup index for O(1) webhook matching
CREATE INDEX IF NOT EXISTS idx_whatsapp_log_message_id_lookup
    ON whatsapp_delivery_log(interakt_message_id)
    WHERE interakt_message_id IS NOT NULL;

-- ─── 2. Add delivered_at / read_at timestamps ─────────────────
-- Allows the dashboard to show time-to-delivery metrics.
ALTER TABLE whatsapp_delivery_log
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- ─── Notes ────────────────────────────────────────────────────
-- No INSERT/UPDATE RLS policy needed:
--   • service_role bypasses RLS entirely.
--   • The whatsapp-webhook Edge Function uses the service_role
--     client and therefore can UPDATE rows freely.
-- The existing "owners_read_own_delivery_log" SELECT policy
-- already allows owners to read the updated status values.
