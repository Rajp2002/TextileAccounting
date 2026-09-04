-- Clarify the Base assignment prerequisite for upgrades where the original
-- active-costing guard migration has already been applied.

CREATE OR REPLACE FUNCTION public.upsert_base_worker_machine_assignment(
  p_worker_id uuid,
  p_machine_id uuid,
  p_shift text DEFAULT 'day',
  p_effective_from date DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  p_replace_existing boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_existing record;
  v_worker_name text;
  v_assignment_id uuid;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;

  IF p_worker_id IS NULL OR p_machine_id IS NULL OR p_effective_from IS NULL
     OR p_shift IS NULL
     OR p_shift NOT IN ('day', 'night') THEN
    RAISE EXCEPTION 'A valid worker, machine, shift, and effective date are required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':base-assignment:' || p_machine_id::text || ':' || p_shift, 0)
  );

  SELECT worker.name
  INTO v_worker_name
  FROM public.base_production_workers AS worker
  WHERE worker.org_id = v_org_id
    AND worker.id = p_worker_id
    AND worker.is_active IS TRUE;

  IF v_worker_name IS NULL THEN
    RAISE EXCEPTION 'Choose an active Base worker' USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.base_production_machines AS machine
    WHERE machine.org_id = v_org_id
      AND machine.id = p_machine_id
      AND machine.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Choose an active Base machine' USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.base_machine_job_contexts AS context
    JOIN public.base_production_jobs AS job
      ON job.org_id = context.org_id
     AND job.id = context.job_id
    WHERE context.org_id = v_org_id
      AND context.machine_id = p_machine_id
      AND context.active IS TRUE
      AND context.effective_from <= p_effective_from
      AND (context.effective_to IS NULL OR context.effective_to >= p_effective_from)
      AND job.status IN ('planned', 'active')
  ) THEN
    RAISE EXCEPTION 'This machine has no active production job. Create or select one before assigning a worker.' USING ERRCODE = '23503';
  END IF;

  SELECT assignment.id, assignment.worker_id, previous_worker.name AS worker_name
  INTO v_existing
  FROM public.base_worker_machine_assignments AS assignment
  JOIN public.base_production_workers AS previous_worker
    ON previous_worker.org_id = assignment.org_id
   AND previous_worker.id = assignment.worker_id
  WHERE assignment.org_id = v_org_id
    AND assignment.machine_id = p_machine_id
    AND assignment.shift = p_shift
    AND assignment.active IS TRUE
    AND assignment.effective_to IS NULL
  FOR UPDATE OF assignment;

  IF v_existing.id IS NOT NULL AND v_existing.worker_id = p_worker_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'assignment_id', v_existing.id,
      'worker_name', v_worker_name,
      'replaced', false
    );
  END IF;

  IF v_existing.id IS NOT NULL AND NOT p_replace_existing THEN
    RETURN jsonb_build_object(
      'conflict', true,
      'current_worker_name', v_existing.worker_name,
      'message', format('%s is already the primary worker for this machine and shift.', v_existing.worker_name)
    );
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.base_worker_machine_assignments
    SET active = false,
        effective_to = GREATEST(effective_from, p_effective_from - 1),
        updated_by = auth.uid(),
        updated_at = now()
    WHERE id = v_existing.id
      AND org_id = v_org_id;
  END IF;

  INSERT INTO public.base_worker_machine_assignments (
    org_id, worker_id, machine_id, shift, active, effective_from, created_by, updated_by
  )
  VALUES (
    v_org_id, p_worker_id, p_machine_id, p_shift, true, p_effective_from, auth.uid(), auth.uid()
  )
  RETURNING id INTO v_assignment_id;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment_id,
    'worker_name', v_worker_name,
    'replaced', v_existing.id IS NOT NULL,
    'replaced_worker_name', v_existing.worker_name
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_base_worker_machine_assignment(uuid, uuid, text, date, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_base_worker_machine_assignment(uuid, uuid, text, date, boolean)
  TO authenticated;
