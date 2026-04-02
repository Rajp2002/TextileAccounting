-- ============================================================
-- MIGRATION: Retry Infrastructure for whatsapp_delivery_log
-- ============================================================
-- Adds two columns to support the retry-failed-messages Edge Function:
--
--   retry_count    — how many retry attempts have been made (starts at 0)
--   last_retry_at  — timestamp of the most recent retry attempt (NULL if none)
--
-- The retry Edge Function caps at 3 retries and only retries rows
-- where sent_at > NOW() - 24h, so failures older than 24h are
-- effectively archived/dead-lettered.
--
-- Index: speeds up the hourly retry cron query
--   (status = 'failed', sent_at within last 24h, retry_count < 3)
-- ============================================================

ALTER TABLE whatsapp_delivery_log
    ADD COLUMN IF NOT EXISTS retry_count   INTEGER   NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- Fast lookup for the retry cron: status=failed, recent, under retry cap
CREATE INDEX IF NOT EXISTS idx_whatsapp_log_failed_retryable
    ON whatsapp_delivery_log(status, sent_at DESC, retry_count)
    WHERE status = 'failed';

-- Comment for future devs
COMMENT ON COLUMN whatsapp_delivery_log.retry_count IS
    'Number of retry attempts made by retry-failed-messages Edge Function. Hard cap is 3.';

COMMENT ON COLUMN whatsapp_delivery_log.last_retry_at IS
    'Timestamp of the most recent retry attempt. NULL means no retry has been attempted.';
