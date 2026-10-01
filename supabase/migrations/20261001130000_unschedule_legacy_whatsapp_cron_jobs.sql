-- ============================================================
-- MIGRATION: unschedule the legacy WhatsApp pg_cron jobs
-- ============================================================
-- The scheduled WhatsApp daily brief, pace check, monthly brief and retry
-- belong to an earlier product version and are out of scope (owner,
-- 2026-10-01). Production ran two copies of each under old product names
-- (vastra-*, loomi-*) because 20260401030000, 20260402090000, 20260402100000
-- and 20260402120000 were renamed after they had been applied; a fresh
-- environment gets the weavly-* names from those files. Every name is removed
-- here, so no environment calls the WhatsApp edge functions on a schedule.
--
-- The run history of jobs that no longer exist is deleted too (about 10k rows
-- in production). cron.job_run_details keeps a copy of each run's command, and
-- vastra-daily-brief's command held a literal bearer token.
--
-- Not touched: weavly-free-retention (20260908190537, not a WhatsApp job,
-- inactive until retention is approved), the edge functions, and the WhatsApp
-- tables.
-- ============================================================

DO $$
DECLARE
    v_name text;
BEGIN
    FOREACH v_name IN ARRAY ARRAY[
        'vastra-daily-brief', 'vastra-pace-check', 'vastra-monthly-brief', 'vastra-retry-failed-messages',
        'loomi-daily-brief', 'loomi-pace-check', 'loomi-monthly-brief', 'loomi-retry-failed-messages',
        'weavly-daily-brief', 'weavly-pace-check', 'weavly-monthly-brief', 'weavly-retry-failed-messages'
    ] LOOP
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_name) THEN
            PERFORM cron.unschedule(v_name);
        END IF;
    END LOOP;

    -- Standalone test replays stub pg_cron without a run history table.
    IF to_regclass('cron.job_run_details') IS NOT NULL THEN
        EXECUTE 'DELETE FROM cron.job_run_details d WHERE NOT EXISTS (SELECT 1 FROM cron.job j WHERE j.jobid = d.jobid)';
    END IF;
END;
$$;
