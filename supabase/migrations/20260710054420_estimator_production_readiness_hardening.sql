-- Estimator production-readiness hardening.
--
-- Forward-only and tenant-safe:
--   * preserves every existing business row;
--   * completes quote snapshots needed for deterministic reopen/resave;
--   * prevents accidental active quality-name duplicates per organization;
--   * makes estimator writes respect tenant lockdown;
--   * enforces Base/Premium product boundaries in the database;
--   * restores invoker security on the market-run reporting view.

-- ---------------------------------------------------------------------------
-- Complete estimator snapshots and lifecycle timestamps
-- ---------------------------------------------------------------------------

ALTER TABLE public.estimator_quotes
  ADD COLUMN IF NOT EXISTS yarn_shortage_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loom_count integer,
  ADD COLUMN IF NOT EXISTS monthly_working_days integer,
  ADD COLUMN IF NOT EXISTS avg_output_per_loom_per_day numeric,
  ADD COLUMN IF NOT EXISTS source_quote_id uuid REFERENCES public.estimator_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS estimator_quotes_source_quote_id_idx
  ON public.estimator_quotes(source_quote_id)
  WHERE source_quote_id IS NOT NULL;

DROP TRIGGER IF EXISTS estimator_templates_set_updated_at ON public.estimator_templates;
CREATE TRIGGER estimator_templates_set_updated_at
  BEFORE UPDATE ON public.estimator_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS estimator_quotes_set_updated_at ON public.estimator_quotes;
CREATE TRIGGER estimator_quotes_set_updated_at
  BEFORE UPDATE ON public.estimator_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Names are compared case-insensitively after trimming and collapsing internal
-- whitespace. Existing duplicate rows are deliberately not merged or deleted;
-- deployment must stop for manual review if any active ambiguity exists.
CREATE UNIQUE INDEX IF NOT EXISTS estimator_templates_org_normalized_name_active_uidx
  ON public.estimator_templates (
    org_id,
    lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
  )
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- Subscription entitlement helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.org_has_subscription_tier(
  p_org_id uuid,
  p_required text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_org_id IS NOT NULL
    AND p_required IN ('base', 'premium')
    AND (
      auth.role() = 'service_role'
      OR NULLIF(auth.jwt() ->> 'org_id', '')::uuid = p_org_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.org_subscriptions s
      WHERE s.org_id = p_org_id
        AND s.status IN ('active', 'authenticated')
        AND (
          s.current_end IS NULL
          OR s.current_end + CASE
            WHEN s.plan_tier = 'trial' THEN interval '0 seconds'
            ELSE interval '24 hours'
          END >= now()
        )
        AND CASE
          WHEN p_required = 'premium' THEN s.plan_tier IN ('premium', 'trial')
          ELSE s.plan_tier IN ('base', 'premium', 'trial')
        END
    );
$$;

REVOKE ALL ON FUNCTION public.org_has_subscription_tier(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_has_subscription_tier(uuid, text) TO authenticated, service_role;

-- Any authenticated production insert must belong to a Full Suite org. This
-- trigger also executes inside SECURITY DEFINER RPCs, closing the direct-RPC
-- path that otherwise bypasses table RLS. Service-role maintenance remains
-- possible for billing and controlled administration.
CREATE OR REPLACE FUNCTION public.enforce_premium_production_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.role() = 'authenticated'
     AND NOT public.org_has_subscription_tier(NEW.org_id, 'premium') THEN
    RAISE EXCEPTION 'Weavly Full Suite subscription required for production records'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_premium_production_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_premium_production_insert() TO service_role;

DROP TRIGGER IF EXISTS orders_require_premium_insert ON public.orders;
CREATE TRIGGER orders_require_premium_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_premium_production_insert();

DROP TRIGGER IF EXISTS market_runs_require_premium_insert ON public.market_runs;
CREATE TRIGGER market_runs_require_premium_insert
  BEFORE INSERT ON public.market_runs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_premium_production_insert();

-- ---------------------------------------------------------------------------
-- Estimator RLS: current membership, entitlement, and lockdown
-- ---------------------------------------------------------------------------

ALTER TABLE public.estimator_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimator_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_cost_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners Manage Estimator Templates" ON public.estimator_templates;
CREATE POLICY "Owners Manage Estimator Templates"
  ON public.estimator_templates
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND public.org_has_subscription_tier(org_id, 'base')
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND public.org_has_subscription_tier(org_id, 'base')
    AND NOT public.check_org_lockdown(org_id)
  );

CREATE POLICY "Owners Read Estimator Templates"
  ON public.estimator_templates FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND public.org_has_subscription_tier(org_id, 'base')
  );

