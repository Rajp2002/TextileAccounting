-- MIGRATION: Add overhead_override_per_m column
-- When set, this value bypasses the itemized overhead calculation and
-- is used directly as the per-metre overhead cost.
-- NULL means use the itemized sum / monthly_output_m formula.

ALTER TABLE factory_cost_profile
  ADD COLUMN IF NOT EXISTS overhead_override_per_m numeric(10,2) DEFAULT NULL;

COMMENT ON COLUMN factory_cost_profile.overhead_override_per_m IS
  'Optional direct ₹/m overhead override. When non-null and positive, bypasses the itemized overhead_items calculation.';

ALTER TABLE estimator_quotes
  ADD COLUMN IF NOT EXISTS overhead_override_per_m numeric(10,2) DEFAULT NULL;

COMMENT ON COLUMN estimator_quotes.overhead_override_per_m IS
  'Snapshot of the direct override value at quote time, if active.';
