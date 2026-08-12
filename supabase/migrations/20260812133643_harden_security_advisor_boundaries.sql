-- ============================================================
-- SECURITY: close live Supabase advisor boundaries
--
-- This migration keeps the intentionally exposed owner/dashboard RPCs
-- tenant-bound, moves server-only mutations behind service_role, fixes all
-- mutable function search paths reported by the advisor, and makes the
-- global lockdown path an explicit admin/invoker operation.
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1. Make every advisor-reported mutable function search path explicit.
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.assign_fabric_package_no()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.auto_complete_order_on_log()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.block_production_on_completed_order()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.check_order_target_before_log()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.create_fabric_dispatch(uuid, uuid, uuid[], text, uuid)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.emergency_lockdown()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_cycle_bounds(date, integer)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_user_org_id()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_user_role()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.handle_grievance_target_date()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.log_audit_event()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.log_audit_event(uuid, uuid, text, text, bigint, jsonb)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.next_dispatch_number(uuid)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.protect_default_categories()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_actor_for_audit(uuid)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.settle_worker_payroll(uuid, text, bigint, date, numeric, boolean, numeric, uuid, text, jsonb, boolean)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.settle_worker_payroll(uuid, text, bigint, date, numeric, boolean, numeric, uuid, text)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.settle_worker_payroll(uuid, text, bigint, date, numeric, boolean, numeric, uuid)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.settle_worker_payroll(uuid, text, bigint, text, numeric, boolean, uuid)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.settle_worker_payroll(uuid, text, bigint, text, numeric, boolean)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.settle_worker_payroll(uuid, text, bigint, text, numeric)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.touch_updated_at()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.unlock_tenant(uuid)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.unsettle_worker_payroll(uuid, text, bigint, text, uuid)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.unsettle_worker_payroll(uuid, text, bigint, text)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_updated_at_column()
  SET search_path = pg_catalog, public;

-- Also pin the safe and service-only machine-link overloads.
ALTER FUNCTION public.link_batch_to_machine(uuid, uuid)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.link_batch_to_machine(uuid, uuid, uuid)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.link_order_to_machine(uuid, uuid, uuid)
  SET search_path = pg_catalog, public;

