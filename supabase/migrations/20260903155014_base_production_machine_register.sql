-- The register records completeness independently of payroll allocations.
-- Zero-output machines never create paid/produced metres. Existing RLS and
-- revoked direct writes on batches continue to apply to this new column.
ALTER TABLE public.base_production_batches
  ADD COLUMN machine_records jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(machine_records) = 'array');

CREATE OR REPLACE FUNCTION public.save_base_daily_production_reviewed(
  p_production_date date, p_shift text, p_client_request_id uuid,
  p_entries jsonb, p_correction_reason text, p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_updated_at timestamptz;
  v_payload jsonb;
  v_receipt public.base_production_save_receipts%ROWTYPE;
  v_result jsonb;
  v_before_records jsonb := '[]'::jsonb;
  v_records jsonb := '[]'::jsonb;
  v_record jsonb;
  v_old_record jsonb;
  v_worker record;
  v_machine record;
  v_has_register boolean;
  v_batch_id uuid;
  v_batch_status text;
  v_seen uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT org_id INTO v_org_id FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;
  IF p_production_date IS NULL OR p_shift IS NULL OR p_shift NOT IN ('day', 'night') OR p_client_request_id IS NULL
    OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'A date, shift, entries and request identifier are required' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':base-daily:' || p_production_date::text || ':' || p_shift, 0));
  v_payload := jsonb_build_object('date', p_production_date, 'shift', p_shift, 'entries', p_entries,
    'reason', p_correction_reason, 'expected_updated_at', p_expected_updated_at);
  SELECT * INTO v_receipt FROM public.base_production_save_receipts
  WHERE org_id = v_org_id AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF v_receipt.request_payload IS DISTINCT FROM v_payload THEN
      RAISE EXCEPTION 'This save request already recorded different production. Reload the shift.' USING ERRCODE = '40001';
    END IF;
    RETURN v_receipt.response || jsonb_build_object('idempotent', true);
  END IF;
  SELECT id, updated_at, machine_records, status INTO v_batch_id, v_updated_at, v_before_records, v_batch_status FROM public.base_production_batches
  WHERE org_id = v_org_id AND production_date = p_production_date AND shift = p_shift FOR UPDATE;
  v_before_records := COALESCE(v_before_records, '[]'::jsonb);
  IF v_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The production shift changed after it was opened. Reload before correcting it.' USING ERRCODE = '40001';
  END IF;
  IF v_batch_status = 'finalized' THEN
    RAISE EXCEPTION 'This production sheet is finalized and cannot be changed.' USING ERRCODE = '22023';
  END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(p_entries) e WHERE e ? 'machine_records') INTO v_has_register;
  IF NOT v_has_register AND jsonb_array_length(v_before_records) > 0 THEN
    RAISE EXCEPTION 'Reload the production register before correcting this shift.' USING ERRCODE = '40001';
  END IF;

  IF v_has_register THEN
    FOR v_worker IN SELECT * FROM jsonb_to_recordset(p_entries)
      AS e(worker_id uuid, entry_status text, allocations jsonb, machine_records jsonb)
    LOOP
      IF jsonb_typeof(v_worker.machine_records) IS DISTINCT FROM 'array'
        OR jsonb_array_length(v_worker.machine_records) > 100 THEN
        RAISE EXCEPTION 'Each worker requires a machine register (at most 100 machines).' USING ERRCODE = '22023';
      END IF;
      FOR v_machine IN SELECT * FROM jsonb_to_recordset(v_worker.machine_records) AS m(machine_id uuid, state text)
      LOOP
        IF v_machine.machine_id IS NULL OR v_machine.state IS NULL
          OR v_machine.state NOT IN ('entered', 'pending', 'not_running', 'absent')
          OR v_machine.machine_id = ANY(v_seen) THEN
          RAISE EXCEPTION 'Each machine must appear once with a valid register state.' USING ERRCODE = '22023';
        END IF;
        v_seen := array_append(v_seen, v_machine.machine_id);
        IF (v_machine.state = 'entered') IS DISTINCT FROM EXISTS (
          SELECT 1 FROM jsonb_to_recordset(COALESCE(v_worker.allocations, '[]')) AS a(machine_id uuid)
          WHERE a.machine_id = v_machine.machine_id
        ) OR (v_machine.state = 'absent') IS DISTINCT FROM (v_worker.entry_status = 'absent')
          OR (v_machine.state = 'not_running' AND v_worker.entry_status NOT IN ('zero', 'entered')) THEN
          RAISE EXCEPTION 'Machine register states must match worker production.' USING ERRCODE = '22023';
        END IF;

        SELECT r INTO v_old_record FROM jsonb_array_elements(v_before_records) r
        WHERE r->>'machine_id' = v_machine.machine_id::text AND r->>'worker_id' = v_worker.worker_id::text;
        -- Historical labels/assignments remain stable, including paid workers.
        IF v_old_record IS NOT NULL THEN
          v_record := v_old_record || jsonb_build_object('state', v_machine.state);
        ELSE
          -- Legacy paid allocations may outlive their active Setup assignment.
          SELECT jsonb_build_object('machine_id', a.machine_id, 'worker_id', a.worker_id,
            'machine_label', a.machine_label, 'job_id', a.job_id, 'job_label', a.job_label, 'state', v_machine.state)
          INTO v_record FROM public.base_daily_production_allocations a
          JOIN public.base_daily_production_entries e ON e.org_id = a.org_id AND e.id = a.entry_id
          WHERE a.org_id = v_org_id AND e.batch_id = v_batch_id AND a.worker_id = v_worker.worker_id
            AND a.machine_id = v_machine.machine_id LIMIT 1;
          IF v_record IS NULL THEN
          SELECT jsonb_build_object('machine_id', m.id, 'worker_id', a.worker_id,
            'machine_label', COALESCE(NULLIF(m.custom_label, ''), m.name),
            'job_id', job.id, 'job_label', job.quality_label, 'state', v_machine.state)
          INTO v_record
          FROM public.base_worker_machine_assignments a
          JOIN public.base_production_machines m ON m.org_id = a.org_id AND m.id = a.machine_id
          LEFT JOIN LATERAL (
            SELECT j.id, j.quality_label FROM public.base_machine_job_contexts c
            JOIN public.base_production_jobs j ON j.org_id = c.org_id AND j.id = c.job_id
            WHERE c.org_id = a.org_id AND c.machine_id = m.id AND c.active
              AND c.effective_from <= p_production_date AND (c.effective_to IS NULL OR c.effective_to >= p_production_date)
              AND j.status <> 'cancelled'
            ORDER BY c.effective_from DESC, c.id LIMIT 1
          ) job ON true
          WHERE a.org_id = v_org_id AND a.worker_id = v_worker.worker_id AND a.machine_id = v_machine.machine_id
            AND a.shift = p_shift AND a.active AND m.is_active
            AND a.effective_from <= p_production_date AND (a.effective_to IS NULL OR a.effective_to >= p_production_date)
          ORDER BY a.effective_from DESC, a.id LIMIT 1;
          END IF;
          IF v_record IS NULL THEN
            RAISE EXCEPTION 'Machine register does not match the dated worker assignment.' USING ERRCODE = '23503';
          END IF;
        END IF;
        v_records := v_records || jsonb_build_array(v_record);
      END LOOP;
      IF EXISTS (SELECT 1 FROM jsonb_to_recordset(COALESCE(v_worker.allocations, '[]')) AS a(machine_id uuid)
        WHERE NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(v_worker.machine_records) AS r(machine_id uuid, state text)
          WHERE r.machine_id = a.machine_id AND r.state = 'entered')) THEN
        RAISE EXCEPTION 'Every produced machine must appear in the register.' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;

  -- The authoritative writer acquires payroll locks, validates allocations,
  -- preserves paid rows and creates the correction receipt in this transaction.
  v_result := public.save_base_daily_production_with_reason(p_production_date, p_shift, p_client_request_id, p_entries, p_correction_reason);
  v_batch_id := (v_result ->> 'batch_id')::uuid;
  IF v_has_register AND NOT COALESCE((v_result->>'idempotent')::boolean, false) THEN
    -- Entered rows use the authoritative writer's saved costing/label snapshots.
    SELECT COALESCE(jsonb_agg(CASE WHEN a.id IS NULL THEN r ELSE r || jsonb_build_object(
      'machine_label', a.machine_label, 'job_id', a.job_id, 'job_label', a.job_label) END ORDER BY r->>'machine_id'), '[]')
    INTO v_records FROM jsonb_array_elements(v_records) r
    LEFT JOIN public.base_daily_production_entries e ON e.org_id = v_org_id AND e.batch_id = v_batch_id AND e.worker_id::text = r->>'worker_id'
    LEFT JOIN public.base_daily_production_allocations a ON a.org_id = v_org_id AND a.entry_id = e.id AND a.machine_id::text = r->>'machine_id';
    -- Check AFTER payroll locks are acquired to avoid racing settlement.
    IF EXISTS (
      SELECT 1 FROM public.base_payroll_settlements paid
      WHERE paid.org_id = v_org_id AND paid.status = 'paid' AND p_production_date <= paid.period_end
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_before_records) old WHERE old->>'worker_id' = paid.worker_id::text)
        AND (SELECT COALESCE(jsonb_agg(r ORDER BY r->>'machine_id'), '[]') FROM jsonb_array_elements(v_records) r
          WHERE r->>'worker_id' = paid.worker_id::text AND r->>'state' <> 'pending')
        IS DISTINCT FROM
        (SELECT COALESCE(jsonb_agg(r ORDER BY r->>'machine_id'), '[]') FROM jsonb_array_elements(v_before_records) r
          WHERE r->>'worker_id' = paid.worker_id::text AND r->>'state' <> 'pending')
    ) THEN
      RAISE EXCEPTION 'Paid worker machine records are protected.' USING ERRCODE = '22023';
    END IF;
    -- On the first register save of a legacy paid row, only existing production,
    -- its existing zero/absence, or unknown readings may be carried forward.
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_records) r
      JOIN public.base_payroll_settlements paid ON paid.org_id = v_org_id AND paid.worker_id::text = r->>'worker_id'
        AND paid.status = 'paid' AND p_production_date <= paid.period_end
      LEFT JOIN public.base_daily_production_entries e ON e.org_id = v_org_id AND e.batch_id = v_batch_id AND e.worker_id = paid.worker_id
      WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_before_records) old WHERE old->>'worker_id' = paid.worker_id::text)
        AND r->>'state' = 'not_running' AND e.entry_status IS DISTINCT FROM 'zero'
    ) THEN
      RAISE EXCEPTION 'Paid worker machine records are protected.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.base_production_batches SET machine_records = v_records WHERE org_id = v_org_id AND id = v_batch_id;
    -- Enrich only the receipt just created by this transaction, never history.
    UPDATE public.base_production_batch_revisions
    SET before_snapshot = CASE WHEN before_snapshot IS NULL THEN NULL ELSE before_snapshot || jsonb_build_object('machine_records', v_before_records) END,
        after_snapshot = after_snapshot || jsonb_build_object('machine_records', v_records)
    WHERE org_id = v_org_id AND batch_id = v_batch_id AND revision_number = (v_result->>'revision_number')::integer;
  END IF;
  INSERT INTO public.base_production_save_receipts(org_id, client_request_id, batch_id, request_payload, response)
  VALUES (v_org_id, p_client_request_id, v_batch_id, v_payload, v_result);
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_base_daily_production_reviewed(date, text, uuid, jsonb, text, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_base_daily_production_reviewed(date, text, uuid, jsonb, text, timestamptz) TO authenticated;
