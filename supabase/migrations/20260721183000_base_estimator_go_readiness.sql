-- Base Estimator pilot-readiness hardening: one paid-through entitlement rule,
-- protected rate memory, deterministic costing revisions, valid cost profiles,
-- and a compilable tenant-lockdown RPC.

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
            AND subscription.status IN (
              'active', 'authenticated', 'pending', 'paused',
              'halted', 'cancelled', 'completed'
            )
            AND (subscription.current_start IS NULL OR subscription.current_start <= now())
            AND (
              (subscription.current_end IS NULL AND subscription.status IN ('active', 'authenticated'))
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

REVOKE ALL ON FUNCTION public.org_has_subscription_tier(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_has_subscription_tier(uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Owners manage cost rate book" ON public.cost_rate_book;
DROP POLICY IF EXISTS "Owners read cost rate book" ON public.cost_rate_book;
DROP POLICY IF EXISTS "Owners insert cost rate book" ON public.cost_rate_book;
DROP POLICY IF EXISTS "Owners update cost rate book" ON public.cost_rate_book;
DROP POLICY IF EXISTS "Owners delete cost rate book" ON public.cost_rate_book;

CREATE POLICY "Owners read cost rate book" ON public.cost_rate_book
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.jwt()) ->> 'user_role') = 'owner'
    AND org_id = (((SELECT auth.jwt()) ->> 'org_id')::uuid)
    AND public.org_has_subscription_tier(org_id, 'base')
  );
CREATE POLICY "Owners insert cost rate book" ON public.cost_rate_book
  FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT auth.jwt()) ->> 'user_role') = 'owner'
    AND org_id = (((SELECT auth.jwt()) ->> 'org_id')::uuid)
    AND public.org_has_subscription_tier(org_id, 'base')
    AND NOT public.check_org_lockdown(org_id)
  );
CREATE POLICY "Owners update cost rate book" ON public.cost_rate_book
  FOR UPDATE TO authenticated
  USING (
    ((SELECT auth.jwt()) ->> 'user_role') = 'owner'
    AND org_id = (((SELECT auth.jwt()) ->> 'org_id')::uuid)
    AND public.org_has_subscription_tier(org_id, 'base')
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    ((SELECT auth.jwt()) ->> 'user_role') = 'owner'
    AND org_id = (((SELECT auth.jwt()) ->> 'org_id')::uuid)
    AND public.org_has_subscription_tier(org_id, 'base')
    AND NOT public.check_org_lockdown(org_id)
  );
CREATE POLICY "Owners delete cost rate book" ON public.cost_rate_book
  FOR DELETE TO authenticated
  USING (
    ((SELECT auth.jwt()) ->> 'user_role') = 'owner'
    AND org_id = (((SELECT auth.jwt()) ->> 'org_id')::uuid)
    AND public.org_has_subscription_tier(org_id, 'base')
    AND NOT public.check_org_lockdown(org_id)
  );

DROP POLICY IF EXISTS "Owners read cost rate history" ON public.cost_rate_history;
DROP POLICY IF EXISTS "Owners append cost rate history" ON public.cost_rate_history;
CREATE POLICY "Owners read cost rate history" ON public.cost_rate_history
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.jwt()) ->> 'user_role') = 'owner'
    AND org_id = (((SELECT auth.jwt()) ->> 'org_id')::uuid)
    AND public.org_has_subscription_tier(org_id, 'base')
  );
CREATE POLICY "Owners append cost rate history" ON public.cost_rate_history
  FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT auth.jwt()) ->> 'user_role') = 'owner'
    AND org_id = (((SELECT auth.jwt()) ->> 'org_id')::uuid)
    AND public.org_has_subscription_tier(org_id, 'base')
    AND NOT public.check_org_lockdown(org_id)
  );

WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY org_id, COALESCE(template_id::text, lower(btrim(quality_label)))
      ORDER BY created_at, id
    ) AS group_id,
    row_number() OVER (
      PARTITION BY org_id, COALESCE(template_id::text, lower(btrim(quality_label)))
      ORDER BY created_at, id
    ) AS revision
  FROM public.estimator_quotes
  WHERE record_kind = 'costing'
)
UPDATE public.estimator_quotes AS quote
SET costing_group_id = ranked.group_id,
    version_number = ranked.revision
FROM ranked
WHERE quote.id = ranked.id
  AND (
    quote.costing_group_id IS DISTINCT FROM ranked.group_id
    OR quote.version_number IS DISTINCT FROM ranked.revision
  );

