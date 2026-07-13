-- MASTER-014: serialize loom assignment edits and keep dated/standing context atomic.
--
-- Safety:
-- - no existing rows are rewritten or deleted by this migration;
-- - the function locks only the target machine row for the transaction;
-- - tenant, role, lockdown, worker, and active-order boundaries are checked
--   before any assignment state changes.

CREATE OR REPLACE FUNCTION public.upsert_shift_assignment_context_v1(
  p_date DATE,
  p_shift TEXT,
  p_machine_id UUID,
  p_worker_id BIGINT,
  p_order_id UUID,
  p_rate_per_m NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_org_id UUID;
  v_role TEXT;
  v_assignment_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT p.org_id, p.role
  INTO v_org_id, v_role
  FROM public.profiles AS p
  WHERE p.id = v_actor_id;

  IF v_org_id IS NULL OR v_role NOT IN ('owner', 'supervisor') THEN
    RAISE EXCEPTION 'owner or supervisor role required' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_org_not_locked(v_org_id);

  IF p_date IS NULL OR p_shift NOT IN ('day', 'night') THEN
    RAISE EXCEPTION 'valid assignment date and shift are required' USING ERRCODE = '22023';
  END IF;

  IF p_rate_per_m IS NULL OR p_rate_per_m < 0 THEN
    RAISE EXCEPTION 'rate per meter must be zero or greater' USING ERRCODE = '22023';
  END IF;

  -- The row lock serializes every assignment-context edit for this loom. A
  -- concurrent editor waits, then applies one complete last-write context.
  PERFORM 1
  FROM public.machines AS m
  WHERE m.id = p_machine_id
    AND m.org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'loom not found in organization' USING ERRCODE = '42501';
  END IF;

  IF p_worker_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.workers AS w
    WHERE w.id = p_worker_id
      AND w.org_id = v_org_id
      AND COALESCE(w.is_active, true)
  ) THEN
    RAISE EXCEPTION 'active worker not found in organization' USING ERRCODE = '22023';
  END IF;

  IF p_order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.orders AS o
    WHERE o.id = p_order_id
      AND o.org_id = v_org_id
      AND o.status = 'active'
  ) THEN
    RAISE EXCEPTION 'only an active production target can be assigned' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.shift_assignments (
    org_id,
    date,
    shift,
    machine_id,
    worker_id,
    order_id,
    rate_per_m,
    created_by
  )
  VALUES (
    v_org_id,
    p_date,
    p_shift,
    p_machine_id,
    p_worker_id,
    p_order_id,
    p_rate_per_m,
    v_actor_id
  )
  ON CONFLICT (org_id, date, shift, machine_id)
  DO UPDATE SET
    worker_id = EXCLUDED.worker_id,
    order_id = EXCLUDED.order_id,
    rate_per_m = EXCLUDED.rate_per_m,
    created_by = EXCLUDED.created_by
  RETURNING id INTO v_assignment_id;

  IF p_worker_id IS NULL THEN
    DELETE FROM public.machine_assignments AS ma
    WHERE ma.org_id = v_org_id
      AND ma.machine_id = p_machine_id
      AND ma.shift = p_shift;
  ELSE
    INSERT INTO public.machine_assignments (org_id, machine_id, shift, worker_id)
    VALUES (v_org_id, p_machine_id, p_shift, p_worker_id)
    ON CONFLICT (org_id, machine_id, shift)
    DO UPDATE SET worker_id = EXCLUDED.worker_id;
  END IF;

  UPDATE public.machines AS m
  SET current_order_id = p_order_id
  WHERE m.id = p_machine_id
    AND m.org_id = v_org_id;

  RETURN jsonb_build_object(
    'assignment_id', v_assignment_id,
    'machine_id', p_machine_id,
    'date', p_date,
    'shift', p_shift,
    'worker_id', p_worker_id,
    'order_id', p_order_id,
    'rate_per_m', p_rate_per_m
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_shift_assignment_context_v1(DATE, TEXT, UUID, BIGINT, UUID, NUMERIC)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_shift_assignment_context_v1(DATE, TEXT, UUID, BIGINT, UUID, NUMERIC)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.upsert_shift_assignment_context_v1(DATE, TEXT, UUID, BIGINT, UUID, NUMERIC)
  IS 'Atomically serializes dated and standing loom assignment context for one tenant-scoped machine.';
