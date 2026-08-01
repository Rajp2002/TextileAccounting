-- Sprint 3: persist the owner-selected costing profile without changing
-- estimator formulas or historical costing snapshots.
ALTER TABLE public.factory_cost_profile
  ADD COLUMN IF NOT EXISTS factory_profile_key text NOT NULL DEFAULT 'unselected';

-- New profiles must not quietly start with selling charges or a made-up
-- production denominator. Existing rows keep their saved values.
ALTER TABLE public.factory_cost_profile
  ALTER COLUMN default_commission_pct SET DEFAULT 0,
  ALTER COLUMN monthly_output_m SET DEFAULT 0,
  ALTER COLUMN enabled_sections SET DEFAULT '{
    "winding": false,
    "processing": false,
    "finishing": false,
    "commission": false,
    "transport": false
  }'::jsonb;

ALTER TABLE public.factory_cost_profile
  DROP CONSTRAINT IF EXISTS factory_cost_profile_factory_profile_key_check,
  ADD CONSTRAINT factory_cost_profile_factory_profile_key_check
    CHECK (factory_profile_key IN (
      'unselected',
      'grey_weaver',
      'job_weaver',
      'processed_fabric',
      'full_mill',
      'custom'
    ));

-- Preserve existing numbers and sections. Only exact section maps receive a
-- known label; everything else remains visibly custom rather than being
-- silently reclassified.
UPDATE public.factory_cost_profile
SET factory_profile_key = CASE
  WHEN enabled_sections = '{"winding":false,"processing":false,"finishing":false,"commission":false,"transport":false}'::jsonb
    THEN 'grey_weaver'
  WHEN enabled_sections = '{"winding":true,"processing":false,"finishing":false,"commission":false,"transport":false}'::jsonb
    THEN 'job_weaver'
  WHEN enabled_sections = '{"winding":false,"processing":true,"finishing":true,"commission":false,"transport":false}'::jsonb
    THEN 'processed_fabric'
  WHEN enabled_sections = '{"winding":true,"processing":true,"finishing":true,"commission":false,"transport":false}'::jsonb
    THEN 'full_mill'
  ELSE 'custom'
END
WHERE factory_profile_key = 'unselected';

COMMENT ON COLUMN public.factory_cost_profile.factory_profile_key IS
  'Owner-selected costing setup. It describes default sections only and is not a costing formula input.';
