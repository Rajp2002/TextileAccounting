-- ============================================================
-- MIGRATION: Add warp_crimp_pct to estimator templates and quotes
-- Enables accurate tape length -> beam capacity conversion.
-- ============================================================

ALTER TABLE estimator_templates
  ADD COLUMN IF NOT EXISTS warp_crimp_pct numeric(5,2) DEFAULT 5.0;

COMMENT ON COLUMN estimator_templates.warp_crimp_pct IS
  'Crimp (take-up) percentage for warp yarn; determines beam capacity from tape length.';

ALTER TABLE estimator_quotes
  ADD COLUMN IF NOT EXISTS warp_crimp_pct numeric(5,2) DEFAULT 5.0;

COMMENT ON COLUMN estimator_quotes.warp_crimp_pct IS
  'Snapshot of the crimp (take-up) percentage used to calculate beam capacity during the quote.';
