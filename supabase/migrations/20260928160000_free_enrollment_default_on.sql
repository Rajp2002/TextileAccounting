-- Owner decision (2026-09-28): Free is the default plan for every new account;
-- only an explicit Lite or Base choice skips it. Free signup and Free
-- calculation are therefore on by default.
--
-- The flags remain the pause switch described in docs/free-tier/OPERATIONS.md:
-- turning either one off in the singleton row still pauses Free without
-- touching grants or paid access. Free calculation also needs
-- WEAVLY_FREE_SIGNING_KEY_ID and WEAVLY_FREE_SIGNING_KEYS; without them it
-- fails closed with FREE_TEMPORARY_ERROR. Safe to re-run.

ALTER TABLE public.free_rollout ALTER COLUMN enrollment_enabled SET DEFAULT true;
ALTER TABLE public.free_rollout ALTER COLUMN estimation_enabled SET DEFAULT true;

UPDATE public.free_rollout
SET enrollment_enabled = true,
    estimation_enabled = true
WHERE singleton;
