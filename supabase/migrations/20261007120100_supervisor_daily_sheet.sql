-- Supervisors record the Base daily sheet through the same reviewed writer
-- the owner uses, so register validation, request idempotency, conflict
-- checks, paid-worker protection and correction receipts are shared.
--
-- Before: each layer of the save chain looked up "the caller's org where
-- role = owner". After: one helper returns the owner's org or an approved
-- supervisor's org; the reviewed body moves to a private core; the owner and
-- supervisor entry points apply their own rules before calling it.

-- Owner with Base production access (unchanged rule), else an active supervisor.
CREATE FUNCTION private.base_daily_sheet_writer_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    (SELECT profile.org_id FROM public.profiles AS profile
     WHERE profile.id = (SELECT auth.uid())
       AND profile.role::text = 'owner'
       AND private.base_production_core_access(profile.org_id)),
    private.active_supervisor_org()
  );
$function$;

REVOKE ALL ON FUNCTION private.base_daily_sheet_writer_org() FROM PUBLIC, anon, authenticated, service_role;

-- Patch the owner lookup in the live writer definitions. Anchors are asserted
-- so a drifted definition fails the migration instead of half-applying.
DO $migration$
DECLARE
  v_original text;
  v_definition text;
  v_layered_anchor constant text :=
    '  SELECT profile.org_id' || chr(10) ||
    '  INTO v_org_id' || chr(10) ||
    '  FROM public.profiles AS profile' || chr(10) ||
    '  WHERE profile.id = auth.uid()' || chr(10) ||
    '    AND profile.role::text = ''owner'';' || chr(10) ||
    chr(10) ||
    '  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN';
  v_layered_replacement constant text :=
    '  v_org_id := private.base_daily_sheet_writer_org();' || chr(10) ||
    chr(10) ||
    '  IF v_org_id IS NULL THEN';
  v_reviewed_anchor constant text :=
    '  SELECT org_id INTO v_org_id FROM public.profiles WHERE id = auth.uid() AND role::text = ''owner'';' || chr(10) ||
    '  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN';
  v_reviewed_replacement constant text :=
    '  v_org_id := private.base_daily_sheet_writer_org();' || chr(10) ||
    '  IF v_org_id IS NULL THEN';
  v_function regprocedure;
