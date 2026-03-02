-- ============================================================
-- MIGRATION: Fix machine_assignments unique constraint
-- ============================================================
-- The original constraint was UNIQUE(machine_id, shift) which
-- doesn't include org_id. This prevented upsert operations
-- from using the correct conflict target (org_id, machine_id, shift).
-- We drop the old constraint and add the correct composite one.
-- ============================================================

-- Drop the old partial constraint
ALTER TABLE machine_assignments
    DROP CONSTRAINT IF EXISTS machine_assignments_machine_id_shift_key;

-- Add correct composite unique constraint including org_id
ALTER TABLE machine_assignments
    ADD CONSTRAINT machine_assignments_org_machine_shift_unique
    UNIQUE (org_id, machine_id, shift);
