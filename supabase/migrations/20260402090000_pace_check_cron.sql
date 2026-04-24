-- ============================================================
-- MIGRATION: pg_cron — Pace Index check every 6 hours
-- ============================================================
-- Fires at 00:00, 06:00, 12:00, 18:00 UTC every day.
-- Calls the check-pace-index Supabase Edge Function.
--
-- Complements the nightly deadline check inside send-daily-brief.
-- Together they ensure behind-pace orders trigger within 6h.
--
-- PREREQUISITES:
--   Requires 'supabase_url' and 'service_role_key' in whatsapp_settings table.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Remove if already exists (idempotent)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weavly-pace-check') THEN
        PERFORM cron.unschedule('weavly-pace-check');
    END IF;
END;
$$;

SELECT cron.schedule(
    'weavly-pace-check',     -- job name
    '0 */6 * * *',           -- every 6 hours: 00:00, 06:00, 12:00, 18:00 UTC
    $$
    SELECT net.http_post(
        url     := (SELECT value FROM whatsapp_settings WHERE key = 'supabase_url') || '/functions/v1/check-pace-index',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (SELECT value FROM whatsapp_settings WHERE key = 'service_role_key'),
            'Content-Type', 'application/json'
        ),
        body    := '{}'::jsonb
    );
    $$
);
