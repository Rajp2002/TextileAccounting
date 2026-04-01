-- ============================================================
-- MIGRATION: pg_cron — Daily WhatsApp Brief at 20:00 IST
-- ============================================================
-- Fires at 14:30 UTC = 20:00 IST every day.
-- Calls the send-daily-brief Supabase Edge Function via http_post.
--
-- PREREQUISITES (set in Supabase Dashboard → Settings → Vault):
--   app.settings.supabase_url   = https://<project-ref>.supabase.co
--   app.settings.service_role_key = <service_role_secret>
-- ============================================================

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Remove existing job if it exists (idempotent — no error if missing)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vastra-daily-brief') THEN
        PERFORM cron.unschedule('vastra-daily-brief');
    END IF;
END;
$$;

SELECT cron.schedule(
    'vastra-daily-brief',   -- job name
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