-- ---------------------------------------------------------------------------
-- 2. Shared authorization helpers.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_owner_org_access(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_org_id uuid;
  v_role text;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'organization context is required'
      USING ERRCODE = '42501';
  END IF;

  -- Service-role server actions have already performed their own boundary
  -- checks and may operate across tenants by design.
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN;
  END IF;

  SELECT profile.org_id, profile.role::text
  INTO v_org_id, v_role
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid();

  IF v_org_id IS NULL
     OR v_role IS DISTINCT FROM 'owner'
     OR v_org_id IS DISTINCT FROM p_org_id THEN
    RAISE EXCEPTION 'Only the organization owner may access this organization'
      USING ERRCODE = '42501';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_owner_org_access(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_owner_org_access(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.assert_premium_rpc_access(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (auth.jwt() ->> 'role') IN ('authenticated', 'anon') THEN
    PERFORM public.assert_owner_org_access(p_org_id);

    IF NOT public.org_has_subscription_tier(p_org_id, 'premium') THEN
      RAISE EXCEPTION 'Weavly Full Suite subscription required for production analytics'
        USING ERRCODE = '42501';
    END IF;
  END IF;
END;
$function$;

-- This helper is used by RLS policies, so authenticated execution remains
-- necessary. A caller can only inspect the lockdown state of its own org.
CREATE OR REPLACE FUNCTION public.check_org_lockdown(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_caller_org_id uuid;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN false;
  END IF;

  IF (auth.jwt() ->> 'role') NOT IN ('service_role', 'postgres') THEN
    IF auth.uid() IS NULL THEN
      RETURN false;
    END IF;

    SELECT profile.org_id
    INTO v_caller_org_id
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid();

    IF v_caller_org_id IS NULL OR v_caller_org_id IS DISTINCT FROM p_org_id THEN
      RETURN false;
    END IF;
  END IF;

  RETURN COALESCE((
    SELECT organization.is_locked_down
    FROM public.organizations AS organization
    WHERE organization.id = p_org_id
  ), false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.assert_org_not_locked(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_caller_org_id uuid;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'organization context is required'
      USING ERRCODE = '42501';
  END IF;

  IF (auth.jwt() ->> 'role') <> 'service_role' THEN
    SELECT profile.org_id
    INTO v_caller_org_id
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid();

    IF v_caller_org_id IS NULL OR v_caller_org_id IS DISTINCT FROM p_org_id THEN
      RAISE EXCEPTION 'organization context does not belong to the caller'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF public.check_org_lockdown(p_org_id) THEN
    RAISE EXCEPTION 'organization is locked; business writes are disabled'
      USING ERRCODE = '42501';
  END IF;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Close the confirmed cross-tenant RPC paths.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.link_batch_to_machine(
  p_batch_id uuid,
  p_machine_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_org_id uuid;
  v_role text;
BEGIN
  SELECT profile.org_id, profile.role::text
  INTO v_org_id, v_role
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid();

  IF v_org_id IS NULL OR v_role NOT IN ('owner', 'supervisor') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.yarn_batches AS batch
    WHERE batch.id = p_batch_id
      AND batch.org_id = v_org_id
      AND batch.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active yarn batch not found' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.machines AS machine
    WHERE machine.id = p_machine_id
      AND machine.org_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Machine not found in the caller organization' USING ERRCODE = '42501';
  END IF;

  UPDATE public.yarn_batches
  SET current_machine_id = NULL
  WHERE current_machine_id = p_machine_id
    AND org_id = v_org_id
    AND status = 'active';

  UPDATE public.yarn_batches
  SET current_machine_id = p_machine_id
  WHERE id = p_batch_id
    AND org_id = v_org_id
    AND status = 'active';
END;
$function$;

REVOKE ALL ON FUNCTION public.link_batch_to_machine(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_batch_to_machine(uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.link_batch_to_machine(
  p_batch_id uuid,
  p_machine_id uuid,
  p_org_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (auth.jwt() ->> 'role') <> 'service_role' OR p_org_id IS NULL THEN
    RAISE EXCEPTION 'The explicit organization overload is service-role only'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.yarn_batches AS batch
    WHERE batch.id = p_batch_id
      AND batch.org_id = p_org_id
      AND batch.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active yarn batch not found' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.machines AS machine
    WHERE machine.id = p_machine_id
      AND machine.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Machine not found in the requested organization' USING ERRCODE = '42501';
  END IF;

  UPDATE public.yarn_batches
  SET current_machine_id = NULL
  WHERE current_machine_id = p_machine_id
    AND org_id = p_org_id
    AND status = 'active';

  UPDATE public.yarn_batches
  SET current_machine_id = p_machine_id
  WHERE id = p_batch_id
    AND org_id = p_org_id
    AND status = 'active';
END;
$function$;

REVOKE ALL ON FUNCTION public.link_batch_to_machine(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_batch_to_machine(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.link_order_to_machine(
  p_order_id uuid,
  p_machine_id uuid,
  p_org_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (auth.jwt() ->> 'role') <> 'service_role' OR p_org_id IS NULL THEN
    RAISE EXCEPTION 'The explicit organization overload is service-role only'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders AS order_row
    WHERE order_row.id = p_order_id
      AND order_row.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Order not found in the requested organization' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.machines AS machine
    WHERE machine.id = p_machine_id
      AND machine.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Machine not found in the requested organization' USING ERRCODE = '42501';
  END IF;

  UPDATE public.machines
  SET current_order_id = p_order_id
  WHERE id = p_machine_id
    AND org_id = p_org_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.link_order_to_machine(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_order_to_machine(uuid, uuid, uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Protect dashboard workforce/payroll analytics by profile-derived owner
--    and organization context.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_worker_breakdown_today(
  p_org_id uuid,
  p_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  PERFORM public.assert_owner_org_access(p_org_id);

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'worker_id', w.id,
        'worker_name', w.name,
        'total_meters', COALESCE(worker_totals.total_meters, 0),
        'total_wages', COALESCE(worker_totals.total_wages, 0),
        'entries', COALESCE(worker_totals.entries, '[]'::jsonb)
      )
      ORDER BY worker_totals.total_wages DESC
    )
    FROM public.workers AS w
    LEFT JOIN LATERAL (
      SELECT
        SUM(pl.meters) AS total_meters,
        SUM(pl.meters * pl.worker_rate_snapshot) AS total_wages,
        jsonb_agg(
          jsonb_build_object(
            'machine_name', m.name,
            'meters', pl.meters,
            'rate', pl.worker_rate_snapshot,
            'wages', pl.meters * pl.worker_rate_snapshot,
            'shift', pl.shift,
            'logged_at', pl.submitted_at
          )
          ORDER BY pl.submitted_at, pl.id
        ) AS entries
      FROM public.production_logs AS pl
      JOIN public.machines AS m ON m.id = pl.machine_id
      WHERE COALESCE(pl.meter_worker_id, pl.worker_id) = w.id
        AND pl.org_id = p_org_id
        AND pl.date = p_date
    ) AS worker_totals ON true
    WHERE w.org_id = p_org_id
      AND w.is_active = true
      AND COALESCE(worker_totals.total_meters, 0) > 0
  ), '[]'::jsonb);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Make manual audit insertion server-only and actor/tenant-bound.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_org_id uuid,
  p_actor_id uuid,
  p_action text,
  p_table_name text,
  p_record_id bigint,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor_org_id uuid;
  v_actor_role text;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'An audit actor is required' USING ERRCODE = '42501';
  END IF;

  SELECT profile.org_id, profile.role::text
  INTO v_actor_org_id, v_actor_role
  FROM public.profiles AS profile
  WHERE profile.id = p_actor_id;

  IF v_actor_org_id IS NULL AND v_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Audit actor is not a valid application profile' USING ERRCODE = '42501';
  END IF;

  IF (auth.jwt() ->> 'role') <> 'service_role'
     AND (auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Audit actor must be the authenticated caller' USING ERRCODE = '42501';
  END IF;

  IF p_org_id IS DISTINCT FROM v_actor_org_id
     AND v_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Audit organization does not belong to the actor' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_log (
    org_id,
    table_name,
    record_id,
    action,
    new_data,
    changed_by,
    changed_at
  )
  VALUES (
    p_org_id,
    p_table_name,
    p_record_id::text,
    p_action,
    p_payload,
    p_actor_id,
    now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.log_audit_event(uuid, uuid, text, text, bigint, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(uuid, uuid, text, text, bigint, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.set_actor_for_audit(p_actor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (auth.jwt() ->> 'role') <> 'service_role' THEN
    RAISE EXCEPTION 'Audit actor context is service-role only' USING ERRCODE = '42501';
  END IF;

  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile WHERE profile.id = p_actor_id
  ) THEN
    RAISE EXCEPTION 'A valid audit actor is required' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.set_config('app.actor_id', p_actor_id::text, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_actor_for_audit(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_actor_for_audit(uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Make admin lockdown actions explicit service-role operations, preserving
--    the actor in the function arguments instead of trusting auth.uid() from
--    a service-role request.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lockdown_tenant(
  p_org_id uuid,
  p_reason text,
  p_severity text,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_affected_count bigint;
BEGIN
  IF (auth.jwt() ->> 'role') <> 'service_role' THEN
    RAISE EXCEPTION 'Tenant lockdown is service-role only' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_id AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'A platform administrator actor is required' USING ERRCODE = '42501';
  END IF;

  IF p_severity NOT IN ('low', 'medium', 'high', 'critical')
     OR btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'A valid reason and severity are required';
  END IF;

  UPDATE public.organizations
  SET is_locked_down = true,
      locked_at = now(),
      locked_by = p_actor_id,
      lockdown_reason = p_reason,
      lockdown_severity = p_severity
  WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  SELECT
    (SELECT count(*) FROM public.workers WHERE org_id = p_org_id)
    + (SELECT count(*) FROM public.profiles WHERE org_id = p_org_id)
  INTO v_affected_count;

  INSERT INTO public.breach_reports (
    org_id, severity, description, affected_users_count, filed_by, auto_generated_data
  )
  VALUES (
    p_org_id, p_severity, p_reason, v_affected_count, p_actor_id,
    jsonb_build_object(
      'detection_date', now(),
      'affected_count', v_affected_count,
      'reason', p_reason,
      'severity', p_severity
    )
  );

  INSERT INTO public.audit_log (
    org_id, table_name, record_id, action, new_data, changed_by
  )
  VALUES (
    p_org_id,
    'organizations',
    p_org_id::text,
    'UPDATE',
    jsonb_build_object('is_locked_down', true, 'reason', p_reason),
    p_actor_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'locked_at', now(),
    'affected_users', v_affected_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.lockdown_tenant(
  p_org_id uuid,
  p_reason text,
  p_severity text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor_id uuid;
BEGIN
  IF (auth.jwt() ->> 'role') <> 'service_role' THEN
    RAISE EXCEPTION 'Tenant lockdown is service-role only' USING ERRCODE = '42501';
  END IF;

  v_actor_id := NULLIF(pg_catalog.current_setting('app.actor_id', true), '')::uuid;
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Use the actor-aware tenant lockdown overload' USING ERRCODE = '42501';
  END IF;

  RETURN public.lockdown_tenant(p_org_id, p_reason, p_severity, v_actor_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.lockdown_tenant(uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lockdown_tenant(uuid, text, text, uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.lockdown_tenant(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lockdown_tenant(uuid, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.unlock_tenant(
  p_org_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (auth.jwt() ->> 'role') <> 'service_role' THEN
    RAISE EXCEPTION 'Tenant unlock is service-role only' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_id AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'A platform administrator actor is required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.organizations
  SET is_locked_down = false,
      locked_at = NULL,
      locked_by = NULL,
      lockdown_reason = NULL,
      lockdown_severity = NULL
  WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  INSERT INTO public.audit_log (
    org_id, table_name, record_id, action, new_data, changed_by
  )
  VALUES (
    p_org_id,
    'organizations',
    p_org_id::text,
    'UPDATE',
    jsonb_build_object('is_locked_down', false, 'event', 'Isolation Lifted'),
    p_actor_id
  );

  RETURN jsonb_build_object('success', true, 'unlocked_at', now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.unlock_tenant(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor_id uuid;
BEGIN
  IF (auth.jwt() ->> 'role') <> 'service_role' THEN
    RAISE EXCEPTION 'Tenant unlock is service-role only' USING ERRCODE = '42501';
  END IF;

  v_actor_id := NULLIF(pg_catalog.current_setting('app.actor_id', true), '')::uuid;
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Use the actor-aware tenant unlock overload' USING ERRCODE = '42501';
  END IF;

  RETURN public.unlock_tenant(p_org_id, v_actor_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.unlock_tenant(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_tenant(uuid, uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.unlock_tenant(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_tenant(uuid)
  TO service_role;

-- Global lockdown is a direct admin operation, so it uses invoker privileges
-- plus a narrow RLS policy rather than a tenant owner's SECURITY DEFINER path.
DROP POLICY IF EXISTS platform_security_admin_control ON public.platform_security;
CREATE POLICY platform_security_admin_control
  ON public.platform_security
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid() AND profile.role::text = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid() AND profile.role::text = 'admin'
    )
  );

DROP POLICY IF EXISTS audit_log_admin_global_security_insert ON public.audit_log;
CREATE POLICY audit_log_admin_global_security_insert
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IS NULL
    AND table_name = 'platform_security'
    AND record_id = 'GLOBAL'
    AND changed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = auth.uid() AND profile.role::text = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.emergency_lockdown()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only platform administrators can trigger a global lockdown'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.platform_security
  SET is_locked_down = true,
      locked_at = now(),
      locked_by = v_user_id
  WHERE id = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Global platform security row is missing';
  END IF;

  INSERT INTO public.audit_log (
    org_id, table_name, record_id, action, new_data, changed_by
  )
  VALUES (
    NULL,
    'platform_security',
    'GLOBAL',
    'UPDATE',
    jsonb_build_object('is_locked_down', true, 'reason', 'Emergency Lockdown Triggered'),
    v_user_id
  );

  RETURN jsonb_build_object('success', true, 'locked_at', now());
END;
$function$;

REVOKE ALL ON FUNCTION public.emergency_lockdown()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.emergency_lockdown()
  TO authenticated;

-- The invoker function only needs these columns; do not leave broad table DML
-- grants on the global security-control table.
REVOKE INSERT, DELETE, UPDATE ON public.platform_security FROM authenticated;
GRANT SELECT ON public.platform_security TO authenticated;
GRANT UPDATE (is_locked_down, locked_at, locked_by)
  ON public.platform_security TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Remove direct execution from trigger/event-trigger functions and the
--    machine-activation predicate. Trigger execution does not require an API
--    caller grant; these are not RPC surfaces.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.assign_fabric_package_no()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_complete_order_on_log()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_production_on_completed_order()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_order_target_before_log()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_grievance_target_date()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_audit_event()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_default_categories()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.assign_fabric_package_no() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_complete_order_on_log() TO service_role;
GRANT EXECUTE ON FUNCTION public.block_production_on_completed_order() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_order_target_before_log() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_grievance_target_date() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_audit_event() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_default_categories() TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;

CREATE OR REPLACE FUNCTION public.machine_meets_activation_requirements(
  p_org_id uuid,
  p_machine_id uuid,
  p_order_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL
      AND (auth.jwt() ->> 'role') NOT IN ('service_role', 'postgres')
      AND NOT EXISTS (
        SELECT 1
        FROM public.profiles AS profile
        WHERE profile.id = auth.uid()
          AND profile.org_id = p_org_id
      )
    THEN false
    ELSE
      p_order_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.orders AS order_row
        WHERE order_row.id = p_order_id
          AND order_row.org_id = p_org_id
          AND order_row.status = 'active'
      )
      AND EXISTS (
        SELECT 1
        FROM public.machine_assignments AS assignment
        JOIN public.workers AS worker
          ON worker.id = assignment.worker_id
         AND worker.org_id = p_org_id
         AND worker.is_active = true
        WHERE assignment.org_id = p_org_id
          AND assignment.machine_id = p_machine_id
          AND assignment.shift IN ('day', 'night')
      )
  END;
$function$;

REVOKE ALL ON FUNCTION public.machine_meets_activation_requirements(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.machine_meets_activation_requirements(uuid, uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.enforce_machine_activation_requirements()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_production_log_order_boundary()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inactivate_machines_after_order_status_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inactivate_machines_after_worker_status_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inactivate_machines_missing_activation_requirements()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_handle_market_run_closed()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enforce_machine_activation_requirements() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_production_log_order_boundary() TO service_role;
GRANT EXECUTE ON FUNCTION public.inactivate_machines_after_order_status_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.inactivate_machines_after_worker_status_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.inactivate_machines_missing_activation_requirements() TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_handle_market_run_closed() TO service_role;

-- ---------------------------------------------------------------------------
-- 8. Make the five RLS-without-policy findings explicit.
-- ---------------------------------------------------------------------------

DO $deny_internal_tables$
DECLARE
  v_table text;
  v_policy text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'billing_invoice_sequences',
    'billing_payment_refunds',
    'razorpay_webhook_events',
    'whatsapp_settings'
  ] LOOP
    v_policy := v_table || '_deny_direct_client_access';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy, v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      v_policy,
      v_table
    );
  END LOOP;
END;
$deny_internal_tables$;

-- ---------------------------------------------------------------------------
-- 9. Prevent future public/anon/authenticated execution by default for
--    functions created by the migration role.
-- ---------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