CREATE OR REPLACE FUNCTION public.assign_standalone_costing_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_previous public.estimator_quotes%ROWTYPE;
  v_identity text;
BEGIN
  IF NEW.record_kind IS DISTINCT FROM 'costing' OR NEW.source_quote_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_identity := NEW.org_id::text || ':' || COALESCE(NEW.template_id::text, lower(btrim(NEW.quality_label)));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_identity, 0));

  SELECT * INTO v_previous
  FROM public.estimator_quotes AS quote
  WHERE quote.org_id = NEW.org_id
    AND quote.record_kind = 'costing'
    AND (
      (NEW.template_id IS NOT NULL AND quote.template_id = NEW.template_id)
      OR (NEW.template_id IS NULL AND quote.template_id IS NULL AND lower(btrim(quote.quality_label)) = lower(btrim(NEW.quality_label)))
    )
  ORDER BY quote.version_number DESC, quote.created_at DESC, quote.id DESC
  LIMIT 1;

  IF FOUND THEN
    NEW.costing_group_id := COALESCE(v_previous.costing_group_id, v_previous.id);
    NEW.version_number := COALESCE(v_previous.version_number, 0) + 1;
  ELSE
    NEW.costing_group_id := COALESCE(NEW.costing_group_id, NEW.id);
    NEW.version_number := 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estimator_quotes_assign_costing_revision ON public.estimator_quotes;
CREATE TRIGGER estimator_quotes_assign_costing_revision
  BEFORE INSERT ON public.estimator_quotes
  FOR EACH ROW EXECUTE FUNCTION public.assign_standalone_costing_revision();

ALTER TABLE public.factory_cost_profile
  DROP CONSTRAINT IF EXISTS factory_cost_profile_valid_economics,
  ADD CONSTRAINT factory_cost_profile_valid_economics CHECK (
    warping_rate_per_kg <> 'NaN'::numeric AND warping_rate_per_kg >= 0
    AND sizing_rate_per_kg <> 'NaN'::numeric AND sizing_rate_per_kg >= 0
    AND winding_rate_per_kg <> 'NaN'::numeric AND winding_rate_per_kg >= 0
    AND overhead_pct <> 'NaN'::numeric AND overhead_pct BETWEEN 0 AND 100
    AND default_commission_pct <> 'NaN'::numeric AND default_commission_pct BETWEEN 0 AND 99.99
    AND default_transport_per_m <> 'NaN'::numeric AND default_transport_per_m >= 0
    AND (overhead_override_per_m IS NULL OR (overhead_override_per_m <> 'NaN'::numeric AND overhead_override_per_m >= 0))
    AND loom_count >= 0
    AND monthly_working_days BETWEEN 1 AND 31
    AND avg_output_per_loom_per_day <> 'NaN'::numeric AND avg_output_per_loom_per_day > 0
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.lockdown_tenant(
  p_org_id uuid,
  p_reason text,
  p_severity text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_affected_count bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can trigger tenant isolation.';
  END IF;
  IF p_severity NOT IN ('low', 'medium', 'high', 'critical') OR btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'A valid reason and severity are required.';
  END IF;

  UPDATE public.organizations
  SET is_locked_down = true,
      locked_at = now(),
      locked_by = auth.uid(),
      lockdown_reason = p_reason,
      lockdown_severity = p_severity
  WHERE id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization not found.'; END IF;

  SELECT
    (SELECT count(*) FROM public.workers WHERE org_id = p_org_id)
    + (SELECT count(*) FROM public.profiles WHERE org_id = p_org_id)
  INTO v_affected_count;

  INSERT INTO public.breach_reports (
    org_id, severity, description, affected_users_count, filed_by, auto_generated_data
  ) VALUES (
    p_org_id, p_severity, p_reason, v_affected_count, auth.uid(),
    jsonb_build_object('detection_date', now(), 'affected_count', v_affected_count, 'reason', p_reason, 'severity', p_severity)
  );
  INSERT INTO public.audit_log (org_id, table_name, record_id, action, new_data, changed_by)
  VALUES (p_org_id, 'organizations', p_org_id::text, 'UPDATE', jsonb_build_object('is_locked_down', true, 'reason', p_reason), auth.uid());

  RETURN jsonb_build_object('success', true, 'locked_at', now(), 'affected_users', v_affected_count);
END;
$$;

REVOKE ALL ON FUNCTION public.lockdown_tenant(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lockdown_tenant(uuid, text, text) TO service_role;
