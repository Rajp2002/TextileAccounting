-- ============================================================
-- MIGRATION: Granular Factory Overhead Items
-- Replaces single overhead_pct knob with itemized monthly cost breakdown.
-- Both columns are additive — no existing data is dropped.
-- overhead_pct is kept for backward compat (populated with computed effective %).
-- ============================================================

-- ─── factory_cost_profile ────────────────────────────────────────────────────
-- overhead_items: array of { id, label, monthlyAmount, source, workerId? }
-- monthly_output_m: denominator — estimated metres produced per month
ALTER TABLE factory_cost_profile
  ADD COLUMN IF NOT EXISTS overhead_items    jsonb        NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS monthly_output_m  numeric(10,2) NOT NULL DEFAULT 10000;

COMMENT ON COLUMN factory_cost_profile.overhead_items IS
  'JSON array of overhead line items: [{id, label, monthlyAmount, source, workerId?}]. source: manual | fixed_worker_derived';

COMMENT ON COLUMN factory_cost_profile.monthly_output_m IS
  'Estimated metres of fabric produced per month — used as denominator for per-metre overhead calculation.';

-- ─── estimator_quotes (snapshot at quote time) ───────────────────────────────
ALTER TABLE estimator_quotes
  ADD COLUMN IF NOT EXISTS overhead_items    jsonb,
  ADD COLUMN IF NOT EXISTS monthly_output_m  numeric(10,2);

COMMENT ON COLUMN estimator_quotes.overhead_items IS
  'Snapshot of overhead line items at quote creation time.';
