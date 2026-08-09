-- Keep a blank/new estimator neutral: crimp is optional and must not affect
-- costing unless the owner explicitly enters a value.
ALTER TABLE public.factory_cost_profile
  ALTER COLUMN warp_crimp_pct SET DEFAULT 0.00;

ALTER TABLE public.estimator_templates
  ALTER COLUMN warp_crimp_pct SET DEFAULT 0.00;

ALTER TABLE public.estimator_quotes
  ALTER COLUMN warp_crimp_pct SET DEFAULT 0.00;