BEGIN
  FOREACH v_function IN ARRAY ARRAY[
    'public.save_base_daily_production(date,text,uuid,jsonb)'::regprocedure,
    'public.save_base_daily_production_with_reason(date,text,uuid,jsonb,text)'::regprocedure
  ] LOOP
    v_original := pg_get_functiondef(v_function);
    IF array_length(string_to_array(v_original, v_layered_anchor), 1) IS DISTINCT FROM 2 THEN
      RAISE EXCEPTION 'Unexpected Base daily writer definition: %', v_function;
    END IF;
    v_definition := replace(v_original, v_layered_anchor, v_layered_replacement);
    EXECUTE v_definition;
  END LOOP;

  ALTER FUNCTION public.save_base_daily_production_reviewed(date, text, uuid, jsonb, text, timestamptz)
    SET SCHEMA private;
  ALTER FUNCTION private.save_base_daily_production_reviewed(date, text, uuid, jsonb, text, timestamptz)
    RENAME TO save_base_daily_production_reviewed_core;

  v_original := pg_get_functiondef('private.save_base_daily_production_reviewed_core(date,text,uuid,jsonb,text,timestamptz)'::regprocedure);
  IF array_length(string_to_array(v_original, v_reviewed_anchor), 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Unexpected Base reviewed writer definition';
  END IF;
  v_definition := replace(v_original, v_reviewed_anchor, v_reviewed_replacement);
  EXECUTE v_definition;
END;
$migration$;

-- The inner writers stay uncallable by clients (20260901110005).
REVOKE ALL ON FUNCTION public.save_base_daily_production(date, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_base_daily_production_with_reason(date, text, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.save_base_daily_production_reviewed_core(date, text, uuid, jsonb, text, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION private.save_base_daily_production_reviewed_core(date, text, uuid, jsonb, text, timestamptz) IS
  'Reviewed Base daily sheet writer shared by the owner and supervisor entry points. Patch this body, not the wrappers.';

-- ── Owner entry point (unchanged contract) ──────────────────────────────────

CREATE FUNCTION public.save_base_daily_production_reviewed(
  p_production_date date, p_shift text, p_client_request_id uuid,
  p_entries jsonb, p_correction_reason text, p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT profile.org_id INTO v_org_id FROM public.profiles AS profile
  WHERE profile.id = (SELECT auth.uid()) AND profile.role::text = 'owner';
  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;
  RETURN private.save_base_daily_production_reviewed_core(
    p_production_date, p_shift, p_client_request_id, p_entries, p_correction_reason, p_expected_updated_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_base_daily_production_reviewed(date, text, uuid, jsonb, text, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_base_daily_production_reviewed(date, text, uuid, jsonb, text, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.save_base_daily_production_reviewed(date, text, uuid, jsonb, text, timestamptz) IS
  'Owner entry point for the Base daily sheet. The body is private.save_base_daily_production_reviewed_core.';

-- ── Supervisor entry point ──────────────────────────────────────────────────

CREATE FUNCTION private.require_supervisor_sheet_org(p_production_date date, p_shift text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid := private.active_supervisor_org();
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Supervisor access is required' USING ERRCODE = '42501';
  END IF;
  IF private.supervisor_org_locked(v_org_id) THEN
    RAISE EXCEPTION 'Organization is locked. Business writes are disabled until compliance unlock.' USING ERRCODE = '42501';
  END IF;
  IF p_production_date IS NULL OR p_production_date < v_today - 1 OR p_production_date > v_today THEN
    RAISE EXCEPTION 'Supervisors can record today and yesterday only.' USING ERRCODE = '22023';
  END IF;
  IF p_shift IS NULL OR p_shift NOT IN ('day', 'night') THEN
    RAISE EXCEPTION 'Choose the day or night shift.' USING ERRCODE = '22023';
  END IF;
  RETURN v_org_id;
END;
$function$;

REVOKE ALL ON FUNCTION private.require_supervisor_sheet_org(date, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.save_supervisor_daily_sheet(
  p_production_date date, p_shift text, p_client_request_id uuid,
  p_entries jsonb, p_correction_reason text, p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid := private.require_supervisor_sheet_org(p_production_date, p_shift);
  v_result jsonb;
BEGIN
  v_result := private.save_base_daily_production_reviewed_core(
    p_production_date, p_shift, p_client_request_id, p_entries, p_correction_reason, p_expected_updated_at
  );
  -- Recorded output starts a planned job, as the owner's save action does.
  UPDATE public.base_production_jobs AS job
  SET status = 'active', updated_at = now()
  WHERE job.org_id = v_org_id
    AND job.status = 'planned'
    AND job.id IN (
      SELECT (allocation ->> 'job_id')::uuid
      FROM jsonb_array_elements(p_entries) AS entry,
           jsonb_array_elements(COALESCE(entry -> 'allocations', '[]'::jsonb)) AS allocation
      WHERE (allocation ->> 'meters')::numeric > 0
    );
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_supervisor_daily_sheet(date, text, uuid, jsonb, text, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_supervisor_daily_sheet(date, text, uuid, jsonb, text, timestamptz) TO authenticated;

-- ── Supervisor read: metres only ────────────────────────────────────────────
-- Never selects worker or job rates, salaries, costing prices, pay snapshots
-- or payroll amounts. The operator fields let the client reuse
-- isBaseOperatorAvailable; none of them is money.

CREATE FUNCTION public.get_supervisor_daily_sheet(p_production_date date, p_shift text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid := private.require_supervisor_sheet_org(p_production_date, p_shift);
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_batch public.base_production_batches%ROWTYPE;
BEGIN
  SELECT * INTO v_batch FROM public.base_production_batches AS batch
  WHERE batch.org_id = v_org_id AND batch.production_date = p_production_date AND batch.shift = p_shift;

  RETURN jsonb_build_object(
    'org_id', v_org_id,
    'factory_name', (SELECT organization.name FROM public.organizations AS organization WHERE organization.id = v_org_id),
    'today', v_today,
    'min_date', v_today - 1,
    'batch', CASE WHEN v_batch.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_batch.id, 'status', v_batch.status, 'updated_at', v_batch.updated_at,
      'client_request_id', v_batch.client_request_id,
      'machine_records', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'machine_id', record ->> 'machine_id', 'worker_id', record ->> 'worker_id',
          'machine_label', record ->> 'machine_label', 'job_id', record ->> 'job_id',
          'job_label', record ->> 'job_label', 'state', record ->> 'state'
        ))
        FROM jsonb_array_elements(v_batch.machine_records) AS record
      ), '[]'::jsonb)
    ) END,
    'workers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', worker.id, 'name', worker.name, 'is_active', worker.is_active,
        'shift_availability', worker.shift_availability, 'pay_type', worker.pay_type,
        'operator_eligible', worker.operator_eligible, 'operator_effective_from', worker.operator_effective_from,
        'start_date', worker.start_date, 'end_date', worker.end_date,
        'paid', EXISTS (
          SELECT 1 FROM public.base_payroll_settlements AS settlement
          WHERE settlement.org_id = v_org_id AND settlement.worker_id = worker.id
            AND settlement.status = 'paid' AND settlement.period_end >= p_production_date
        )
      ) ORDER BY worker.name, worker.id)
      FROM public.base_production_workers AS worker
      WHERE worker.org_id = v_org_id
        AND (worker.is_active
          OR EXISTS (SELECT 1 FROM public.base_daily_production_entries AS entry
                     WHERE entry.org_id = v_org_id AND entry.batch_id = v_batch.id AND entry.worker_id = worker.id)
          OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_batch.machine_records, '[]'::jsonb)) AS record
                     WHERE record ->> 'worker_id' = worker.id::text))
    ), '[]'::jsonb),
    'machines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', machine.id, 'label', COALESCE(NULLIF(machine.custom_label, ''), machine.name),
        'machine_type', machine.machine_type, 'is_active', machine.is_active
      ) ORDER BY machine.name, machine.id)
      FROM public.base_production_machines AS machine
      WHERE machine.org_id = v_org_id
        AND (machine.is_active
          OR EXISTS (SELECT 1 FROM public.base_daily_production_allocations AS allocation
                     JOIN public.base_daily_production_entries AS entry ON entry.org_id = allocation.org_id AND entry.id = allocation.entry_id
                     WHERE allocation.org_id = v_org_id AND entry.batch_id = v_batch.id AND allocation.machine_id = machine.id)
          OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_batch.machine_records, '[]'::jsonb)) AS record
                     WHERE record ->> 'machine_id' = machine.id::text))
    ), '[]'::jsonb),
    'assignments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', current.id, 'worker_id', current.worker_id, 'machine_id', current.machine_id))
      FROM (
        SELECT DISTINCT ON (assignment.machine_id) assignment.id, assignment.worker_id, assignment.machine_id
        FROM public.base_worker_machine_assignments AS assignment
        WHERE assignment.org_id = v_org_id AND assignment.shift = p_shift AND assignment.active
          AND assignment.effective_from <= p_production_date
          AND (assignment.effective_to IS NULL OR assignment.effective_to >= p_production_date)
        ORDER BY assignment.machine_id, assignment.effective_from DESC, assignment.id
      ) AS current
    ), '[]'::jsonb),
    'machine_jobs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('machine_id', current.machine_id, 'job_id', current.job_id, 'job_label', current.job_label))
      FROM (
        SELECT DISTINCT ON (context.machine_id) context.machine_id, job.id AS job_id, job.quality_label AS job_label
        FROM public.base_machine_job_contexts AS context
        JOIN public.base_production_jobs AS job ON job.org_id = context.org_id AND job.id = context.job_id
        WHERE context.org_id = v_org_id AND context.active AND job.status <> 'cancelled'
          AND context.effective_from <= p_production_date
          AND (context.effective_to IS NULL OR context.effective_to >= p_production_date)
        ORDER BY context.machine_id, context.effective_from DESC, context.id
      ) AS current
    ), '[]'::jsonb),
    'entries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', entry.id, 'worker_id', entry.worker_id, 'entry_status', entry.entry_status,
        'meters', entry.meters, 'notes', entry.notes, 'machine_id', entry.machine_id, 'job_id', entry.job_id
      ) ORDER BY entry.worker_id)
      FROM public.base_daily_production_entries AS entry
      WHERE entry.org_id = v_org_id AND entry.batch_id = v_batch.id
    ), '[]'::jsonb),
    'allocations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'entry_id', allocation.entry_id, 'worker_id', allocation.worker_id, 'assignment_id', allocation.assignment_id,
        'machine_id', allocation.machine_id, 'job_id', allocation.job_id,
        'machine_label', allocation.machine_label, 'job_label', allocation.job_label, 'meters', allocation.meters
      ) ORDER BY allocation.machine_label, allocation.id)
      FROM public.base_daily_production_allocations AS allocation
      JOIN public.base_daily_production_entries AS entry ON entry.org_id = allocation.org_id AND entry.id = allocation.entry_id
      WHERE allocation.org_id = v_org_id AND entry.batch_id = v_batch.id
    ), '[]'::jsonb),
    'revisions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'revision_number', revision.revision_number, 'change_kind', revision.change_kind,
        'correction_reason', revision.correction_reason, 'changed_at', revision.changed_at,
        'changed_by_name', author.full_name,
        'before_total', (revision.before_snapshot ->> 'total_meters')::numeric,
        'after_total', (revision.after_snapshot ->> 'total_meters')::numeric,
        'entered_count', (revision.after_snapshot ->> 'entered_count')::integer,
        'zero_count', (revision.after_snapshot ->> 'zero_count')::integer,
        'absent_count', (revision.after_snapshot ->> 'absent_count')::integer
      ) ORDER BY revision.revision_number DESC)
      FROM public.base_production_batch_revisions AS revision
      LEFT JOIN public.profiles AS author ON author.id = revision.changed_by
      WHERE revision.org_id = v_org_id AND revision.batch_id = v_batch.id
    ), '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_supervisor_daily_sheet(date, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_supervisor_daily_sheet(date, text) TO authenticated;
