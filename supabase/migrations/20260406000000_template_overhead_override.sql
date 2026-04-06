-- ============================================================
-- MIGRATION: Add overhead_override_per_m to estimator_templates
-- ============================================================

ALTER TABLE estimator_templates
  ADD COLUMN IF NOT EXISTS overhead_override_per_m numeric(10,4);

COMMENT ON COLUMN estimator_templates.overhead_override_per_m IS
  'Override for combined fixed overhead per metre. Null means rely on itemized factory defaults.';
