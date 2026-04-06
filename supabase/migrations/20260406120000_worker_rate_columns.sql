-- ============================================================
-- MIGRATION: Add worker_rate_per_m to estimator_quotes + orders
-- ============================================================
-- Purpose: Flow the weaver wage rate (picks × perPickCostPaisa)
-- from the estimator quote through to the order, so supervisors
-- get an auto-filled rate on shift assignments instead of the
-- hardcoded 1.5 default.
--
-- Existing rows are unaffected (NULL = fall back to machine default).
-- ============================================================

ALTER TABLE estimator_quotes
  ADD COLUMN IF NOT EXISTS worker_rate_per_m DECIMAL;

COMMENT ON COLUMN estimator_quotes.worker_rate_per_m IS
  'Computed loom-worker wage rate: Σ(picks) × per_pick_cost_paise. '
  'Snapshotted at quote-save time. e.g. 58 picks × 0.16 = 9.28 ₹/m';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS worker_rate_per_m DECIMAL;

COMMENT ON COLUMN orders.worker_rate_per_m IS
  'Snapshot of estimator_quotes.worker_rate_per_m at convert-time. '
  'Supervisor CAN override per-shift in shift_assignments.rate_per_m. '
  'NULL for orders created without a linked quote (falls back to machine default).';
