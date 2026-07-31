-- Sprint 3: make Base costings quality-first and persist the factory overhead method.
-- Existing percentage snapshots remain intact for historical compatibility, but
-- the percentage is no longer a user-editable costing assumption.

ALTER TABLE public.factory_cost_profile
  ADD COLUMN IF NOT EXISTS overhead_mode text NOT NULL DEFAULT 'monthly_expenses';

UPDATE public.factory_cost_profile
SET overhead_mode = CASE
  WHEN overhead_override_per_m IS NOT NULL THEN 'direct'
  ELSE 'monthly_expenses'
END
WHERE overhead_mode IS NULL
   OR overhead_mode NOT IN ('direct', 'monthly_expenses');

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.factory_cost_profile'::regclass
      AND conname = 'factory_cost_profile_overhead_mode_check'
  ) THEN
    ALTER TABLE public.factory_cost_profile
      ADD CONSTRAINT factory_cost_profile_overhead_mode_check
      CHECK (overhead_mode IN ('direct', 'monthly_expenses'));
  END IF;
END;
$constraints$;

COMMENT ON COLUMN public.factory_cost_profile.overhead_mode IS
  'Persisted overhead method: direct uses overhead_override_per_m; monthly_expenses divides overhead_items by monthly_output_m.';

-- The old percentage column remains only for compatibility with deployed
-- readers and database functions. Sprint 3 no longer calculates, displays,
-- or stores a percentage metric for new profiles or snapshots.
ALTER TABLE public.factory_cost_profile
  ALTER COLUMN overhead_pct SET DEFAULT 0;

UPDATE public.factory_cost_profile
SET overhead_pct = 0
WHERE overhead_pct IS DISTINCT FROM 0;

COMMENT ON COLUMN public.factory_cost_profile.overhead_pct IS
  'Legacy compatibility column. Not used by the Sprint 3 estimator workflow.';

COMMENT ON COLUMN public.estimator_quotes.overhead_pct IS
  'Legacy compatibility column. New estimator snapshots store 0 and use overhead method inputs instead.';

-- A Base costing has no customer identity. Full Suite quotations and orders
-- continue to validate their customer at the application/RPC boundary.
ALTER TABLE public.estimator_quotes
  ALTER COLUMN party_name DROP NOT NULL;

COMMENT ON COLUMN public.estimator_quotes.party_name IS
  'Optional for standalone costings; required for customer quotations and party orders.';
