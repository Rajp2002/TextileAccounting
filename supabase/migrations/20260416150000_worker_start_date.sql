-- ============================================================
-- MIGRATION: Worker Start Date
-- ============================================================
-- Adds start_date to both workers tables so the payroll page
-- can filter out workers who hadn't joined yet in past months.
-- Existing workers are backfilled from their created_at date.
-- New workers auto-populate with CURRENT_DATE.
-- ============================================================

-- 1. fixed_workers (salaried: supervisor, master, helper, etc.)
ALTER TABLE fixed_workers
    ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;

-- Backfill existing rows from created_at
UPDATE fixed_workers
SET start_date = created_at::date
WHERE start_date IS NULL;

-- 2. workers (piece-rate / meter workers)
ALTER TABLE workers
    ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;

-- Backfill existing rows — workers table uses BIGINT identity so no created_at,
-- fall back to CURRENT_DATE (they existed before this feature, treat as legacy)
UPDATE workers
SET start_date = CURRENT_DATE
WHERE start_date IS NULL;
