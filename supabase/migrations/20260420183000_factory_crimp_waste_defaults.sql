-- ============================================================
-- MIGRATION: Add yarn_shortage_pct and warp_crimp_pct to factory_cost_profile
-- Allows owners to set their factory's default shortage/crimp values
-- ============================================================

ALTER TABLE factory_cost_profile
  ADD COLUMN IF NOT EXISTS yarn_shortage_pct numeric(5,2) DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS warp_crimp_pct numeric(5,2) DEFAULT 5.00;

COMMENT ON COLUMN factory_cost_profile.yarn_shortage_pct IS
  'Factory global default for yarn waste/shortage percentage.';

COMMENT ON COLUMN factory_cost_profile.warp_crimp_pct IS
  'Factory global default for warp crimp (take-up) percentage.';
