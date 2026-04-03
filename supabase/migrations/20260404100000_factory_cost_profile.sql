-- ============================================================
-- MIGRATION: Estimator V3 — Clean Break
-- 1. Drop estimator_settings table (and all dependents via CASCADE)
-- 2. Create factory_cost_profile (new single source of truth)
-- 3. Add V3 snapshot columns to estimator_quotes
-- 4. Drop V1-only columns from estimator_quotes
-- 5. Add V3 columns to estimator_templates (full JSON recipe storage)
-- ============================================================

-- ─── 1. DROP OLD TABLE ───────────────────────────────────────────────────────
-- CASCADE handles any audit triggers or policies that reference this table
DROP TABLE IF EXISTS estimator_settings CASCADE;

-- ─── 2. CREATE FACTORY COST PROFILE ─────────────────────────────────────────
CREATE TABLE factory_cost_profile (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,

  -- Pre-weaving rates (₹ per kg of warp yarn)
  warping_rate_per_kg     numeric(10,2) NOT NULL DEFAULT 2.00,
  sizing_rate_per_kg      numeric(10,2) NOT NULL DEFAULT 1.50,
  winding_rate_per_kg     numeric(10,2) NOT NULL DEFAULT 0,    -- 0 = not applicable

  -- Overhead (% of direct production cost)
  overhead_pct            numeric(5,2)  NOT NULL DEFAULT 8.00,

  -- Selling defaults
  default_commission_pct  numeric(5,2)  NOT NULL DEFAULT 2.00,
  default_transport_per_m numeric(10,2) NOT NULL DEFAULT 0,

  -- Which optional cost sections apply to this factory
  -- warp/weft/weave/warping/sizing/overhead are ALWAYS on — not in this object
  enabled_sections jsonb NOT NULL DEFAULT '{
    "winding":    false,
    "processing": false,
    "finishing":  false,
    "commission": true,
    "transport":  false
  }'::jsonb,

  updated_at timestamptz DEFAULT now()
);

-- RLS: owner-only, scoped to their own factory
ALTER TABLE factory_cost_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners Manage Factory Cost Profile" ON factory_cost_profile
  FOR ALL USING (
    (auth.jwt() ->> 'user_role') = 'owner' AND
    factory_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE INDEX IF NOT EXISTS idx_factory_cost_profile_factory_id
  ON factory_cost_profile(factory_id);

-- ─── 3. ADD V3 SNAPSHOT COLUMNS TO estimator_quotes ─────────────────────────
-- These capture the exact cost inputs at quote time so historical estimates
-- remain accurate even after factory profile rates change later.
ALTER TABLE estimator_quotes
  ADD COLUMN IF NOT EXISTS warping_rate_per_kg   numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sizing_rate_per_kg    numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS winding_rate_per_kg   numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_rate_per_m numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finishing_rate_per_m  numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overhead_pct          numeric(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_pct        numeric(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_per_m       numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_quantity_m      numeric(10,2),
  ADD COLUMN IF NOT EXISTS profit_margin_pct     numeric(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enabled_sections      jsonb,
  ADD COLUMN IF NOT EXISTS per_pick_cost_paise   numeric(10,4),
  -- Full multi-row yarn recipe stored as JSONB arrays for accurate historical replay
  ADD COLUMN IF NOT EXISTS warp_rows             jsonb,
  ADD COLUMN IF NOT EXISTS weft_rows             jsonb;

-- ─── 4. DROP V1-ONLY COLUMNS FROM estimator_quotes ──────────────────────────
-- machine_rate_per_m and daily_overhead are V1 overhead model fields;
-- replaced by overhead_pct (% of direct cost) in V3.
ALTER TABLE estimator_quotes
  DROP COLUMN IF EXISTS machine_rate_per_m,
  DROP COLUMN IF EXISTS daily_overhead;

-- ─── 5. ADD V3 COLUMNS TO estimator_templates ───────────────────────────────
-- Templates now store the full fabric recipe (warp + weft row arrays)
-- so a saved "Canvas Shine" template restores all blend components exactly.
ALTER TABLE estimator_templates
  ADD COLUMN IF NOT EXISTS warp_rows           jsonb,
  ADD COLUMN IF NOT EXISTS weft_rows           jsonb,
  ADD COLUMN IF NOT EXISTS per_pick_cost_paise numeric(10,4);
