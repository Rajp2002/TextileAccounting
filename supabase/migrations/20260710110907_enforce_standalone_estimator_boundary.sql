-- Enforce the standalone Estimator commercial boundary at the database layer.
--
-- Base tenants keep authentication, billing, referral, factory-cost-profile,
-- template, and quote access. Every other tenant-owned table is Full Suite.
-- Restrictive RLS handles direct Data API access; a generic mutation trigger
-- also executes inside SECURITY DEFINER RPCs so those RPCs cannot bypass the
-- subscription boundary. Read-only production analytics RPCs receive the same
-- live entitlement guard below.

-- ---------------------------------------------------------------------------
-- Quote idempotency and same-tenant version links
-- ---------------------------------------------------------------------------

ALTER TABLE public.estimator_quotes
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS estimator_quotes_org_client_request_unique
  ON public.estimator_quotes (org_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.estimator_quotes'::regclass
      AND conname = 'estimator_quotes_org_id_id_key'
  ) THEN
    ALTER TABLE public.estimator_quotes
      ADD CONSTRAINT estimator_quotes_org_id_id_key UNIQUE (org_id, id);
  END IF;
END;
$constraints$;

ALTER TABLE public.estimator_quotes
  DROP CONSTRAINT IF EXISTS estimator_quotes_source_quote_id_fkey,
  DROP CONSTRAINT IF EXISTS estimator_quotes_source_quote_same_org_fkey;

ALTER TABLE public.estimator_quotes
  ADD CONSTRAINT estimator_quotes_source_quote_same_org_fkey
  FOREIGN KEY (org_id, source_quote_id)
  REFERENCES public.estimator_quotes (org_id, id)
  ON DELETE SET NULL (source_quote_id)
  NOT VALID;

ALTER TABLE public.estimator_quotes
  VALIDATE CONSTRAINT estimator_quotes_source_quote_same_org_fkey;

COMMENT ON COLUMN public.estimator_quotes.client_request_id IS
  'Client-generated UUID for retry-safe quote create/update idempotency within one organization.';

