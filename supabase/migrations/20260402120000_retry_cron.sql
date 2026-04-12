-- ============================================================
-- MIGRATION: pg_cron — Hourly retry for failed WhatsApp sends
-- ============================================================
-- Fires at the top of every hour.
-- Calls the retry-failed-messages Supabase Edge Function.
--
-- That function finds whatsapp_delivery_log rows with:
--   status = 'failed'  AND  sent_at > NOW() - 24h  AND  retry_count < 3
-- and re-attempts to send them via Interakt.
--
-- PREREQUISITES:
--   Requires 'supabase_url' and 'service_role_key' in whatsapp_settings table.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Remove if already exists (idempotent)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'loomi-retry-failed-messages') THEN
        PERFORM cron.unschedule('loomi-retry-failed-messages');
    END IF;
END;
$$;

SELECT cron.schedule(
    'loomi-retry-failed-messages',  -- job name
    '0 * * * *',                     -- top of every hour
    $$
    SELECT net.http_post(
        url     := (SELECT value FROM whatsapp_settings WHERE key = 'supabase_url') || '/functions/v1/retry-failed-messages',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (SELECT value FROM whatsapp_settings WHERE key = 'service_role_key'),
            'Content-Type', 'application/json'
        ),
        body    := '{}'::jsonb
    );
    $$
);
