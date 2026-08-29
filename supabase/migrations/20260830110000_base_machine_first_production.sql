-- Base Production Sprint 7: machine-first daily production and payroll.
--
-- A daily sheet is entered per machine. The assigned worker, costing/job, and
-- rate are resolved server-side from the dated assignment/context and stored
-- as immutable allocation snapshots. The existing worker-level entry remains
-- as a roll-up for compatibility, while payroll uses the allocation rows when
-- they exist.

ALTER TABLE public.base_production_jobs
  ADD COLUMN IF NOT EXISTS worker_rate_per_meter numeric(12,2) NOT NULL DEFAULT 0;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.base_production_jobs'::regclass
      AND conname = 'base_production_jobs_worker_rate_check'
  ) THEN
    ALTER TABLE public.base_production_jobs
      ADD CONSTRAINT base_production_jobs_worker_rate_check
      CHECK (
        worker_rate_per_meter >= 0
        AND worker_rate_per_meter NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
      );
  END IF;
END;
$constraints$;

-- Costing rates are snapshotted on the Base job. Existing jobs use the rate
-- saved on their source costing when available; a zero value intentionally
-- falls back to the Base worker's default rate for legacy jobs.
UPDATE public.base_production_jobs AS job
SET worker_rate_per_meter = COALESCE(quote.worker_rate_per_m, 0)
FROM public.estimator_quotes AS quote
WHERE quote.org_id = job.org_id
  AND quote.id = job.costing_id
  AND COALESCE(quote.worker_rate_per_m, 0) > 0;

COMMENT ON COLUMN public.base_production_jobs.worker_rate_per_meter IS
  'Worker piece-rate snapshot from the costing used by this Base production job.';

ALTER TABLE public.base_daily_production_entries
  ADD COLUMN IF NOT EXISTS allocation_mode text NOT NULL DEFAULT 'worker_total';

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.base_daily_production_entries'::regclass
      AND conname = 'base_daily_production_entries_allocation_mode_check'
  ) THEN
    ALTER TABLE public.base_daily_production_entries
      ADD CONSTRAINT base_daily_production_entries_allocation_mode_check
      CHECK (allocation_mode IN ('worker_total', 'machine_breakdown'));
  END IF;
END;
$constraints$;