-- ---------------------------------------------------------------------------
-- Live membership and subscription source of truth
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
      OR (
        auth.role() = 'authenticated'
        AND NULLIF(auth.jwt() ->> 'org_id', '')::uuid = p_org_id
        AND EXISTS (
          SELECT 1
          FROM public.profiles AS membership
          WHERE membership.id = auth.uid()
            AND membership.org_id = p_org_id
            AND membership.role::text = auth.jwt() ->> 'user_role'
        )
        AND EXISTS (
          SELECT 1
          FROM public.org_subscriptions AS subscription
          WHERE subscription.org_id = p_org_id
            AND subscription.status IN ('active', 'authenticated')
            AND (subscription.current_start IS NULL OR subscription.current_start <= now())
            AND (
              subscription.current_end IS NULL
              OR subscription.current_end + CASE
                WHEN subscription.plan_tier = 'trial' THEN interval '0 seconds'
                ELSE interval '24 hours'
              END >= now()
            )
            AND CASE
              WHEN p_required = 'premium' THEN subscription.plan_tier IN ('premium', 'trial')
              ELSE subscription.plan_tier IN ('base', 'premium', 'trial')
            END
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.org_has_subscription_tier(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_has_subscription_tier(uuid, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Direct Data API and SECURITY DEFINER mutation boundary
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_premium_tenant_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old_org_id uuid;
  v_new_org_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_org_id := OLD.org_id;
    IF NOT public.org_has_subscription_tier(v_old_org_id, 'premium') THEN
      RAISE EXCEPTION 'Weavly Full Suite subscription required for production records'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_org_id := NEW.org_id;
    IF NOT public.org_has_subscription_tier(v_new_org_id, 'premium') THEN
      RAISE EXCEPTION 'Weavly Full Suite subscription required for production records'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_premium_tenant_mutation()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_premium_tenant_mutation()
  TO service_role;

DO $premium_tables$
DECLARE
  v_table record;
BEGIN
  FOR v_table IN
    SELECT DISTINCT column_info.table_name
    FROM information_schema.columns AS column_info
    JOIN information_schema.tables AS table_info
      ON table_info.table_schema = column_info.table_schema
     AND table_info.table_name = column_info.table_name
     AND table_info.table_type = 'BASE TABLE'
    WHERE column_info.table_schema = 'public'
      AND column_info.column_name = 'org_id'
      AND column_info.table_name NOT IN (
        'profiles',
        'org_subscriptions',
        'subscription_payments',
        'estimator_settings',
        'estimator_templates',
        'estimator_quotes',
        'referral_codes',
        'referral_uses',
        'referral_discount_windows',
        'referral_refunds'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table.table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', v_table.table_name);
    EXECUTE format(
      'DROP POLICY IF EXISTS requires_premium_subscription ON public.%I',
      v_table.table_name
    );
    EXECUTE format(
      'CREATE POLICY requires_premium_subscription ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      || 'USING (public.org_has_subscription_tier(org_id, ''premium'')) '
      || 'WITH CHECK (public.org_has_subscription_tier(org_id, ''premium''))',
      v_table.table_name
    );

    -- Audit rows are inserted by hardened audit trigger functions. Applying a
    -- subscription trigger to audit_log itself would block a valid Base quote
    -- or template write while its audit event is recorded.
    IF v_table.table_name <> 'audit_log' THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS require_premium_tenant_mutation ON public.%I',
        v_table.table_name
      );
      EXECUTE format(
        'CREATE TRIGGER require_premium_tenant_mutation '
        || 'BEFORE INSERT OR UPDATE OR DELETE ON public.%I '
        || 'FOR EACH ROW EXECUTE FUNCTION public.enforce_premium_tenant_mutation()',
        v_table.table_name
      );
    END IF;
  END LOOP;
END;
$premium_tables$;

-- ---------------------------------------------------------------------------
-- Read-only SECURITY DEFINER production analytics RPC boundary
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_premium_rpc_access(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.role() IN ('authenticated', 'anon')
     AND NOT public.org_has_subscription_tier(p_org_id, 'premium') THEN
    RAISE EXCEPTION 'Weavly Full Suite subscription required for production analytics'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_premium_rpc_access(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_premium_rpc_access(uuid)
  TO service_role;

-- Preserve each established RPC body and return type while inserting the same
-- entitlement prelude. This keeps migration replay deterministic against the
-- immediately preceding schema and avoids copying nine large analytics bodies
-- into a second source of truth.
DO $guard_analytics$
DECLARE
  v_function record;
  v_body text;
  v_volatility text;
BEGIN
  FOR v_function IN
    SELECT
      proc.oid,
      proc.proname,
      proc.prosrc,
      proc.provolatile,
      pg_get_function_arguments(proc.oid) AS arguments,
      pg_get_function_result(proc.oid) AS result_type
    FROM pg_proc AS proc
    JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
    JOIN pg_language AS language ON language.oid = proc.prolang
    WHERE namespace.nspname = 'public'
      AND language.lanname = 'plpgsql'
      AND proc.proname IN (
        'get_active_orders_with_pace',
        'get_batch_yield_report',
        'get_daily_brief_stats',
        'get_daily_brief_stats_v2',
        'get_kpi_today_live',
        'get_kpi_yesterday',
        'get_worker_breakdown_today',
        'get_yield_alert'
      )
  LOOP
    IF position('assert_premium_rpc_access' IN v_function.prosrc) > 0 THEN
      CONTINUE;
    END IF;

    v_body := regexp_replace(
      v_function.prosrc,
      '\mbegin\M',
      E'BEGIN\n  PERFORM public.assert_premium_rpc_access(p_org_id);',
      'i'
    );
    IF v_body = v_function.prosrc THEN
      RAISE EXCEPTION 'Could not add premium guard to public.%', v_function.proname;
    END IF;

    v_volatility := CASE v_function.provolatile
      WHEN 'i' THEN 'IMMUTABLE'
      WHEN 's' THEN 'STABLE'
      ELSE 'VOLATILE'
    END;

    EXECUTE format(
      'CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s '
      || 'LANGUAGE plpgsql %s SECURITY DEFINER '
      || 'SET search_path = pg_catalog, public AS %L',
      v_function.proname,
      v_function.arguments,
      v_function.result_type,
      v_volatility,
      v_body
    );
  END LOOP;
END;
$guard_analytics$;

DO $guard_forecast$
DECLARE
  v_function record;
  v_body text;
  v_volatility text;
BEGIN
  SELECT
    proc.oid,
    proc.proname,
    proc.prosrc,
    proc.provolatile,
    pg_get_function_arguments(proc.oid) AS arguments,
    pg_get_function_result(proc.oid) AS result_type
  INTO v_function
  FROM pg_proc AS proc
  JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
  JOIN pg_language AS language ON language.oid = proc.prolang
  WHERE namespace.nspname = 'public'
    AND language.lanname = 'plpgsql'
    AND proc.proname = 'get_order_forecast';

  IF v_function.oid IS NOT NULL
     AND position('assert_premium_rpc_access' IN v_function.prosrc) = 0 THEN
    v_body := regexp_replace(
      v_function.prosrc,
      '\mbegin\M',
      E'BEGIN\n  PERFORM public.assert_premium_rpc_access((SELECT org_id FROM public.orders WHERE id = p_order_id));',
      'i'
    );
    IF v_body = v_function.prosrc THEN
      RAISE EXCEPTION 'Could not add premium guard to public.get_order_forecast';
    END IF;

    v_volatility := CASE v_function.provolatile
      WHEN 'i' THEN 'IMMUTABLE'
      WHEN 's' THEN 'STABLE'
      ELSE 'VOLATILE'
    END;

    EXECUTE format(
      'CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s '
      || 'LANGUAGE plpgsql %s SECURITY DEFINER '
      || 'SET search_path = pg_catalog, public AS %L',
      v_function.proname,
      v_function.arguments,
      v_function.result_type,
      v_volatility,
      v_body
    );
  END IF;
END;
$guard_forecast$;

-- Remove anonymous execution inherited from PostgreSQL's default PUBLIC grant
-- on functions. Preserve the authenticated surface that existed immediately
-- before this migration, except for trigger/event-trigger internals and the
-- administrative rls_auto_enable helper.
DO $secure_definer_acl$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT
      proc.oid,
      proc.proname,
      proc.prorettype,
      has_function_privilege('authenticated', proc.oid, 'EXECUTE') AS authenticated_had_execute,
      proc.oid::regprocedure::text AS signature
    FROM pg_proc AS proc
    JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'public'
      AND proc.prosecdef
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
      v_function.signature
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      v_function.signature
    );

    IF v_function.authenticated_had_execute
       AND v_function.prorettype NOT IN (
         'pg_catalog.trigger'::regtype,
         'pg_catalog.event_trigger'::regtype
       )
       AND v_function.proname <> 'rls_auto_enable' THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO authenticated',
        v_function.signature
      );
    END IF;
  END LOOP;
END;
$secure_definer_acl$;

-- ---------------------------------------------------------------------------
-- Orders remain readable to eligible Premium supervisors but only owners may
-- mutate them. The earlier hardening migration unintentionally widened writes.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS orders_premium_writes_when_unlocked ON public.orders;
CREATE POLICY orders_premium_writes_when_unlocked
  ON public.orders FOR ALL TO authenticated
  USING (
    org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND (auth.jwt() ->> 'user_role') = 'owner'
    AND public.org_has_subscription_tier(org_id, 'premium')
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND (auth.jwt() ->> 'user_role') = 'owner'
    AND public.org_has_subscription_tier(org_id, 'premium')
    AND NOT public.check_org_lockdown(org_id)
  );
