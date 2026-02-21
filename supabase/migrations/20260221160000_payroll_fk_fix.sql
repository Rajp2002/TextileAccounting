-- ============================================================
-- MIGRATION: Fix payroll_payments polymorphic FK (SEC-003)
-- ============================================================
-- Replace the untyped worker_id BIGINT with two properly-typed
-- nullable foreign keys + a CHECK constraint ensuring exactly one
-- is non-null at all times. This enforces referential integrity.
-- ============================================================

-- Step 1: Add the two typed FK columns
ALTER TABLE payroll_payments
    ADD COLUMN IF NOT EXISTS meter_worker_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fixed_worker_id BIGINT REFERENCES fixed_workers(id) ON DELETE SET NULL;

-- Step 2: Migrate existing data — use worker_type to route to the correct column
UPDATE payroll_payments
    SET meter_worker_id = worker_id
    WHERE worker_type = 'meter' AND meter_worker_id IS NULL;

UPDATE payroll_payments
    SET fixed_worker_id = worker_id
    WHERE worker_type = 'fixed' AND fixed_worker_id IS NULL;

-- Step 3: Drop the old orphaned column
ALTER TABLE payroll_payments DROP COLUMN IF EXISTS worker_id;

-- Step 4: Add CHECK constraint — exactly one FK must be non-null
ALTER TABLE payroll_payments
    ADD CONSTRAINT payroll_exactly_one_worker_fk CHECK (
        (meter_worker_id IS NOT NULL AND fixed_worker_id IS NULL) OR
        (meter_worker_id IS NULL AND fixed_worker_id IS NOT NULL)
    );

-- Step 5: Update the UNIQUE constraint to use the new columns
-- (Old unique was on org_id, worker_type, worker_id, month)
ALTER TABLE payroll_payments DROP CONSTRAINT IF EXISTS payroll_payments_org_id_worker_type_worker_id_month_key;

-- New unique: one payroll entry per worker per month (keyed by the non-null FK)
CREATE UNIQUE INDEX IF NOT EXISTS payroll_unique_meter_worker_month
    ON payroll_payments (org_id, meter_worker_id, month)
    WHERE meter_worker_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payroll_unique_fixed_worker_month
    ON payroll_payments (org_id, fixed_worker_id, month)
    WHERE fixed_worker_id IS NOT NULL;
