-- ============================================================
-- MIGRATION: Fix estimator_templates for V3 compatibility
-- 1. Make legacy hard-typed columns nullable (V3 uses warp_rows JSON)
-- 2. Add yarn_shortage_pct for template storage
-- 3. Ensure warp_rows, weft_rows, per_pick_cost_paise columns exist
--    (already added by 20260404100000, but safe with IF NOT EXISTS)
-- ============================================================

-- Make legacy NOT NULL columns nullable so V3 inserts (which supply JSON arrays
-- instead of flat denier/ppi/gsm values) don't fail on constraint violations.
ALTER TABLE estimator_templates
  ALTER COLUMN ppi         DROP NOT NULL,
  ALTER COLUMN yarn_denier DROP NOT NULL,
  ALTER COLUMN gsm         DROP NOT NULL;

-- Add yarn shortage % to template recipe (so it survives round-trips)
ALTER TABLE estimator_templates
  ADD COLUMN IF NOT EXISTS yarn_shortage_pct numeric(5,2) DEFAULT 10;

-- Ensure V3 JSON columns exist (safe if already present)
ALTER TABLE estimator_templates
  ADD COLUMN IF NOT EXISTS warp_rows           jsonb,
  ADD COLUMN IF NOT EXISTS weft_rows           jsonb,
  ADD COLUMN IF NOT EXISTS per_pick_cost_paise numeric(10,4);

COMMENT ON COLUMN estimator_templates.warp_rows IS
  'V3 full warp recipe: [{id,calcDenier,beamEnds,yarnRate,gstPct,shortagePct,label?}]';

COMMENT ON COLUMN estimator_templates.weft_rows IS
  'V3 full weft recipe: [{id,picks,reedSpace,calcDenier,yarnRate,gstPct,shortagePct,label?}]';

COMMENT ON COLUMN estimator_templates.yarn_shortage_pct IS
  'Combined yarn shortage % stored with the template recipe.';
