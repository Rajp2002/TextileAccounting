-- ============================================================
-- MIGRATION: Estimator V2 — Surat Textile Formula
-- Replaces GSM-based formula with Denier + Beam Ends + Picks logic
-- ============================================================

-- 1. Add new columns to estimator_templates for Surat weaving specs
ALTER TABLE estimator_templates
    ADD COLUMN IF NOT EXISTS calculated_yarn_denier DECIMAL,       -- combined/effective denier e.g. 75/2 = 37.5
    ADD COLUMN IF NOT EXISTS beam_ends INTEGER,                    -- total warp ends on beam
    ADD COLUMN IF NOT EXISTS reed_space DECIMAL DEFAULT 110,       -- fabric width in cm
    ADD COLUMN IF NOT EXISTS tape_length_m DECIMAL DEFAULT 100,    -- meters per beam tape
    ADD COLUMN IF NOT EXISTS shrinkage_pct DECIMAL DEFAULT 5.0,    -- warp + weft combined shrinkage %
    ADD COLUMN IF NOT EXISTS weft_denier DECIMAL,                  -- weft yarn denier (can differ from warp)
    ADD COLUMN IF NOT EXISTS machine_rate_per_m DECIMAL DEFAULT 1.5; -- flat machine rate ₹/m

-- 2. Add new columns to estimator_settings
ALTER TABLE estimator_settings
    ADD COLUMN IF NOT EXISTS machine_rate_per_m DECIMAL DEFAULT 1.50,   -- default flat machine cost ₹/m
    ADD COLUMN IF NOT EXISTS daily_overhead DECIMAL DEFAULT 0,           -- total factory daily fixed cost ₹
    ADD COLUMN IF NOT EXISTS total_active_machines INTEGER DEFAULT 24;   -- for overhead distribution

-- 3. Update estimator_quotes to capture new fields
ALTER TABLE estimator_quotes
    ADD COLUMN IF NOT EXISTS quality_label TEXT,                  -- free-text name e.g. "Canvas Shine"
    ADD COLUMN IF NOT EXISTS beam_ends INTEGER,
    ADD COLUMN IF NOT EXISTS reed_space DECIMAL,
    ADD COLUMN IF NOT EXISTS tape_length_m DECIMAL,
    ADD COLUMN IF NOT EXISTS shrinkage_pct DECIMAL,
    ADD COLUMN IF NOT EXISTS weft_denier DECIMAL,
    ADD COLUMN IF NOT EXISTS machine_rate_per_m DECIMAL,
    ADD COLUMN IF NOT EXISTS daily_overhead DECIMAL,
    ADD COLUMN IF NOT EXISTS warp_instruction TEXT,               -- for floor order conversion
    ADD COLUMN IF NOT EXISTS weft_instruction TEXT;

-- Make old fields optional for backward compat
ALTER TABLE estimator_quotes
    ALTER COLUMN ppi DROP NOT NULL,
    ALTER COLUMN gsm DROP NOT NULL;