DROP POLICY IF EXISTS "Owners Manage Estimator Quotes" ON public.estimator_quotes;
CREATE POLICY "Owners Manage Estimator Quotes"
  ON public.estimator_quotes
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND public.org_has_subscription_tier(org_id, 'base')
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND public.org_has_subscription_tier(org_id, 'base')
    AND NOT public.check_org_lockdown(org_id)
  );

CREATE POLICY "Owners Read Estimator Quotes"
  ON public.estimator_quotes FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND public.org_has_subscription_tier(org_id, 'base')
  );

DROP POLICY IF EXISTS "Owners Manage Factory Cost Profile" ON public.factory_cost_profile;
CREATE POLICY "Owners Manage Factory Cost Profile"
  ON public.factory_cost_profile
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND factory_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND public.org_has_subscription_tier(factory_id, 'base')
    AND NOT public.check_org_lockdown(factory_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND factory_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND public.org_has_subscription_tier(factory_id, 'base')
    AND NOT public.check_org_lockdown(factory_id)
  );

CREATE POLICY "Owners Read Factory Cost Profile"
  ON public.factory_cost_profile FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND factory_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND public.org_has_subscription_tier(factory_id, 'base')
  );

-- Existing market-run policies remain readable for premium owners but writes
-- gain an explicit database entitlement predicate.
DROP POLICY IF EXISTS "market_runs_org_select" ON public.market_runs;
CREATE POLICY "market_runs_org_select"
  ON public.market_runs FOR SELECT TO authenticated
  USING (
    org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND public.org_has_subscription_tier(org_id, 'premium')
  );

DROP POLICY IF EXISTS "market_runs_owner_insert" ON public.market_runs;
CREATE POLICY "market_runs_owner_insert"
  ON public.market_runs FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND public.org_has_subscription_tier(org_id, 'premium')
    AND NOT public.check_org_lockdown(org_id)
  );

-- Orders are reachable from quote conversion RPCs and therefore require the
-- same premium predicate for both direct Data API access and RPC-triggered
-- inserts. The insert trigger above is the SECURITY DEFINER backstop.
DROP POLICY IF EXISTS "Tenant Isolation Select Orders" ON public.orders;
DROP POLICY IF EXISTS "orders_owner_writes_when_unlocked" ON public.orders;
CREATE POLICY "orders_premium_select"
  ON public.orders FOR SELECT TO authenticated
  USING (
    org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND public.org_has_subscription_tier(org_id, 'premium')
  );

CREATE POLICY "orders_premium_writes_when_unlocked"
  ON public.orders FOR ALL TO authenticated
  USING (
    org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND public.org_has_subscription_tier(org_id, 'premium')
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND public.org_has_subscription_tier(org_id, 'premium')
    AND NOT public.check_org_lockdown(org_id)
  );

DROP POLICY IF EXISTS "market_runs_owner_update" ON public.market_runs;
CREATE POLICY "market_runs_owner_update"
  ON public.market_runs FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND public.org_has_subscription_tier(org_id, 'premium')
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND public.org_has_subscription_tier(org_id, 'premium')
    AND NOT public.check_org_lockdown(org_id)
  );

-- PostgreSQL views otherwise execute with the view owner's privileges. Invoker
-- security forces every underlying market-run relation to apply caller RLS.
ALTER VIEW public.market_run_summary SET (security_invoker = true);
REVOKE ALL ON public.market_run_summary FROM anon;
GRANT SELECT ON public.market_run_summary TO authenticated, service_role;
