-- Switch shifts also covers "Day & night" workers who run at least one loom. Each of
-- their looms moves to the other shift (a day loom goes to night, a night loom to day)
-- and their shift setting stays Day & night. Single-shift workers behave as before.
-- A Day & night worker with no open loom has nothing to switch and is still refused.
CREATE OR REPLACE FUNCTION public.rotate_base_worker_shifts(
  p_worker_ids uuid[],
  p_effective_from date DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_ids uuid[];
  v_locked integer;
  v_slot record;
  v_clashes jsonb;
  v_ended jsonb;
  v_looms integer;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;

  IF p_effective_from IS NULL OR p_worker_ids IS NULL OR cardinality(p_worker_ids) = 0 THEN
    RAISE EXCEPTION 'Choose at least one worker and an effective date' USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(DISTINCT selected.worker_id)
  INTO v_ids
  FROM unnest(p_worker_ids) AS selected(worker_id)
  WHERE selected.worker_id IS NOT NULL;

  IF v_ids IS NULL THEN
    RAISE EXCEPTION 'Choose at least one worker and an effective date' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':base-shift-rotation', 0));

  -- Same per-slot locks the single assignment function takes, in a fixed order.
  FOR v_slot IN
    SELECT DISTINCT assignment.machine_id, slot.shift
    FROM public.base_worker_machine_assignments AS assignment
    CROSS JOIN (VALUES ('day'), ('night')) AS slot(shift)
    WHERE assignment.org_id = v_org_id
      AND assignment.worker_id = ANY (v_ids)
      AND assignment.active IS TRUE
      AND assignment.effective_to IS NULL
    ORDER BY assignment.machine_id, slot.shift
  LOOP
    PERFORM pg_advisory_xact_lock(
      hashtextextended(v_org_id::text || ':base-assignment:' || v_slot.machine_id::text || ':' || v_slot.shift, 0)
    );
  END LOOP;

  -- Every selected worker must belong to this factory and be rotatable: on one shift,
  -- or Day & night with at least one loom to swap.
  SELECT count(*)
  INTO v_locked
  FROM (
    SELECT worker.id
    FROM public.base_production_workers AS worker
    WHERE worker.org_id = v_org_id
      AND worker.id = ANY (v_ids)
      AND worker.is_active IS TRUE
      AND worker.pay_type = 'piece_rate'
      AND (
        worker.shift_availability IN ('day', 'night')
        OR (
          worker.shift_availability = 'both'
          AND EXISTS (
            SELECT 1
            FROM public.base_worker_machine_assignments AS assignment
            WHERE assignment.org_id = worker.org_id
              AND assignment.worker_id = worker.id
              AND assignment.active IS TRUE
              AND assignment.effective_to IS NULL
          )
        )
      )
    ORDER BY worker.id
    FOR UPDATE OF worker
  ) AS locked_workers;

  IF v_locked <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'Choose active piece-rate workers on one shift, or Day & night workers who run a loom' USING ERRCODE = '22023';
  END IF;

  -- Clashes: a target slot still held by a worker who is not switching.
  SELECT jsonb_agg(
    jsonb_build_object(
      'worker_name', mover.name,
      'machine_name', machine.name,
      'shift', CASE assignment.shift WHEN 'day' THEN 'night' ELSE 'day' END,
      'held_by_worker_name', holder_worker.name
    )
    ORDER BY mover.name, machine.name
  )
  INTO v_clashes
  FROM public.base_worker_machine_assignments AS assignment
  JOIN public.base_production_workers AS mover
    ON mover.org_id = assignment.org_id AND mover.id = assignment.worker_id
  JOIN public.base_production_machines AS machine
    ON machine.org_id = assignment.org_id AND machine.id = assignment.machine_id
  JOIN public.base_worker_machine_assignments AS holder
    ON holder.org_id = assignment.org_id
   AND holder.machine_id = assignment.machine_id
   AND holder.shift = CASE assignment.shift WHEN 'day' THEN 'night' ELSE 'day' END
   AND holder.active IS TRUE
   AND holder.effective_to IS NULL
   AND NOT (holder.worker_id = ANY (v_ids))
  JOIN public.base_production_workers AS holder_worker
    ON holder_worker.org_id = holder.org_id AND holder_worker.id = holder.worker_id
  WHERE assignment.org_id = v_org_id
    AND assignment.worker_id = ANY (v_ids)
    AND assignment.active IS TRUE
    AND assignment.effective_to IS NULL;

  IF v_clashes IS NOT NULL THEN
    RETURN jsonb_build_object(
      'conflict', true,
      'clashes', v_clashes,
      'message', 'A loom already has a worker on the shift someone is moving to.'
    );
  END IF;

  -- End the current rows first so the one-worker-per-loom-shift index never sees
  -- two holders, then flip the single-shift workers (the guard needs the old rows
  -- gone), then start the mirrored rows. Day & night workers keep their setting.
  WITH ended AS (
    UPDATE public.base_worker_machine_assignments AS assignment
    SET active = false,
        effective_to = GREATEST(assignment.effective_from, p_effective_from - 1),
        updated_by = auth.uid(),
        updated_at = now()
    WHERE assignment.org_id = v_org_id
      AND assignment.worker_id = ANY (v_ids)
      AND assignment.active IS TRUE
      AND assignment.effective_to IS NULL
    RETURNING assignment.worker_id, assignment.machine_id, assignment.shift
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'worker_id', ended.worker_id, 'machine_id', ended.machine_id, 'shift', ended.shift)), '[]'::jsonb)
  INTO v_ended
  FROM ended;

  UPDATE public.base_production_workers AS worker
  SET shift_availability = CASE worker.shift_availability WHEN 'day' THEN 'night' ELSE 'day' END
  WHERE worker.org_id = v_org_id
    AND worker.id = ANY (v_ids)
    AND worker.shift_availability IN ('day', 'night');

  INSERT INTO public.base_worker_machine_assignments (
    org_id, worker_id, machine_id, shift, active, effective_from, created_by, updated_by
  )
  SELECT v_org_id,
         moved.worker_id,
         moved.machine_id,
         CASE moved.shift WHEN 'day' THEN 'night' ELSE 'day' END,
         true,
         p_effective_from,
         auth.uid(),
         auth.uid()
  FROM jsonb_to_recordset(v_ended) AS moved(worker_id uuid, machine_id uuid, shift text);

  GET DIAGNOSTICS v_looms = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'workers_moved', cardinality(v_ids),
    'looms_moved', v_looms,
    'effective_from', p_effective_from
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rotate_base_worker_shifts(uuid[], date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rotate_base_worker_shifts(uuid[], date)
  TO authenticated;

COMMENT ON FUNCTION public.rotate_base_worker_shifts(uuid[], date) IS
  'Owner-only. Moves selected piece-rate workers to the opposite shift together with their current loom assignments (Day & night workers keep their setting and each loom swaps shift); reports clashes instead of writing when a target loom shift is held by someone who is not switching.';
