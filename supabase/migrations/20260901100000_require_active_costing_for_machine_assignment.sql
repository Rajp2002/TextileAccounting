-- Require active costing (production job context) before assigning a worker to a machine
-- in Base Production Core. Also ensure clearing a machine costing deactivates active assignments.

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
    RAISE EXCEPTION 'This machine does not have an active costing' USING ERRCODE = '23503';
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

CREATE OR REPLACE FUNCTION public.set_base_machine_job_context(
  p_machine_id uuid,
  p_job_id uuid DEFAULT NULL,
  p_effective_from date DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_existing record;
  v_context_id uuid;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;

  IF p_machine_id IS NULL OR p_effective_from IS NULL THEN
    RAISE EXCEPTION 'A valid machine and effective date are required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':base-context:' || p_machine_id::text, 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.base_production_machines AS machine
    WHERE machine.org_id = v_org_id
      AND machine.id = p_machine_id
      AND (p_job_id IS NULL OR machine.is_active IS TRUE)
  ) THEN
    RAISE EXCEPTION 'Choose an active Base machine' USING ERRCODE = '23503';
  END IF;

  IF p_job_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.base_production_jobs AS job
    WHERE job.org_id = v_org_id
      AND job.id = p_job_id
      AND job.status IN ('planned', 'active')
  ) THEN
    RAISE EXCEPTION 'Choose a planned or active Base production job' USING ERRCODE = '23503';
  END IF;

  SELECT context.id, context.job_id
  INTO v_existing
  FROM public.base_machine_job_contexts AS context
  WHERE context.org_id = v_org_id
    AND context.machine_id = p_machine_id
    AND context.active IS TRUE
    AND context.effective_to IS NULL
  FOR UPDATE;

  IF p_job_id IS NULL THEN
    IF v_existing.id IS NOT NULL THEN
      UPDATE public.base_machine_job_contexts
      SET active = false,
          effective_to = GREATEST(effective_from, p_effective_from),
          updated_at = now()
      WHERE id = v_existing.id
        AND org_id = v_org_id;

      -- Deactivate active worker assignments for this machine as of this date
      UPDATE public.base_worker_machine_assignments
      SET active = false,
          effective_to = GREATEST(effective_from, p_effective_from),
          updated_by = auth.uid(),
          updated_at = now()
      WHERE org_id = v_org_id
        AND machine_id = p_machine_id
        AND active IS TRUE
        AND (effective_to IS NULL OR effective_to >= p_effective_from);
    END IF;

    RETURN jsonb_build_object('success', true, 'cleared', true);
  END IF;

  IF v_existing.id IS NOT NULL AND v_existing.job_id = p_job_id THEN
    RETURN jsonb_build_object('success', true, 'context_id', v_existing.id, 'changed', false);
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.base_machine_job_contexts
    SET active = false,
        effective_to = GREATEST(effective_from, p_effective_from - 1),
        updated_at = now()
      WHERE id = v_existing.id
        AND org_id = v_org_id;
  END IF;

  INSERT INTO public.base_machine_job_contexts (
    org_id, machine_id, job_id, active, effective_from, created_by
  )
  VALUES (
    v_org_id, p_machine_id, p_job_id, true, p_effective_from, auth.uid()
  )
  RETURNING id INTO v_context_id;

  RETURN jsonb_build_object('success', true, 'context_id', v_context_id, 'changed', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_base_machine_job_context(uuid, uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_base_machine_job_context(uuid, uuid, date)
  TO authenticated;
