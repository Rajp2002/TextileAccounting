-- Production Flow Simplification: Active Qualities & Machine Board
--
-- Replaces the manual 'create production job' paradigm with direct Saved Costing
-- activation, bulk machine assignment, atomic quality switching, and quality
-- deactivation while strictly maintaining piece-rate payroll integrity and
-- worker-machine relationships.

DROP FUNCTION IF EXISTS public.set_base_machine_job_context(uuid, uuid, date);

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
      AND machine.is_active IS TRUE
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

      -- NOTE: Worker-machine assignments are deliberately preserved!
      -- Workers operate machines, not costings. Changing machine quality does
      -- not evict workers from operating that machine.
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

CREATE OR REPLACE FUNCTION public.activate_saved_costing_for_production(
  p_costing_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_costing record;
  v_existing_job record;
  v_new_job_id uuid;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;

  IF p_costing_id IS NULL THEN
    RAISE EXCEPTION 'A valid costing ID is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':activate-costing:' || p_costing_id::text, 0)
  );

  SELECT quote.id, quote.quality_label, quote.costing_group_id, quote.version_number,
         quote.production_cost_per_meter, quote.landed_cost_per_meter, quote.quote_price_per_meter,
         quote.worker_rate_per_m, quote.order_quantity_m
  INTO v_costing
  FROM public.estimator_quotes AS quote
  WHERE quote.org_id = v_org_id
    AND quote.id = p_costing_id
    AND quote.record_kind = 'costing'
    AND quote.is_archived IS FALSE;

  IF v_costing.id IS NULL THEN
    RAISE EXCEPTION 'Active saved costing not found' USING ERRCODE = '23503';
  END IF;

  -- Idempotency check: verify if an active job already exists for this exact costing snapshot
  SELECT job.id, job.status, job.quality_label
  INTO v_existing_job
  FROM public.base_production_jobs AS job
  WHERE job.org_id = v_org_id
    AND job.costing_id = p_costing_id
    AND job.status IN ('planned', 'active')
  ORDER BY job.created_at DESC
  LIMIT 1;

  IF v_existing_job.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'job_id', v_existing_job.id,
      'quality_label', v_existing_job.quality_label,
      'already_active', true
    );
  END IF;

  -- Create internal production activation record
  INSERT INTO public.base_production_jobs (
    org_id,
    costing_id,
    costing_group_id,
    costing_version,
    quality_label,
    target_meters,
    start_date,
    status,
    worker_rate_per_meter,
    planned_cost_per_meter,
    planned_price_per_meter,
    created_by
  )
  VALUES (
    v_org_id,
    v_costing.id,
    v_costing.costing_group_id,
    v_costing.version_number,
    COALESCE(NULLIF(btrim(v_costing.quality_label), ''), 'Unnamed Quality'),
    10000000,
    (now() AT TIME ZONE 'Asia/Kolkata')::date,
    'active',
    COALESCE(v_costing.worker_rate_per_m, 0),
    COALESCE(v_costing.production_cost_per_meter, v_costing.landed_cost_per_meter, 0),
    COALESCE(v_costing.quote_price_per_meter, 0),
    auth.uid()
  )
  RETURNING id INTO v_new_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_new_job_id,
    'quality_label', v_costing.quality_label,
    'already_active', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.deactivate_quality_production(
  p_job_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_job record;
  v_machines_closed integer := 0;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'A valid job ID is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':deactivate-job:' || p_job_id::text, 0)
  );

  SELECT *
  INTO v_job
  FROM public.base_production_jobs AS job
  WHERE job.org_id = v_org_id
    AND job.id = p_job_id
  FOR UPDATE;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Production job not found' USING ERRCODE = '23503';
  END IF;

  IF v_job.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_closed', true,
      'machines_closed', 0
    );
  END IF;

  -- Close active machine assignments for this quality
  WITH closed_contexts AS (
    UPDATE public.base_machine_job_contexts
    SET active = false,
        effective_to = GREATEST(effective_from, v_today),
        updated_at = now()
    WHERE org_id = v_org_id
      AND job_id = p_job_id
      AND active IS TRUE
      AND (effective_to IS NULL OR effective_to >= v_today)
    RETURNING id
  )
  SELECT count(*) INTO v_machines_closed FROM closed_contexts;

  -- Mark the production job completed
  UPDATE public.base_production_jobs
  SET status = 'completed',
      updated_at = now()
  WHERE org_id = v_org_id
    AND id = p_job_id;

  -- Worker-machine assignments remain unchanged.
  -- Historical production entries and stock movements remain unchanged.

  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'status', 'completed',
    'machines_closed', v_machines_closed
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.switch_base_machine_quality(
  p_machine_id uuid,
  p_to_job_id uuid,
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
  v_target_job record;
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

  IF p_machine_id IS NULL OR p_to_job_id IS NULL OR p_effective_from IS NULL THEN
    RAISE EXCEPTION 'A valid machine, target quality, and effective date are required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':base-context:' || p_machine_id::text, 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.base_production_machines AS machine
    WHERE machine.org_id = v_org_id
      AND machine.id = p_machine_id
      AND machine.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Choose an active Base machine' USING ERRCODE = '23503';
  END IF;

  SELECT job.id, job.quality_label, job.status
  INTO v_target_job
  FROM public.base_production_jobs AS job
  WHERE job.org_id = v_org_id
    AND job.id = p_to_job_id
    AND job.status IN ('planned', 'active');

  IF v_target_job.id IS NULL THEN
    RAISE EXCEPTION 'Target production quality is not active' USING ERRCODE = '23503';
  END IF;

  SELECT context.id, context.job_id
  INTO v_existing
  FROM public.base_machine_job_contexts AS context
  WHERE context.org_id = v_org_id
    AND context.machine_id = p_machine_id
    AND context.active IS TRUE
    AND context.effective_to IS NULL
  FOR UPDATE;

  IF v_existing.id IS NOT NULL AND v_existing.job_id = p_to_job_id THEN
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
    v_org_id, p_machine_id, p_to_job_id, true, p_effective_from, auth.uid()
  )
  RETURNING id INTO v_context_id;

  RETURN jsonb_build_object(
    'success', true,
    'context_id', v_context_id,
    'target_quality', v_target_job.quality_label,
    'changed', true
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_assign_machines_to_quality(
  p_job_id uuid,
  p_machine_ids uuid[],
  p_effective_from date DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_job record;
  v_machine_id uuid;
  v_assigned_count integer := 0;
  v_existing record;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_machine_ids IS NULL OR array_length(p_machine_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'A valid quality and at least one machine are required' USING ERRCODE = '22023';
  END IF;

  SELECT job.id, job.quality_label, job.status
  INTO v_job
  FROM public.base_production_jobs AS job
  WHERE job.org_id = v_org_id
    AND job.id = p_job_id
    AND job.status IN ('planned', 'active');

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Choose an active Base production quality' USING ERRCODE = '23503';
  END IF;

  FOREACH v_machine_id IN ARRAY p_machine_ids LOOP
    PERFORM pg_advisory_xact_lock(
      hashtextextended(v_org_id::text || ':base-context:' || v_machine_id::text, 0)
    );

    IF NOT EXISTS (
      SELECT 1
      FROM public.base_production_machines AS machine
      WHERE machine.org_id = v_org_id
        AND machine.id = v_machine_id
        AND machine.is_active IS TRUE
    ) THEN
      RAISE EXCEPTION 'Machine % is inactive or not found', v_machine_id USING ERRCODE = '23503';
    END IF;

    SELECT context.id, context.job_id
    INTO v_existing
    FROM public.base_machine_job_contexts AS context
    WHERE context.org_id = v_org_id
      AND context.machine_id = v_machine_id
      AND context.active IS TRUE
      AND context.effective_to IS NULL
    FOR UPDATE;

    IF v_existing.id IS NOT NULL AND v_existing.job_id = p_job_id THEN
      CONTINUE;
    END IF;

    IF v_existing.id IS NOT NULL THEN
      RAISE EXCEPTION 'Machine % is currently producing another quality. Use Switch Quality instead.', v_machine_id
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.base_machine_job_contexts (
      org_id, machine_id, job_id, active, effective_from, created_by
    )
    VALUES (
      v_org_id, v_machine_id, p_job_id, true, p_effective_from, auth.uid()
    );

    v_assigned_count := v_assigned_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'assigned_count', v_assigned_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.set_base_machine_job_context(uuid, uuid, date)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_base_machine_job_context(uuid, uuid, date)
  TO authenticated;

REVOKE ALL ON FUNCTION public.activate_saved_costing_for_production(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.activate_saved_costing_for_production(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.deactivate_quality_production(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_quality_production(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.switch_base_machine_quality(uuid, uuid, date)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.switch_base_machine_quality(uuid, uuid, date)
  TO authenticated;

REVOKE ALL ON FUNCTION public.bulk_assign_machines_to_quality(uuid, uuid[], date)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_assign_machines_to_quality(uuid, uuid[], date)
  TO authenticated;
