-- ============================================================
-- MIGRATION: pg_cron — Daily WhatsApp Brief at 20:00 IST
-- ============================================================
-- Fires at 14:30 UTC = 20:00 IST every day.
-- Calls the send-daily-brief Supabase Edge Function via http_post.
--
-- PREREQUISITES — set OUTSIDE this file (never commit real values here):
--   Run once in Supabase SQL editor (Dashboard → SQL Editor):
--
--     ALTER DATABASE postgres
--       SET "app.settings.supabase_url" = 'https://<project-ref>.supabase.co';
--     ALTER DATABASE postgres
--       SET "app.settings.service_role_key" = '<your-service-role-key>';
--
--   ⚠️  Do NOT paste the actual key into this migration file.
--   ⚠️  Do NOT commit real credentials to any file tracked by git.
-- ============================================================

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Remove existing job if it exists (idempotent — no error if missing)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'loomi-daily-brief') THEN
        PERFORM cron.unschedule('loomi-daily-brief');
    END IF;
END;
$$;

SELECT cron.schedule(
    'loomi-daily-brief',   -- job name
    '30 14 * * *',          -- 14:30 UTC = 20:00 IST
    $$
    SELECT net.http_post(
        url     := current_setting('app.settings.supabase_url') || '/functions/v1/send-daily-brief',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
            'Content-Type', 'application/json'
        ),
        body    := '{}'::jsonb
    );
    $$
);
