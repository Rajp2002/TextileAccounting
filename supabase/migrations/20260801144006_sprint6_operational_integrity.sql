-- Sprint 6 operational integrity
--
-- This migration is intentionally isolated from Sprint 0 estimator/costing
-- migrations. It adds transactional boundaries for two operational mutations
-- whose current server actions perform multiple writes independently.

CREATE OR REPLACE FUNCTION public.upsert_machine_operator_assignment_v1(
  p_machine_id UUID,
  p_shift TEXT,
  p_worker_type TEXT,
  p_meter_worker_id BIGINT DEFAULT NULL,
  p_fixed_worker_id BIGINT DEFAULT NULL,
  p_pay_mode TEXT DEFAULT NULL,
  p_rate NUMERIC DEFAULT NULL,
  p_effective_from DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_org_id UUID;
  v_role TEXT;
  v_machine_type TEXT;
  v_pay_mode TEXT;
  v_assignment_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT p.org_id, p.role
  INTO v_org_id, v_role
  FROM public.profiles AS p
  WHERE p.id = v_actor_id;

  IF v_org_id IS NULL OR v_role <> 'owner' THEN
    RAISE EXCEPTION 'owner role required' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_org_not_locked(v_org_id);

  IF p_machine_id IS NULL OR p_shift NOT IN ('day', 'night') THEN
    RAISE EXCEPTION 'valid loom and shift are required' USING ERRCODE = '22023';
  END IF;

  IF p_worker_type NOT IN ('meter_worker', 'fixed_worker') THEN
    RAISE EXCEPTION 'invalid operator type' USING ERRCODE = '22023';
  END IF;

  IF p_rate IS NULL OR p_rate <= 0 OR p_rate > 100000 THEN
    RAISE EXCEPTION 'operator rate must be greater than 0 and no more than 100000' USING ERRCODE = '22023';
  END IF;

  IF p_effective_from IS NULL THEN
    RAISE EXCEPTION 'effective date is required' USING ERRCODE = '22023';
  END IF;

  IF (p_worker_type = 'meter_worker' AND (p_meter_worker_id IS NULL OR p_fixed_worker_id IS NOT NULL))
     OR (p_worker_type = 'fixed_worker' AND (p_fixed_worker_id IS NULL OR p_meter_worker_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'choose exactly one worker for the operator assignment' USING ERRCODE = '22023';
  END IF;

  v_pay_mode := COALESCE(NULLIF(BTRIM(p_pay_mode), ''),
    CASE
      WHEN p_worker_type = 'meter_worker' THEN 'per_meter'
      ELSE 'fixed_monthly'
    END
  );

  IF (p_worker_type = 'meter_worker' AND v_pay_mode <> 'per_meter')
     OR (p_worker_type = 'fixed_worker' AND v_pay_mode NOT IN ('fixed_monthly', 'fixed_daily', 'fixed_shift')) THEN
    RAISE EXCEPTION 'pay mode does not match the selected worker type' USING ERRCODE = '22023';
  END IF;

  -- Lock the loom so closing the previous assignment, writing the new one,
  -- and mirroring the legacy assignment cannot interleave with another edit.
  SELECT CASE
    WHEN LOWER(REGEXP_REPLACE(COALESCE(m.loom_type, ''), '[_-]+', ' ', 'g')) IN ('jacquard', 'jakard', 'jakards', 'jac', 'jacard') THEN 'jacquard'
    WHEN LOWER(REGEXP_REPLACE(COALESCE(m.loom_type, ''), '[_-]+', ' ', 'g')) IN ('power loom', 'powerloom', 'pl') THEN 'power_loom'
    WHEN LOWER(REGEXP_REPLACE(COALESCE(m.loom_type, ''), '[_-]+', ' ', 'g')) IN ('rapier', 'rap') THEN 'rapier'
    WHEN LOWER(REGEXP_REPLACE(COALESCE(m.loom_type, ''), '[_-]+', ' ', 'g')) IN ('water jet', 'waterjet', 'wj') THEN 'water_jet'
    ELSE 'other'
  END
  INTO v_machine_type
  FROM public.machines AS m
  WHERE m.id = p_machine_id
    AND m.org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'loom not found in this factory' USING ERRCODE = '42501';
  END IF;

  IF p_worker_type = 'meter_worker' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workers AS w
      WHERE w.id = p_meter_worker_id
        AND w.org_id = v_org_id
        AND COALESCE(w.is_active, true)
    ) THEN
      RAISE EXCEPTION 'active Piece-rate Worker not found in this factory' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.fixed_workers AS fw
      WHERE fw.id = p_fixed_worker_id
        AND fw.org_id = v_org_id
        AND COALESCE(fw.is_active, true)
    ) THEN
      RAISE EXCEPTION 'active Salaried Worker not found in this factory' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.machine_operator_assignments
  SET active = false,
      effective_to = p_effective_from,
      updated_at = NOW()
  WHERE org_id = v_org_id
    AND machine_id = p_machine_id
    AND shift = p_shift
    AND active = true
    AND effective_to IS NULL;

  INSERT INTO public.machine_operator_assignments (
    org_id,
    machine_id,
    machine_type,
    shift,
    worker_type,
    meter_worker_id,
    fixed_worker_id,
    pay_mode,
    rate,
    effective_from,
    effective_to,
    is_primary_operator,
    active
  )
  VALUES (
    v_org_id,
    p_machine_id,
    v_machine_type,
    p_shift,
    p_worker_type,
    CASE WHEN p_worker_type = 'meter_worker' THEN p_meter_worker_id ELSE NULL END,
    CASE WHEN p_worker_type = 'fixed_worker' THEN p_fixed_worker_id ELSE NULL END,
    v_pay_mode,
    p_rate,
    p_effective_from,
    NULL,
    TRUE,
    TRUE
  )
  RETURNING id INTO v_assignment_id;

  IF p_worker_type = 'meter_worker' THEN
    INSERT INTO public.machine_assignments (org_id, machine_id, worker_id, shift)
    VALUES (v_org_id, p_machine_id, p_meter_worker_id, p_shift)
    ON CONFLICT (org_id, machine_id, shift)
    DO UPDATE SET worker_id = EXCLUDED.worker_id;
  ELSE
    DELETE FROM public.machine_assignments
    WHERE org_id = v_org_id
      AND machine_id = p_machine_id
      AND shift = p_shift;
  END IF;

  RETURN jsonb_build_object(
    'assignment_id', v_assignment_id,
    'machine_id', p_machine_id,
    'shift', p_shift,
    'worker_type', p_worker_type,
    'pay_mode', v_pay_mode,
    'rate', p_rate,
    'effective_from', p_effective_from
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_machine_operator_assignment_v1(UUID, TEXT, TEXT, BIGINT, BIGINT, TEXT, NUMERIC, DATE)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_machine_operator_assignment_v1(UUID, TEXT, TEXT, BIGINT, BIGINT, TEXT, NUMERIC, DATE)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.upsert_machine_operator_assignment_v1(UUID, TEXT, TEXT, BIGINT, BIGINT, TEXT, NUMERIC, DATE)
  IS 'Atomically replaces the current owner-managed loom operator assignment and legacy mirror for one tenant-scoped loom shift.';

CREATE OR REPLACE FUNCTION public.cancel_order_with_impact_v1(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_org_id UUID;
  v_role TEXT;
  v_status TEXT;
  v_machine_count INTEGER := 0;
  v_expected_machine_count INTEGER := 0;
  v_updated_count INTEGER := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT p.org_id, p.role
  INTO v_org_id, v_role
  FROM public.profiles AS p
  WHERE p.id = v_actor_id;

  IF v_org_id IS NULL OR v_role <> 'owner' THEN
    RAISE EXCEPTION 'owner role required' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_org_not_locked(v_org_id);

  SELECT o.status
  INTO v_status
  FROM public.orders AS o
  WHERE o.id = p_order_id
    AND o.org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found in this factory' USING ERRCODE = '42501';
  END IF;

  IF v_status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_cancelled', true,
      'order_id', p_order_id,
      'machines_unlinked', 0
    );
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'only an active order can be cancelled' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_expected_machine_count
  FROM public.machines AS m
  WHERE m.current_order_id = p_order_id
    AND m.org_id = v_org_id;

  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = p_order_id
    AND org_id = v_org_id
    AND status = 'active';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'order changed before cancellation could be saved' USING ERRCODE = '40001';
  END IF;

  UPDATE public.machines
  SET current_order_id = NULL,
      status = 'inactive'
  WHERE current_order_id = p_order_id
    AND org_id = v_org_id;

  GET DIAGNOSTICS v_machine_count = ROW_COUNT;

  IF v_machine_count <> v_expected_machine_count THEN
    RAISE EXCEPTION 'loom assignments changed before cancellation could be saved' USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_cancelled', false,
    'order_id', p_order_id,
    'machines_unlinked', v_machine_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order_with_impact_v1(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order_with_impact_v1(UUID)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.cancel_order_with_impact_v1(UUID)
  IS 'Atomically soft-cancels an owner order and releases only machines currently linked to that order; downstream history remains intact.';
