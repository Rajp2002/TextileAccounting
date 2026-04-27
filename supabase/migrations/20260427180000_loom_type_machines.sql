-- ============================================================
-- MIGRATION: Loom Type on Machines + Quote/Template Snapshots
-- Fixes: RPM/power defaults per loom class, sizing mode audit trail
-- ============================================================

-- ─── 1. machines: add loom type + operational defaults ────────────────────────
-- Nullable so existing machine records are not broken.
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS loom_type text
    CHECK (loom_type IN (
      'water_jet', 'rapier', 'air_jet',
      'jacquard_electronic', 'jacquard_mechanical',
      'projectile', 'dobby', 'other'
    )),
  ADD COLUMN IF NOT EXISTS default_rpm     decimal,
  ADD COLUMN IF NOT EXISTS default_power_kw decimal;

COMMENT ON COLUMN machines.loom_type      IS 'Physical loom classification — drives RPM/power defaults on machine card and Pace Index forecast';
COMMENT ON COLUMN machines.default_rpm    IS 'Operational RPM for this specific machine (overrides class default if set)';
COMMENT ON COLUMN machines.default_power_kw IS 'Power draw kW for this machine (overrides class default if set)';

-- ─── 2. estimator_quotes: snapshot columns for loom type + sizing mode ────────
-- Captures the costing assumptions at the moment the quote was created.
-- Without these, loading a historical quote does not show what loom type or
-- sizing mode was used, making the cost audit trail incomplete.
ALTER TABLE estimator_quotes
  ADD COLUMN IF NOT EXISTS loom_type         text
    CHECK (loom_type IN (
      'water_jet', 'rapier', 'air_jet',
      'jacquard_electronic', 'jacquard_mechanical',
      'projectile', 'dobby', 'other'
    )),
  ADD COLUMN IF NOT EXISTS estimator_rpm      decimal,
  ADD COLUMN IF NOT EXISTS estimator_power_kw decimal,
  ADD COLUMN IF NOT EXISTS hours_per_shift    decimal,
  ADD COLUMN IF NOT EXISTS sizing_mode        text
    CHECK (sizing_mode IN ('in_house', 'outsourced'));

COMMENT ON COLUMN estimator_quotes.loom_type       IS 'Loom type selected in Estimator at quote time — costing assumption, NOT machine assignment';
COMMENT ON COLUMN estimator_quotes.estimator_rpm   IS 'RPM value used for daily output preview and Suggest calculation at quote time';
COMMENT ON COLUMN estimator_quotes.estimator_power_kw IS 'Power draw used for electricity cost calculation at quote time';
COMMENT ON COLUMN estimator_quotes.sizing_mode     IS 'in_house = sizing cost was 0 (absorbed in overhead); outsourced = sizing_rate_per_kg was applied';

-- ─── 3. estimator_templates: persist loom type for full recipe restore ────────
-- When a template is loaded, loom type + RPM + sizing mode should restore so
-- the owner does not need to re-select them on every quote.
ALTER TABLE estimator_templates
  ADD COLUMN IF NOT EXISTS loom_type         text
    CHECK (loom_type IN (
      'water_jet', 'rapier', 'air_jet',
      'jacquard_electronic', 'jacquard_mechanical',
      'projectile', 'dobby', 'other'
    )),
  ADD COLUMN IF NOT EXISTS loom_rpm          decimal,
  ADD COLUMN IF NOT EXISTS loom_power_kw     decimal,
  ADD COLUMN IF NOT EXISTS sizing_mode       text
    CHECK (sizing_mode IN ('in_house', 'outsourced')),
  ADD COLUMN IF NOT EXISTS hours_per_shift   decimal;

COMMENT ON COLUMN estimator_templates.loom_type    IS 'Loom type stored with template so loading it restores the full costing recipe';
COMMENT ON COLUMN estimator_templates.sizing_mode  IS 'Sizing mode at time of template save — in_house or outsourced';
