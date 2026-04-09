-- ============================================================
-- MIGRATION: pg_cron — Monthly Brief on 28th at 18:00 UTC (23:30 IST)
-- ============================================================
-- Fires on the 28th of every month at 18:00 UTC = 23:30 IST.
-- Running on the 28th ensures it fires before month-end on all
-- months (February is the shortest at 28 days).
--
-- Calls the monthly-brief Supabase Edge Function via http_post.
-- Auth uses service_role key (same pattern as loomi-daily-brief).
--
-- PREREQUISITES: app.settings.supabase_url and
--               app.settings.service_role_key must be set.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Remove if already exists (idempotent)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'loomi-monthly-brief') THEN
        PERFORM cron.unschedule('loomi-monthly-brief');
    END IF;
END;
$$;

SELECT cron.schedule(
    'loomi-monthly-brief',   -- job name
    '0 18 28 * *',            -- 18:00 UTC on the 28th of every month = 23:30 IST
    $$
    SELECT net.http_post(
        url     := current_setting('app.settings.supabase_url') || '/functions/v1/monthly-brief',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
            'Content-Type', 'application/json'
        ),
        body    := '{}'::jsonb
    );
    $$
);
