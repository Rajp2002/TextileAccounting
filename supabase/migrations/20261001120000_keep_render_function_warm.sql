-- ============================================================
-- MIGRATION: pg_cron — keep the Vercel page-render function warm
-- ============================================================
-- Why: a cold first open costs ~2 s before any app work. Measured
-- 2026-10-01 from India: the proxy (middleware) cold-started in ~0.3 s and
-- ran 0.58 s, then the page renderer cold-started in ~0.4 s and ran 1.0 s
-- (TTFB 2.26 s; warm TTFB ~0.2-0.3 s). Both run in bom1 for Indian users.
--
-- The existing Sentry Uptime monitor pings `/` every minute, but `/` is a
-- CDN hit (renderer never runs) and Sentry checks from US regions, so it only
-- warms proxy instances in iad1/sfo1. Pointing Sentry at /login would warm
-- the bom1 renderer, but its proxy hop would still run in the US.
--
-- This job calls from Supabase ap-south-1 (Mumbai), so the request enters
-- Vercel at bom1 and warms both the bom1 proxy and the bom1 renderer.
-- `/login` is force-dynamic and renders without any database call; the
-- renderer instance it warms also served /reset-password and /track/* in the
-- same test, so App Router pages share it. Whether /owner/* and /free share
-- that function is not yet confirmed by a signed-in timing.
--
-- What it schedules (production project only):
--   weavly-keep-render-warm          every 2 minutes, GET /login via pg_net
--   weavly-keep-render-warm-cleanup  daily, prunes that job's run history
--     (pg_cron writes one cron.job_run_details row per run; pg_net already
--     deletes its own responses after pg_net.ttl, 6 hours by default)
--
-- The guard below skips scheduling on any project whose stored supabase_url
-- is not production, so replaying migrations on QA never pings production.
--
-- Roll back:
--   SELECT cron.unschedule('weavly-keep-render-warm');
--   SELECT cron.unschedule('weavly-keep-render-warm-cleanup');
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

DO $$
BEGIN
    -- Remove if already exists (idempotent)
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weavly-keep-render-warm') THEN
        PERFORM cron.unschedule('weavly-keep-render-warm');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weavly-keep-render-warm-cleanup') THEN
        PERFORM cron.unschedule('weavly-keep-render-warm-cleanup');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.whatsapp_settings
        WHERE key = 'supabase_url' AND value LIKE '%vzhwahudircrpgtitwzd%'
    ) THEN
        RAISE NOTICE 'weavly-keep-render-warm not scheduled: not the production project';
        RETURN;
    END IF;

    PERFORM cron.schedule(
        'weavly-keep-render-warm',
        '*/2 * * * *',
        $job$
        SELECT net.http_get(
            url                  := 'https://textile-accounting.vercel.app/login',
            headers              := jsonb_build_object('User-Agent', 'WeavlyWarmPing/1.0 (Supabase pg_cron)'),
            timeout_milliseconds := 10000
        );
        $job$
    );

    PERFORM cron.schedule(
        'weavly-keep-render-warm-cleanup',
        '41 2 * * *',
        $job$
        DELETE FROM cron.job_run_details
        WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'weavly-keep-render-warm')
          AND end_time < now() - interval '1 day';
        $job$
    );
END;
$$;
