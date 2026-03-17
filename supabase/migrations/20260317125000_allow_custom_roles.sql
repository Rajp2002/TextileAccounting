-- MIGRATION: Allow Custom Roles in Fixed Workers (SEC-004)
-- Drops the check constraint on fixed_workers.role to allow custom roles

ALTER TABLE fixed_workers DROP CONSTRAINT IF EXISTS fixed_workers_role_check;