CREATE TABLE public.base_daily_production_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  assignment_id uuid,
  machine_id uuid NOT NULL,
  job_id uuid NOT NULL,
  meters numeric(14,2) NOT NULL CHECK (
    meters > 0
    AND meters NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  worker_rate_snapshot numeric(12,2) NOT NULL CHECK (
    worker_rate_snapshot >= 0
    AND worker_rate_snapshot NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  machine_label text NOT NULL CHECK (char_length(btrim(machine_label)) BETWEEN 1 AND 120),
  job_label text NOT NULL CHECK (char_length(btrim(job_label)) BETWEEN 1 AND 160),
  assignment_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(assignment_snapshot) = 'object'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  UNIQUE (entry_id, machine_id, job_id),
  CONSTRAINT base_daily_production_allocations_entry_same_org_fkey
    FOREIGN KEY (org_id, entry_id)
    REFERENCES public.base_daily_production_entries(org_id, id)
    ON DELETE CASCADE,
  CONSTRAINT base_daily_production_allocations_worker_same_org_fkey
    FOREIGN KEY (org_id, worker_id)
    REFERENCES public.base_production_workers(org_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT base_daily_production_allocations_assignment_same_org_fkey
    FOREIGN KEY (org_id, assignment_id)
    REFERENCES public.base_worker_machine_assignments(org_id, id)
    ON DELETE SET NULL,
  CONSTRAINT base_daily_production_allocations_machine_same_org_fkey
    FOREIGN KEY (org_id, machine_id)
    REFERENCES public.base_production_machines(org_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT base_daily_production_allocations_job_same_org_fkey
    FOREIGN KEY (org_id, job_id)
    REFERENCES public.base_production_jobs(org_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX base_daily_production_allocations_org_worker_date_idx
  ON public.base_daily_production_allocations(org_id, worker_id, created_at DESC);
CREATE INDEX base_daily_production_allocations_org_machine_date_idx
  ON public.base_daily_production_allocations(org_id, machine_id, created_at DESC);
CREATE INDEX base_daily_production_allocations_org_job_idx
  ON public.base_daily_production_allocations(org_id, job_id, created_at DESC);

ALTER TABLE public.base_daily_production_allocations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.base_daily_production_allocations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.base_daily_production_allocations TO authenticated;

CREATE POLICY base_daily_production_allocations_owner_read
  ON public.base_daily_production_allocations
  FOR SELECT TO authenticated
  USING (private.base_production_core_access(org_id));

-- The Data API cannot mutate allocation rows directly. The owner-only batch
-- RPC below is the single write path, which resolves assignment/job/rate data
-- from tenant-scoped records and writes both the worker roll-up and children.

CREATE OR REPLACE FUNCTION public.validate_base_production_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_job public.base_production_jobs%ROWTYPE;
  v_worker_active boolean;
  v_worker_rate numeric;
  v_existing_meters numeric;
BEGIN
  SELECT *
  INTO v_job
  FROM public.base_production_jobs AS job
  WHERE job.org_id = NEW.org_id
    AND job.id = NEW.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production job not found'
      USING ERRCODE = '23503';
  END IF;

  IF v_job.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Production cannot be recorded on a completed or cancelled job'
      USING ERRCODE = '22023';
  END IF;

  SELECT worker.is_active, worker.rate_per_meter
  INTO v_worker_active, v_worker_rate
  FROM public.base_production_workers AS worker
  WHERE worker.org_id = NEW.org_id
    AND worker.id = NEW.worker_id;

  IF COALESCE(v_worker_active, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Production can only be recorded for an active worker'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.production_date > (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RAISE EXCEPTION 'Production date cannot be in the future'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.production_date < v_job.start_date THEN
    RAISE EXCEPTION 'Production date cannot be before the job start date'
      USING ERRCODE = '22023';
  END IF;

  NEW.worker_rate_snapshot := COALESCE(NULLIF(v_job.worker_rate_per_meter, 0), v_worker_rate);

  SELECT COALESCE(SUM(entry.meters), 0)
  INTO v_existing_meters
  FROM public.base_production_entries AS entry
  WHERE entry.org_id = NEW.org_id
    AND entry.job_id = NEW.job_id;

  IF v_existing_meters + NEW.meters > v_job.target_meters THEN
    RAISE EXCEPTION 'Production exceeds the job target of % metres', v_job.target_meters
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

-- Cross-row allocation integrity is checked at transaction end so the RPC can
-- insert all child rows before the sum-equals-parent invariant is evaluated.
-- Keep the row-id extraction in table-specific trigger wrappers: NEW.entry_id
-- exists on the child table, while the parent table exposes NEW.id.
CREATE OR REPLACE FUNCTION public.assert_base_daily_production_allocation_totals(p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_org_id uuid;
  v_worker_id uuid;
  v_mode text;
  v_status text;
  v_entry_meters numeric;
  v_allocation_count integer;
  v_allocation_meters numeric;
BEGIN
  IF p_entry_id IS NULL THEN
    RETURN;
  END IF;

  SELECT entry.org_id, entry.worker_id, entry.allocation_mode, entry.entry_status, entry.meters
  INTO v_org_id, v_worker_id, v_mode, v_status, v_entry_meters
  FROM public.base_daily_production_entries AS entry
  WHERE entry.id = p_entry_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*), COALESCE(sum(allocation.meters), 0)
  INTO v_allocation_count, v_allocation_meters
  FROM public.base_daily_production_allocations AS allocation
  WHERE allocation.entry_id = p_entry_id;

  IF EXISTS (
    SELECT 1
    FROM public.base_daily_production_allocations AS allocation
    WHERE allocation.entry_id = p_entry_id
      AND allocation.worker_id IS DISTINCT FROM v_worker_id
  ) THEN
    RAISE EXCEPTION 'Machine allocations must belong to the worker roll-up'
      USING ERRCODE = '22023';
  END IF;

  IF v_mode = 'machine_breakdown' THEN
    IF v_status IS DISTINCT FROM 'entered'
       OR v_allocation_count < 1
       OR abs(v_allocation_meters - COALESCE(v_entry_meters, 0)) > 0.005 THEN
      RAISE EXCEPTION 'Machine allocation metres must equal the worker total'
        USING ERRCODE = '22023';
    END IF;
  ELSIF v_allocation_count > 0 THEN
    RAISE EXCEPTION 'Worker-total entries cannot contain machine allocations'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    WITH job_usage AS (
      SELECT entry.org_id, entry.job_id, SUM(entry.meters) AS meters
      FROM public.base_production_entries AS entry
      WHERE entry.org_id = v_org_id
      GROUP BY entry.org_id, entry.job_id
      UNION ALL
      SELECT daily.org_id, daily.job_id, SUM(daily.meters) AS meters
      FROM public.base_daily_production_entries AS daily
      WHERE daily.org_id = v_org_id
        AND daily.entry_status = 'entered'
        AND daily.allocation_mode = 'worker_total'
        AND daily.job_id IS NOT NULL
      GROUP BY daily.org_id, daily.job_id
      UNION ALL
      SELECT allocation.org_id, allocation.job_id, SUM(allocation.meters) AS meters
      FROM public.base_daily_production_allocations AS allocation
      WHERE allocation.org_id = v_org_id
      GROUP BY allocation.org_id, allocation.job_id
    ), total_job_usage AS (
      SELECT job_usage.org_id, job_usage.job_id, SUM(job_usage.meters) AS meters
      FROM job_usage
      GROUP BY job_usage.org_id, job_usage.job_id
    )
    SELECT 1
    FROM total_job_usage AS usage
    JOIN public.base_production_jobs AS job
      ON job.org_id = usage.org_id
     AND job.id = usage.job_id
    WHERE usage.meters > job.target_meters + 0.005
  ) THEN
    RAISE EXCEPTION 'Production exceeds a costing job target'
      USING ERRCODE = '22023';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_base_daily_production_allocations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  PERFORM public.assert_base_daily_production_allocation_totals(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.entry_id ELSE NEW.entry_id END
  );
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_base_daily_production_entry_allocations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  PERFORM public.assert_base_daily_production_allocation_totals(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
  );
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS validate_base_daily_production_allocations_on_entry
  ON public.base_daily_production_entries;
CREATE CONSTRAINT TRIGGER validate_base_daily_production_allocations_on_entry
  AFTER INSERT OR UPDATE OR DELETE ON public.base_daily_production_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_base_daily_production_entry_allocations();

DROP TRIGGER IF EXISTS validate_base_daily_production_allocations_on_allocation
  ON public.base_daily_production_allocations;
CREATE CONSTRAINT TRIGGER validate_base_daily_production_allocations_on_allocation
  AFTER INSERT OR UPDATE OR DELETE ON public.base_daily_production_allocations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_base_daily_production_allocations();

REVOKE ALL ON FUNCTION public.assert_base_daily_production_allocation_totals(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_base_daily_production_allocations()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_base_daily_production_entry_allocations()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_base_daily_production(
  p_production_date date,
  p_shift text,
  p_client_request_id uuid,
  p_entries jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_batch public.base_production_batches%ROWTYPE;
  v_row record;
  v_allocation_row record;
  v_worker_rate numeric;
  v_assignment_count integer;
  v_distinct_rate_count integer;
  v_assignment_snapshot jsonb;
  v_machine_id uuid;
  v_job_id uuid;
  v_machine_label text;
  v_job_label text;
  v_parent_rate numeric;
  v_batch_id uuid;
  v_entry_id uuid;
  v_input_allocations jsonb;
  v_resolved_allocations jsonb;
  v_allocation_count integer;
  v_allocation_total numeric;
  v_allocation_gross numeric;
  v_resolved_assignment_id uuid;
  v_resolved_rate numeric;
  v_resolved_machine_label text;
  v_resolved_job_label text;
  v_resolved_snapshot jsonb;
  v_batch_total_meters numeric := 0;
  v_entered_count integer := 0;
  v_zero_count integer := 0;
  v_absent_count integer := 0;
  v_entries_count integer;
  v_distinct_workers integer;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;

  IF p_production_date IS NULL
     OR p_production_date > (now() AT TIME ZONE 'Asia/Kolkata')::date
     OR p_shift IS NULL
     OR p_shift NOT IN ('day', 'night')
     OR p_client_request_id IS NULL
     OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'A valid production date, shift, request ID, and machine sheet are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*), count(DISTINCT payload.worker_id)
  INTO v_entries_count, v_distinct_workers
  FROM jsonb_to_recordset(p_entries) AS payload(
    worker_id uuid,
    meters numeric,
    entry_status text,
    notes text,
    allocations jsonb
  );

  IF v_entries_count < 1 OR v_entries_count > 500 OR v_entries_count <> v_distinct_workers THEN
    RAISE EXCEPTION 'The daily sheet must contain one roll-up row per worker'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_entries) AS payload(
      worker_id uuid,
      meters numeric,
      entry_status text,
      notes text,
      allocations jsonb
    )
    WHERE coalesce(payload.entry_status, 'blank') NOT IN ('blank', 'entered', 'zero', 'absent')
       OR (coalesce(payload.entry_status, 'blank') = 'blank' AND payload.meters IS NOT NULL)
       OR (coalesce(payload.entry_status, 'blank') = 'entered' AND coalesce(payload.meters, 0) <= 0)
       OR (coalesce(payload.entry_status, 'blank') IN ('zero', 'absent') AND coalesce(payload.meters, 0) <> 0)
       OR (payload.allocations IS NOT NULL AND jsonb_typeof(payload.allocations) IS DISTINCT FROM 'array')
  ) THEN
    RAISE EXCEPTION 'Each worker roll-up must be blank, entered with positive metres, zero, or absent'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_entries) AS payload(
      worker_id uuid,
      meters numeric,
      entry_status text,
      notes text,
      allocations jsonb
    )
    WHERE coalesce(payload.entry_status, 'blank') <> 'blank'
  ) THEN
    RAISE EXCEPTION 'Enter production for at least one machine or mark a worker zero/absent'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':base-daily:' || p_production_date::text || ':' || p_shift, 0)
  );

  SELECT batch.*
  INTO v_batch
  FROM public.base_production_batches AS batch
  WHERE batch.org_id = v_org_id
    AND batch.client_request_id = p_client_request_id
  FOR UPDATE;

  IF v_batch.id IS NOT NULL THEN
    IF v_batch.production_date IS DISTINCT FROM p_production_date OR v_batch.shift IS DISTINCT FROM p_shift THEN
      RAISE EXCEPTION 'This request ID was already used for another production sheet'
        USING ERRCODE = '23505';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'batch_id', v_batch.id,
      'production_date', v_batch.production_date,
      'shift', v_batch.shift,
      'total_meters', COALESCE((
        SELECT SUM(COALESCE(entry.meters, 0))
        FROM public.base_daily_production_entries AS entry
        WHERE entry.org_id = v_org_id AND entry.batch_id = v_batch.id
      ), 0),
      'idempotent', true
    );
  END IF;

  SELECT batch.*
  INTO v_batch
  FROM public.base_production_batches AS batch
  WHERE batch.org_id = v_org_id
    AND batch.production_date = p_production_date
    AND batch.shift = p_shift
  FOR UPDATE;

  IF v_batch.id IS NOT NULL AND v_batch.status = 'finalized' THEN
    RAISE EXCEPTION 'This production sheet is finalized and cannot be changed'
      USING ERRCODE = '22023';
  END IF;

  FOR v_row IN
    SELECT worker_id
    FROM (
      SELECT payload.worker_id
      FROM jsonb_to_recordset(p_entries) AS payload(worker_id uuid, meters numeric, entry_status text, notes text, allocations jsonb)
      UNION
      SELECT entry.worker_id
      FROM public.base_daily_production_entries AS entry
      WHERE v_batch.id IS NOT NULL
        AND entry.org_id = v_org_id
        AND entry.batch_id = v_batch.id
    ) AS affected_workers
    ORDER BY worker_id
  LOOP
    PERFORM pg_advisory_xact_lock(
      hashtextextended(v_org_id::text || ':base-payroll:' || v_row.worker_id::text, 0)
    );
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_entries) AS payload(worker_id uuid, meters numeric, entry_status text, notes text, allocations jsonb)
    JOIN public.base_payroll_settlements AS settlement
      ON settlement.org_id = v_org_id
     AND settlement.worker_id = payload.worker_id
     AND p_production_date >= settlement.period_start
     AND p_production_date <= settlement.period_end
    UNION ALL
    SELECT 1
    FROM public.base_daily_production_entries AS entry
    JOIN public.base_payroll_settlements AS settlement
      ON settlement.org_id = entry.org_id
     AND settlement.worker_id = entry.worker_id
     AND p_production_date >= settlement.period_start
     AND p_production_date <= settlement.period_end
    WHERE v_batch.id IS NOT NULL
      AND entry.org_id = v_org_id
      AND entry.batch_id = v_batch.id
  ) THEN
    RAISE EXCEPTION 'A worker with settled pay cannot be corrected in this production sheet'
      USING ERRCODE = '22023';
  END IF;

  IF v_batch.id IS NULL THEN
    INSERT INTO public.base_production_batches (
      org_id, production_date, shift, status, client_request_id, created_by, updated_by
    )
    VALUES (
      v_org_id, p_production_date, p_shift, 'saved', p_client_request_id, auth.uid(), auth.uid()
    )
    RETURNING * INTO v_batch;
  ELSE
    UPDATE public.base_production_batches
    SET status = 'saved',
        client_request_id = p_client_request_id,
        updated_by = auth.uid(),
        updated_at = now()
    WHERE id = v_batch.id
      AND org_id = v_org_id
    RETURNING * INTO v_batch;
  END IF;

  v_batch_id := v_batch.id;

  DELETE FROM public.base_daily_production_entries
  WHERE org_id = v_org_id
    AND batch_id = v_batch_id;

  FOR v_row IN
    SELECT payload.worker_id,
           payload.meters,
           coalesce(payload.entry_status, 'blank') AS entry_status,
           NULLIF(btrim(payload.notes), '') AS notes,
           coalesce(payload.allocations, '[]'::jsonb) AS allocations
    FROM jsonb_to_recordset(p_entries) AS payload(
      worker_id uuid,
      meters numeric,
      entry_status text,
      notes text,
      allocations jsonb
    )
  LOOP
    SELECT worker.rate_per_meter
    INTO v_worker_rate
    FROM public.base_production_workers AS worker
    WHERE worker.org_id = v_org_id
      AND worker.id = v_row.worker_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Worker not found for this organization' USING ERRCODE = '23503';
    END IF;

    SELECT count(*),
           COALESCE(jsonb_agg(jsonb_build_object(
             'assignment_id', assignment.id,
             'machine_id', machine.id,
             'machine_label', COALESCE(NULLIF(machine.custom_label, ''), machine.name),
             'machine_type', machine.machine_type,
             'job_id', context.job_id,
             'job_label', context.job_label,
             'worker_rate_per_meter', COALESCE(context.worker_rate, v_worker_rate)
           ) ORDER BY machine.name, machine.id), '[]'::jsonb),
           COALESCE(MIN(COALESCE(context.worker_rate, v_worker_rate)), v_worker_rate)
    INTO v_assignment_count, v_assignment_snapshot, v_parent_rate
    FROM public.base_worker_machine_assignments AS assignment
    JOIN public.base_production_machines AS machine
      ON machine.org_id = assignment.org_id
     AND machine.id = assignment.machine_id
    LEFT JOIN LATERAL (
      SELECT job_context.job_id,
             job.quality_label AS job_label,
             COALESCE(NULLIF(job.worker_rate_per_meter, 0), v_worker_rate) AS worker_rate
      FROM public.base_machine_job_contexts AS job_context
      JOIN public.base_production_jobs AS job
        ON job.org_id = job_context.org_id
       AND job.id = job_context.job_id
      WHERE job_context.org_id = v_org_id
        AND job_context.machine_id = machine.id
        AND job_context.active IS TRUE
        AND job.status IN ('planned', 'active', 'completed')
        AND job_context.effective_from <= p_production_date
        AND (job_context.effective_to IS NULL OR job_context.effective_to >= p_production_date)
      ORDER BY job_context.effective_from DESC, job_context.created_at DESC
      LIMIT 1
    ) AS context ON true
    WHERE assignment.org_id = v_org_id
      AND assignment.worker_id = v_row.worker_id
      AND assignment.shift = p_shift
      AND assignment.active IS TRUE
      AND machine.is_active IS TRUE
      AND assignment.effective_from <= p_production_date
      AND (assignment.effective_to IS NULL OR assignment.effective_to >= p_production_date);

    SELECT count(DISTINCT round(COALESCE(context.worker_rate, v_worker_rate), 2))
    INTO v_distinct_rate_count
    FROM public.base_worker_machine_assignments AS assignment
    JOIN public.base_production_machines AS machine
      ON machine.org_id = assignment.org_id
     AND machine.id = assignment.machine_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(NULLIF(job.worker_rate_per_meter, 0), v_worker_rate) AS worker_rate
      FROM public.base_machine_job_contexts AS job_context
      JOIN public.base_production_jobs AS job
        ON job.org_id = job_context.org_id
       AND job.id = job_context.job_id
      WHERE job_context.org_id = v_org_id
        AND job_context.machine_id = machine.id
        AND job_context.active IS TRUE
        AND job.status IN ('planned', 'active', 'completed')
        AND job_context.effective_from <= p_production_date
        AND (job_context.effective_to IS NULL OR job_context.effective_to >= p_production_date)
      ORDER BY job_context.effective_from DESC, job_context.created_at DESC
      LIMIT 1
    ) AS context ON true
    WHERE assignment.org_id = v_org_id
      AND assignment.worker_id = v_row.worker_id
      AND assignment.shift = p_shift
      AND assignment.active IS TRUE
      AND machine.is_active IS TRUE
      AND assignment.effective_from <= p_production_date
      AND (assignment.effective_to IS NULL OR assignment.effective_to >= p_production_date);

    v_machine_id := NULL;
    v_job_id := NULL;
    v_machine_label := NULL;
    v_job_label := NULL;

    IF v_assignment_count = 1 THEN
      SELECT assignment.machine_id,
             context.job_id,
             COALESCE(NULLIF(machine.custom_label, ''), machine.name),
             context.job_label,
             COALESCE(context.worker_rate, v_worker_rate)
      INTO v_machine_id, v_job_id, v_machine_label, v_job_label, v_parent_rate
      FROM public.base_worker_machine_assignments AS assignment
      JOIN public.base_production_machines AS machine
        ON machine.org_id = assignment.org_id
       AND machine.id = assignment.machine_id
      LEFT JOIN LATERAL (
        SELECT job_context.job_id,
               job.quality_label AS job_label,
               COALESCE(NULLIF(job.worker_rate_per_meter, 0), v_worker_rate) AS worker_rate
        FROM public.base_machine_job_contexts AS job_context
        JOIN public.base_production_jobs AS job
          ON job.org_id = job_context.org_id
         AND job.id = job_context.job_id
        WHERE job_context.org_id = v_org_id
          AND job_context.machine_id = machine.id
          AND job_context.active IS TRUE
          AND job.status IN ('planned', 'active', 'completed')
          AND job_context.effective_from <= p_production_date
          AND (job_context.effective_to IS NULL OR job_context.effective_to >= p_production_date)
        ORDER BY job_context.effective_from DESC, job_context.created_at DESC
        LIMIT 1
      ) AS context ON true
      WHERE assignment.org_id = v_org_id
        AND assignment.worker_id = v_row.worker_id
        AND assignment.shift = p_shift
        AND assignment.active IS TRUE
        AND machine.is_active IS TRUE
        AND assignment.effective_from <= p_production_date
        AND (assignment.effective_to IS NULL OR assignment.effective_to >= p_production_date)
      LIMIT 1;
    END IF;

    v_input_allocations := v_row.allocations;
    v_resolved_allocations := '[]'::jsonb;
    v_allocation_count := jsonb_array_length(v_input_allocations);
    v_allocation_total := 0;
    v_allocation_gross := 0;

    IF v_allocation_count > 0 THEN
      IF v_row.entry_status <> 'entered' OR COALESCE(v_row.meters, 0) <= 0 THEN
        RAISE EXCEPTION 'Machine allocations require a worker row with positive production metres'
          USING ERRCODE = '22023';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(v_input_allocations) AS allocation(machine_id uuid, job_id uuid, meters numeric)
        GROUP BY allocation.machine_id, allocation.job_id
        HAVING count(*) > 1
      ) THEN
        RAISE EXCEPTION 'A machine and costing can appear only once on a production sheet'
          USING ERRCODE = '22023';
      END IF;

      FOR v_allocation_row IN
        SELECT allocation.machine_id, allocation.job_id, allocation.meters
        FROM jsonb_to_recordset(v_input_allocations) AS allocation(machine_id uuid, job_id uuid, meters numeric)
      LOOP
        IF v_allocation_row.machine_id IS NULL
           OR v_allocation_row.job_id IS NULL
           OR v_allocation_row.meters IS NULL
           OR v_allocation_row.meters <= 0 THEN
          RAISE EXCEPTION 'Each machine allocation needs a machine, costing, and positive metres'
            USING ERRCODE = '22023';
        END IF;

        v_resolved_assignment_id := NULL;
        v_resolved_rate := NULL;
        v_resolved_machine_label := NULL;
        v_resolved_job_label := NULL;
        v_resolved_snapshot := NULL;

        SELECT assignment.id,
               COALESCE(NULLIF(job.worker_rate_per_meter, 0), v_worker_rate),
               COALESCE(NULLIF(machine.custom_label, ''), machine.name),
               job.quality_label,
               jsonb_build_object(
                 'assignment_id', assignment.id,
                 'machine_id', machine.id,
                 'machine_label', COALESCE(NULLIF(machine.custom_label, ''), machine.name),
                 'job_id', job.id,
                 'job_label', job.quality_label,
                 'worker_rate_per_meter', COALESCE(NULLIF(job.worker_rate_per_meter, 0), v_worker_rate)
               )
        INTO v_resolved_assignment_id,
             v_resolved_rate,
             v_resolved_machine_label,
             v_resolved_job_label,
             v_resolved_snapshot
        FROM public.base_worker_machine_assignments AS assignment
        JOIN public.base_production_machines AS machine
          ON machine.org_id = assignment.org_id
         AND machine.id = assignment.machine_id
        JOIN public.base_machine_job_contexts AS job_context
          ON job_context.org_id = assignment.org_id
         AND job_context.machine_id = assignment.machine_id
         AND job_context.job_id = v_allocation_row.job_id
        JOIN public.base_production_jobs AS job
          ON job.org_id = job_context.org_id
         AND job.id = job_context.job_id
        WHERE assignment.org_id = v_org_id
          AND assignment.worker_id = v_row.worker_id
          AND assignment.machine_id = v_allocation_row.machine_id
          AND assignment.shift = p_shift
          AND assignment.active IS TRUE
          AND assignment.effective_from <= p_production_date
          AND (assignment.effective_to IS NULL OR assignment.effective_to >= p_production_date)
          AND machine.is_active IS TRUE
          AND job_context.active IS TRUE
          AND job_context.effective_from <= p_production_date
          AND (job_context.effective_to IS NULL OR job_context.effective_to >= p_production_date)
          AND job.status IN ('planned', 'active', 'completed')
        ORDER BY assignment.effective_from DESC, job_context.effective_from DESC, assignment.created_at DESC
        LIMIT 1;

        IF v_resolved_assignment_id IS NULL THEN
          RAISE EXCEPTION 'Machine allocation does not match this worker''s active machine/costing assignment'
            USING ERRCODE = '23503';
        END IF;

        v_allocation_total := v_allocation_total + v_allocation_row.meters;
        v_allocation_gross := v_allocation_gross + (v_allocation_row.meters * v_resolved_rate);
        v_resolved_allocations := v_resolved_allocations || jsonb_build_array(jsonb_build_object(
          'assignment_id', v_resolved_assignment_id,
          'machine_id', v_allocation_row.machine_id,
          'job_id', v_allocation_row.job_id,
          'meters', v_allocation_row.meters,
          'worker_rate_snapshot', v_resolved_rate,
          'machine_label', v_resolved_machine_label,
          'job_label', v_resolved_job_label,
          'assignment_snapshot', v_resolved_snapshot
        ));
      END LOOP;

      IF abs(v_allocation_total - v_row.meters) > 0.005 THEN
        RAISE EXCEPTION 'Machine allocation total (%) must equal the worker total (%)', round(v_allocation_total, 2), round(v_row.meters, 2)
          USING ERRCODE = '22023';
      END IF;

      v_machine_id := NULL;
      v_job_id := NULL;
      v_machine_label := NULL;
      v_job_label := NULL;
      v_parent_rate := round(v_allocation_gross / v_row.meters, 2);
    ELSIF v_row.entry_status = 'entered'
          AND v_assignment_count > 1
          AND v_distinct_rate_count > 1 THEN
      RAISE EXCEPTION 'This worker has different rates across machines. Enter metres for each machine before saving.'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.base_daily_production_entries (
      org_id,
      batch_id,
      worker_id,
      entry_status,
      meters,
      worker_rate_snapshot,
      machine_id,
      job_id,
      machine_label,
      job_label,
      assignment_snapshot,
      allocation_mode,
      notes,
      created_by
    )
    VALUES (
      v_org_id,
      v_batch_id,
      v_row.worker_id,
      v_row.entry_status,
      v_row.meters,
      COALESCE(v_parent_rate, v_worker_rate),
      v_machine_id,
      v_job_id,
      v_machine_label,
      v_job_label,
      v_assignment_snapshot,
      CASE WHEN v_allocation_count > 0 THEN 'machine_breakdown' ELSE 'worker_total' END,
      v_row.notes,
      auth.uid()
    )
    RETURNING id INTO v_entry_id;

    IF v_allocation_count > 0 THEN
      FOR v_allocation_row IN
        SELECT allocation.assignment_id,
               allocation.machine_id,
               allocation.job_id,
               allocation.meters,
               allocation.worker_rate_snapshot,
               allocation.machine_label,
               allocation.job_label,
               allocation.assignment_snapshot
        FROM jsonb_to_recordset(v_resolved_allocations) AS allocation(
          assignment_id uuid,
          machine_id uuid,
          job_id uuid,
          meters numeric,
          worker_rate_snapshot numeric,
          machine_label text,
          job_label text,
          assignment_snapshot jsonb
        )
      LOOP
        INSERT INTO public.base_daily_production_allocations (
          org_id,
          entry_id,
          worker_id,
          assignment_id,
          machine_id,
          job_id,
          meters,
          worker_rate_snapshot,
          machine_label,
          job_label,
          assignment_snapshot,
          created_by
        )
        VALUES (
          v_org_id,
          v_entry_id,
          v_row.worker_id,
          v_allocation_row.assignment_id,
          v_allocation_row.machine_id,
          v_allocation_row.job_id,
          v_allocation_row.meters,
          v_allocation_row.worker_rate_snapshot,
          v_allocation_row.machine_label,
          v_allocation_row.job_label,
          v_allocation_row.assignment_snapshot,
          auth.uid()
        );
      END LOOP;
    END IF;

    v_batch_total_meters := v_batch_total_meters + COALESCE(v_row.meters, 0);
    IF v_row.entry_status = 'entered' THEN v_entered_count := v_entered_count + 1; END IF;
    IF v_row.entry_status = 'zero' THEN v_zero_count := v_zero_count + 1; END IF;
    IF v_row.entry_status = 'absent' THEN v_absent_count := v_absent_count + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'production_date', p_production_date,
    'shift', p_shift,
    'total_meters', round(v_batch_total_meters, 2),
    'entered_count', v_entered_count,
    'zero_count', v_zero_count,
    'absent_count', v_absent_count,
    'idempotent', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_base_worker_payroll(
  p_worker_id uuid,
  p_period_end date,
  p_payment_mode text DEFAULT 'cash'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_period_start date;
  v_existing public.base_payroll_settlements%ROWTYPE;
  v_worker_exists boolean;
  v_gross numeric := 0;
  v_total_pending_advances numeric := 0;
  v_max_deduction numeric := 0;
  v_actual_deduction numeric := 0;
  v_budget numeric := 0;
  v_remaining_debt numeric := 0;
  v_settlement_id uuid;
  v_advance record;
  v_recover_now numeric;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;

  IF p_worker_id IS NULL OR p_period_end IS NULL
     OR p_period_end > (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RAISE EXCEPTION 'A valid payroll period is required' USING ERRCODE = '22023';
  END IF;

  IF p_payment_mode IS NULL OR p_payment_mode NOT IN ('cash', 'bank_transfer', 'upi', 'cheque') THEN
    RAISE EXCEPTION 'A valid payment mode is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':base-payroll:' || p_worker_id::text, 0)
  );

  SELECT EXISTS (
    SELECT 1
    FROM public.base_production_workers AS worker
    WHERE worker.org_id = v_org_id AND worker.id = p_worker_id
  ) INTO v_worker_exists;

  IF NOT v_worker_exists THEN
    RAISE EXCEPTION 'Worker not found' USING ERRCODE = '23503';
  END IF;

  SELECT settlement.*
  INTO v_existing
  FROM public.base_payroll_settlements AS settlement
  WHERE settlement.org_id = v_org_id
    AND settlement.worker_id = p_worker_id
    AND settlement.period_end = p_period_end
  ORDER BY settlement.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'settlement_id', v_existing.id,
      'period_start', v_existing.period_start,
      'period_end', v_existing.period_end,
      'gross_pay', v_existing.gross_pay,
      'advance_deducted', v_existing.advance_deducted,
      'net_payout', v_existing.net_payout,
      'payment_mode', v_existing.payment_mode,
      'idempotent', true
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.base_payroll_settlements AS settlement
    WHERE settlement.org_id = v_org_id
      AND settlement.worker_id = p_worker_id
      AND settlement.period_end > p_period_end
  ) THEN
    RAISE EXCEPTION 'Payroll period must move forward' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE((MAX(settlement.period_end) + 1)::date, date_trunc('month', p_period_end)::date)
  INTO v_period_start
  FROM public.base_payroll_settlements AS settlement
  WHERE settlement.org_id = v_org_id
    AND settlement.worker_id = p_worker_id
    AND settlement.period_end < p_period_end;

  SELECT COALESCE(SUM(source.gross_pay), 0)
  INTO v_gross
  FROM (
    SELECT entry.meters * entry.worker_rate_snapshot AS gross_pay, entry.production_date
    FROM public.base_production_entries AS entry
    WHERE entry.org_id = v_org_id AND entry.worker_id = p_worker_id
    UNION ALL
    SELECT CASE
             WHEN daily.allocation_mode = 'machine_breakdown' THEN COALESCE((
               SELECT SUM(allocation.meters * allocation.worker_rate_snapshot)
               FROM public.base_daily_production_allocations AS allocation
               WHERE allocation.org_id = daily.org_id
                 AND allocation.entry_id = daily.id
             ), 0)
             ELSE daily.meters * daily.worker_rate_snapshot
           END AS gross_pay,
           batch.production_date
    FROM public.base_daily_production_entries AS daily
    JOIN public.base_production_batches AS batch
      ON batch.org_id = daily.org_id AND batch.id = daily.batch_id
    WHERE daily.org_id = v_org_id
      AND daily.worker_id = p_worker_id
      AND daily.entry_status = 'entered'
  ) AS source
  WHERE source.production_date >= v_period_start
    AND source.production_date <= p_period_end;

  SELECT COALESCE(SUM(GREATEST(advance.amount - advance.recovered_amount, 0)), 0)
  INTO v_total_pending_advances
  FROM public.base_worker_advances AS advance
  WHERE advance.org_id = v_org_id
    AND advance.worker_id = p_worker_id
    AND advance.status = 'pending'
    AND advance.recovered_amount < advance.amount;

  IF v_gross <= 0 THEN
    RAISE EXCEPTION 'There is no recorded production to settle for this period' USING ERRCODE = '22023';
  END IF;

  v_gross := round(v_gross, 2);
  v_max_deduction := round(v_gross * 0.5, 2);
  v_actual_deduction := round(LEAST(v_total_pending_advances, v_max_deduction), 2);
  v_budget := v_actual_deduction;

  INSERT INTO public.base_payroll_settlements (
    org_id, worker_id, period_start, period_end, gross_pay, advance_deducted, net_payout, payment_mode, created_by
  )
  VALUES (
    v_org_id, p_worker_id, v_period_start, p_period_end, round(v_gross, 2),
    round(v_actual_deduction, 2), round(GREATEST(v_gross - v_actual_deduction, 0), 2), p_payment_mode, auth.uid()
  )
  RETURNING id INTO v_settlement_id;

  FOR v_advance IN
    SELECT advance.id, advance.amount, advance.recovered_amount
    FROM public.base_worker_advances AS advance
    WHERE advance.org_id = v_org_id
      AND advance.worker_id = p_worker_id
      AND advance.status = 'pending'
      AND advance.recovered_amount < advance.amount
    ORDER BY advance.created_at ASC, advance.id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_budget <= 0;
    v_recover_now := LEAST(v_budget, GREATEST(v_advance.amount - v_advance.recovered_amount, 0));

    UPDATE public.base_worker_advances
    SET recovered_amount = recovered_amount + v_recover_now,
        status = CASE WHEN recovered_amount + v_recover_now >= amount THEN 'deducted' ELSE 'pending' END,
        recovered_at = now(),
        last_recovered_period_end = p_period_end
    WHERE id = v_advance.id AND org_id = v_org_id;

    v_budget := v_budget - v_recover_now;
  END LOOP;

  SELECT COALESCE(SUM(GREATEST(advance.amount - advance.recovered_amount, 0)), 0)
  INTO v_remaining_debt
  FROM public.base_worker_advances AS advance
  WHERE advance.org_id = v_org_id
    AND advance.worker_id = p_worker_id
    AND advance.status = 'pending';

  RETURN jsonb_build_object(
    'settlement_id', v_settlement_id,
    'period_start', v_period_start,
    'period_end', p_period_end,
    'gross_pay', round(v_gross, 2),
    'advance_deducted', round(v_actual_deduction, 2),
    'net_payout', round(GREATEST(v_gross - v_actual_deduction, 0), 2),
    'remaining_debt', round(v_remaining_debt, 2),
    'payment_mode', p_payment_mode,
    'idempotent', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_base_daily_production(date, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_base_daily_production(date, text, uuid, jsonb)
  TO authenticated;

REVOKE ALL ON FUNCTION public.settle_base_worker_payroll(uuid, date, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_base_worker_payroll(uuid, date, text)
  TO authenticated;

COMMENT ON TABLE public.base_daily_production_allocations IS
  'Machine-first Base production rows with worker, costing, and rate snapshots used for payroll.';
COMMENT ON COLUMN public.base_daily_production_entries.allocation_mode IS
  'worker_total for legacy/unallocated rows; machine_breakdown when child machine rows are the payroll source.';
