-- ============================================================
-- ESI and PF Tracking Fields
-- Adds Employee State Insurance and Provident Fund fields 
-- to workers and fixed_workers tables for future compliance.
-- ============================================================

ALTER TABLE workers ADD COLUMN IF NOT EXISTS esi_number TEXT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS pf_number TEXT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS pf_esi_eligible BOOLEAN DEFAULT false;

ALTER TABLE fixed_workers ADD COLUMN IF NOT EXISTS esi_number TEXT;
ALTER TABLE fixed_workers ADD COLUMN IF NOT EXISTS pf_number TEXT;
ALTER TABLE fixed_workers ADD COLUMN IF NOT EXISTS pf_esi_eligible BOOLEAN DEFAULT false;
