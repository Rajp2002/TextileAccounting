-- Base estimator Sprint 2: reviewed rate memory and immutable costing versions.

ALTER TABLE public.factory_cost_profile
  ADD COLUMN IF NOT EXISTS default_warp_yarn_name text NOT NULL DEFAULT 'Warp yarn',
  ADD COLUMN IF NOT EXISTS default_warp_yarn_rate_per_kg numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_weft_yarn_name text NOT NULL DEFAULT 'Weft yarn',
  ADD COLUMN IF NOT EXISTS default_weft_yarn_rate_per_kg numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_processing_rate_per_m numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_finishing_rate_per_m numeric(10,2) NOT NULL DEFAULT 0;

CREATE TABLE public.cost_rate_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  category text NOT NULL CHECK (category IN (
    'yarn_warp', 'yarn_weft', 'warping', 'sizing', 'winding',
    'processing', 'finishing', 'transport', 'commission', 'overhead'
  )),
  unit text NOT NULL CHECK (unit IN ('per_kg', 'per_m', 'percent')),
  current_value numeric(12,4) NOT NULL CHECK (current_value >= 0),
  previous_value numeric(12,4),
  effective_date date NOT NULL DEFAULT current_date,
  last_reviewed_at date NOT NULL DEFAULT current_date,
  review_interval_days integer NOT NULL DEFAULT 90 CHECK (review_interval_days BETWEEN 1 AND 1095),
  source text,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  apply_as_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name, category)
);

CREATE INDEX cost_rate_book_org_active_idx
  ON public.cost_rate_book(org_id, is_active, category);

CREATE TABLE public.cost_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rate_id uuid NOT NULL REFERENCES public.cost_rate_book(id) ON DELETE CASCADE,
  value numeric(12,4) NOT NULL CHECK (value >= 0),
  effective_date date NOT NULL,
  source text,
  notes text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cost_rate_history_rate_idx
  ON public.cost_rate_history(rate_id, effective_date DESC, created_at DESC);

ALTER TABLE public.cost_rate_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_rate_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cost_rate_book, public.cost_rate_history FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cost_rate_book TO authenticated;
GRANT SELECT, INSERT ON TABLE public.cost_rate_history TO authenticated;

CREATE POLICY "Owners manage cost rate book" ON public.cost_rate_book
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "Owners read cost rate history" ON public.cost_rate_history
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "Owners append cost rate history" ON public.cost_rate_history
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

ALTER TABLE public.estimator_quotes
  ADD COLUMN IF NOT EXISTS costing_group_id uuid,
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1 CHECK (version_number > 0),
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

UPDATE public.estimator_quotes
SET costing_group_id = id
WHERE costing_group_id IS NULL;

ALTER TABLE public.estimator_quotes
  ALTER COLUMN costing_group_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN costing_group_id SET NOT NULL;

CREATE INDEX estimator_quotes_costing_versions_idx
  ON public.estimator_quotes(org_id, costing_group_id, version_number DESC);

DO $audit$
BEGIN
  IF to_regprocedure('public.log_settings_audit_event()') IS NOT NULL THEN
    CREATE TRIGGER audit_settings_cost_rate_book
      AFTER INSERT OR UPDATE OR DELETE ON public.cost_rate_book
      FOR EACH ROW EXECUTE FUNCTION public.log_settings_audit_event();
  END IF;
END;
$audit$;

COMMENT ON TABLE public.cost_rate_book IS
  'Organization-scoped reviewed costing defaults. Saved estimator_quotes remain immutable snapshots.';
COMMENT ON TABLE public.cost_rate_history IS
  'Append-only value history for cost_rate_book entries.';
