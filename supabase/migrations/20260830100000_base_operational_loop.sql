-- Base Operational Loop
--
-- This migration adds the smallest durable model for the owner-run Base
-- workflow. Base machines intentionally have their own identity: the Full
-- Suite machines table has order and shift activation rules that are not
-- appropriate for contextual Base setup.

CREATE TABLE public.base_production_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  machine_type text NOT NULL DEFAULT 'other' CHECK (
    machine_type IN ('jacquard', 'power_loom', 'rapier', 'water_jet', 'air_jet', 'circular', 'other')
  ),
  custom_label text CHECK (custom_label IS NULL OR char_length(btrim(custom_label)) <= 80),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id)
);

CREATE INDEX base_production_machines_org_active_idx
  ON public.base_production_machines(org_id, is_active, name);
CREATE UNIQUE INDEX base_production_machines_org_name_unique
  ON public.base_production_machines(org_id, lower(btrim(name)));

CREATE TABLE public.base_worker_machine_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL,
  machine_id uuid NOT NULL,
  shift text NOT NULL DEFAULT 'day' CHECK (shift IN ('day', 'night')),
  active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  CONSTRAINT base_worker_machine_assignments_worker_same_org_fkey
    FOREIGN KEY (org_id, worker_id)
    REFERENCES public.base_production_workers(org_id, id)
    ON DELETE CASCADE,
  CONSTRAINT base_worker_machine_assignments_machine_same_org_fkey
    FOREIGN KEY (org_id, machine_id)
    REFERENCES public.base_production_machines(org_id, id)
    ON DELETE CASCADE,
  CONSTRAINT base_worker_machine_assignments_dates_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX base_worker_machine_assignments_org_worker_idx
  ON public.base_worker_machine_assignments(org_id, worker_id, shift, active, effective_from DESC);
CREATE INDEX base_worker_machine_assignments_org_machine_idx
  ON public.base_worker_machine_assignments(org_id, machine_id, shift, active, effective_from DESC);
CREATE UNIQUE INDEX base_worker_machine_assignments_one_current_machine_shift
  ON public.base_worker_machine_assignments(org_id, machine_id, shift)
  WHERE active IS TRUE AND effective_to IS NULL;
CREATE UNIQUE INDEX base_worker_machine_assignments_one_current_worker_machine_shift
  ON public.base_worker_machine_assignments(org_id, worker_id, machine_id, shift)
  WHERE active IS TRUE AND effective_to IS NULL;

CREATE TABLE public.base_machine_job_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL,
  job_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  CONSTRAINT base_machine_job_contexts_machine_same_org_fkey
    FOREIGN KEY (org_id, machine_id)
    REFERENCES public.base_production_machines(org_id, id)
    ON DELETE CASCADE,
  CONSTRAINT base_machine_job_contexts_job_same_org_fkey
    FOREIGN KEY (org_id, job_id)
    REFERENCES public.base_production_jobs(org_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT base_machine_job_contexts_dates_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX base_machine_job_contexts_org_machine_date_idx
  ON public.base_machine_job_contexts(org_id, machine_id, effective_from DESC);
CREATE UNIQUE INDEX base_machine_job_contexts_one_current_machine
  ON public.base_machine_job_contexts(org_id, machine_id)
  WHERE active IS TRUE AND effective_to IS NULL;

CREATE TABLE public.base_production_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  production_date date NOT NULL,
  shift text NOT NULL DEFAULT 'day' CHECK (shift IN ('day', 'night')),
  status text NOT NULL DEFAULT 'saved' CHECK (status IN ('draft', 'saved', 'finalized')),
  client_request_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  UNIQUE (org_id, production_date, shift),
  UNIQUE (org_id, client_request_id)
);

CREATE INDEX base_production_batches_org_date_idx
  ON public.base_production_batches(org_id, production_date DESC, shift);

CREATE TABLE public.base_daily_production_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  entry_status text NOT NULL DEFAULT 'blank' CHECK (entry_status IN ('blank', 'entered', 'zero', 'absent')),
  meters numeric(14,2),
  worker_rate_snapshot numeric(12,2) NOT NULL CHECK (
    worker_rate_snapshot >= 0
    AND worker_rate_snapshot NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  machine_id uuid,
  job_id uuid,
  machine_label text,
  job_label text,
  assignment_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(assignment_snapshot) = 'array'),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  UNIQUE (batch_id, worker_id),
  CONSTRAINT base_daily_production_entries_batch_same_org_fkey
    FOREIGN KEY (org_id, batch_id)
    REFERENCES public.base_production_batches(org_id, id)
    ON DELETE CASCADE,
  CONSTRAINT base_daily_production_entries_worker_same_org_fkey
    FOREIGN KEY (org_id, worker_id)
    REFERENCES public.base_production_workers(org_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT base_daily_production_entries_machine_same_org_fkey
    FOREIGN KEY (org_id, machine_id)
    REFERENCES public.base_production_machines(org_id, id)
    ON DELETE SET NULL,
  CONSTRAINT base_daily_production_entries_job_same_org_fkey
    FOREIGN KEY (org_id, job_id)
    REFERENCES public.base_production_jobs(org_id, id)
    ON DELETE SET NULL,
  CONSTRAINT base_daily_production_entries_meters_check
    CHECK (
      meters IS NULL
      OR (
        meters >= 0
        AND meters NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
      )
    ),
  CONSTRAINT base_daily_production_entries_status_meters_check
    CHECK (
      (entry_status = 'blank' AND meters IS NULL)
      OR (entry_status = 'entered' AND meters IS NOT NULL AND meters > 0)
      OR (entry_status IN ('zero', 'absent') AND meters = 0)
    )
);

CREATE INDEX base_daily_production_entries_org_worker_date_idx
  ON public.base_daily_production_entries(org_id, worker_id, batch_id);
CREATE INDEX base_daily_production_entries_org_job_idx
  ON public.base_daily_production_entries(org_id, job_id)
  WHERE job_id IS NOT NULL;

ALTER TABLE public.base_production_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_worker_machine_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_machine_job_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_daily_production_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.base_production_machines,
  public.base_worker_machine_assignments,
  public.base_machine_job_contexts,
  public.base_production_batches,
  public.base_daily_production_entries
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_production_machines TO authenticated;
GRANT SELECT ON public.base_worker_machine_assignments TO authenticated;
GRANT SELECT ON public.base_machine_job_contexts TO authenticated;
GRANT SELECT ON public.base_production_batches TO authenticated;
GRANT SELECT ON public.base_daily_production_entries TO authenticated;

CREATE POLICY base_production_machines_owner_access
  ON public.base_production_machines
  FOR ALL TO authenticated
  USING (private.base_production_core_access(org_id))
  WITH CHECK (private.base_production_core_access(org_id));

CREATE POLICY base_worker_machine_assignments_owner_access
  ON public.base_worker_machine_assignments
  FOR ALL TO authenticated
  USING (private.base_production_core_access(org_id))
  WITH CHECK (private.base_production_core_access(org_id));

CREATE POLICY base_machine_job_contexts_owner_read
  ON public.base_machine_job_contexts
  FOR SELECT TO authenticated
  USING (private.base_production_core_access(org_id));

CREATE POLICY base_production_batches_owner_read
  ON public.base_production_batches
  FOR SELECT TO authenticated
  USING (private.base_production_core_access(org_id));

CREATE POLICY base_daily_production_entries_owner_read
  ON public.base_daily_production_entries
  FOR SELECT TO authenticated
  USING (private.base_production_core_access(org_id));

-- Assignment writes are serialized per machine so the one-primary-worker
-- rule is deterministic even when two owner tabs save at the same time.
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

CREATE OR REPLACE FUNCTION public.delete_base_worker_machine_assignment(
  p_assignment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT profile.org_id
  INTO v_org_id
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
    AND profile.role::text = 'owner';

  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.base_worker_machine_assignments
  SET active = false,
      effective_to = GREATEST(effective_from, (now() AT TIME ZONE 'Asia/Kolkata')::date - 1),
      updated_by = auth.uid(),
      updated_at = now()
  WHERE org_id = v_org_id
    AND id = p_assignment_id
    AND active IS TRUE;

  RETURN jsonb_build_object('success', true, 'removed', FOUND);
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_base_worker_machine_assignment(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_base_worker_machine_assignment(uuid)
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
    hashtextextended(v_org_id::text || ':base-machine-job:' || p_machine_id::text, 0)
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

-- Save a complete owner sheet in one transaction. The client sends only
-- worker values/statuses; machine/job context and rate snapshots are derived
-- here from the tenant-scoped records visible on the save date.
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
  v_worker_rate numeric;
  v_assignment_count integer;
  v_assignment_snapshot jsonb;
  v_machine_ids uuid[];
  v_job_ids uuid[];
  v_machine_labels text[];
  v_job_labels text[];
  v_machine_id uuid;
  v_job_id uuid;
  v_machine_label text;
  v_job_label text;
  v_batch_id uuid;
  v_total_meters numeric := 0;
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

  IF p_production_date IS NULL OR p_production_date > (now() AT TIME ZONE 'Asia/Kolkata')::date
     OR p_shift IS NULL OR p_shift NOT IN ('day', 'night') OR p_client_request_id IS NULL
     OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'A valid production date, shift, request ID, and worker sheet are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*), count(DISTINCT payload.worker_id)
  INTO v_entries_count, v_distinct_workers
  FROM jsonb_to_recordset(p_entries) AS payload(
    worker_id uuid,
    meters numeric,
    entry_status text,
    notes text
  );

  IF v_entries_count < 1 OR v_entries_count > 500 OR v_entries_count <> v_distinct_workers THEN
    RAISE EXCEPTION 'The daily sheet must contain one row per worker'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_entries) AS payload(worker_id uuid, meters numeric, entry_status text, notes text)
    WHERE coalesce(payload.entry_status, 'blank') NOT IN ('blank', 'entered', 'zero', 'absent')
       OR (coalesce(payload.entry_status, 'blank') = 'blank' AND payload.meters IS NOT NULL)
       OR (coalesce(payload.entry_status, 'blank') = 'entered' AND coalesce(payload.meters, 0) <= 0)
       OR (coalesce(payload.entry_status, 'blank') IN ('zero', 'absent') AND coalesce(payload.meters, 0) <> 0)
  ) THEN
    RAISE EXCEPTION 'Each worker row must be blank, entered with positive metres, zero, or absent'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_entries) AS payload(worker_id uuid, meters numeric, entry_status text, notes text)
    WHERE coalesce(payload.entry_status, 'blank') <> 'blank'
  ) THEN
    RAISE EXCEPTION 'Enter production for at least one worker or mark a row zero/absent'
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

  -- Serialize this sheet with payroll settlement for every worker it can
  -- affect, including workers already present in a correction target.
  FOR v_row IN
    SELECT worker_id
    FROM (
      SELECT payload.worker_id
      FROM jsonb_to_recordset(p_entries) AS payload(worker_id uuid, meters numeric, entry_status text, notes text)
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
    FROM jsonb_to_recordset(p_entries) AS payload(worker_id uuid, meters numeric, entry_status text, notes text)
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
           NULLIF(btrim(payload.notes), '') AS notes
    FROM jsonb_to_recordset(p_entries) AS payload(
      worker_id uuid,
      meters numeric,
      entry_status text,
      notes text
    )
  LOOP
    SELECT worker.rate_per_meter
    INTO v_worker_rate
    FROM public.base_production_workers AS worker
    WHERE worker.org_id = v_org_id
      AND worker.id = v_row.worker_id;

    IF v_worker_rate IS NULL THEN
      RAISE EXCEPTION 'Worker not found for this organization' USING ERRCODE = '23503';
    END IF;

    SELECT count(*),
           COALESCE(jsonb_agg(jsonb_build_object(
             'assignment_id', assignment.id,
             'machine_id', machine.id,
             'machine_label', COALESCE(NULLIF(machine.custom_label, ''), machine.name),
             'machine_type', machine.machine_type,
             'job_id', context.job_id,
             'job_label', context.job_label
           ) ORDER BY machine.name, machine.id), '[]'::jsonb),
           array_agg(machine.id ORDER BY machine.name, machine.id),
           array_agg(context.job_id ORDER BY machine.name, machine.id),
           array_agg(COALESCE(NULLIF(machine.custom_label, ''), machine.name) ORDER BY machine.name, machine.id),
           array_agg(context.job_label ORDER BY machine.name, machine.id)
    INTO v_assignment_count,
         v_assignment_snapshot,
         v_machine_ids,
         v_job_ids,
         v_machine_labels,
         v_job_labels
    FROM public.base_worker_machine_assignments AS assignment
    JOIN public.base_production_machines AS machine
      ON machine.org_id = assignment.org_id
     AND machine.id = assignment.machine_id
    LEFT JOIN LATERAL (
      SELECT job_context.job_id, job.quality_label AS job_label
      FROM public.base_machine_job_contexts AS job_context
      JOIN public.base_production_jobs AS job
        ON job.org_id = job_context.org_id
       AND job.id = job_context.job_id
      WHERE job_context.org_id = v_org_id
        AND job_context.machine_id = machine.id
        AND job_context.active IS TRUE
        AND job.status IN ('planned', 'active')
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
      v_machine_id := v_machine_ids[1];
      v_job_id := v_job_ids[1];
      v_machine_label := v_machine_labels[1];
      v_job_label := v_job_labels[1];
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
      notes,
      created_by
    )
    VALUES (
      v_org_id,
      v_batch_id,
      v_row.worker_id,
      v_row.entry_status,
      v_row.meters,
      v_worker_rate,
      v_machine_id,
      v_job_id,
      v_machine_label,
      v_job_label,
      v_assignment_snapshot,
      v_row.notes,
      auth.uid()
    );

    v_total_meters := v_total_meters + COALESCE(v_row.meters, 0);
    IF v_row.entry_status = 'entered' THEN v_entered_count := v_entered_count + 1; END IF;
    IF v_row.entry_status = 'zero' THEN v_zero_count := v_zero_count + 1; END IF;
    IF v_row.entry_status = 'absent' THEN v_absent_count := v_absent_count + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'production_date', p_production_date,
    'shift', p_shift,
    'total_meters', round(v_total_meters, 2),
    'entered_count', v_entered_count,
    'zero_count', v_zero_count,
    'absent_count', v_absent_count,
    'idempotent', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_base_daily_production(date, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_base_daily_production(date, text, uuid, jsonb)
  TO authenticated;

-- Extend Base payroll to include the new daily sheet rows. Legacy one-row
-- entries remain in their original table and are intentionally unioned rather
-- than backfilled into the batch model, preventing double counting.
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

  SELECT COALESCE(SUM(source.meters * source.worker_rate_snapshot), 0)
  INTO v_gross
  FROM (
    SELECT entry.meters, entry.worker_rate_snapshot, entry.production_date
    FROM public.base_production_entries AS entry
    WHERE entry.org_id = v_org_id AND entry.worker_id = p_worker_id
    UNION ALL
    SELECT daily.meters, daily.worker_rate_snapshot, batch.production_date
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

REVOKE ALL ON FUNCTION public.settle_base_worker_payroll(uuid, date, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_base_worker_payroll(uuid, date, text)
  TO authenticated;

COMMENT ON TABLE public.base_production_machines IS
  'Minimal Base-plan machine context. Deliberately separate from Full Suite machines.';
COMMENT ON TABLE public.base_worker_machine_assignments IS
  'Owner-maintained Base worker-to-machine context; one current primary worker per machine and shift.';
COMMENT ON TABLE public.base_machine_job_contexts IS
  'Dated Base machine-to-job context used as read-only production-entry context.';
COMMENT ON TABLE public.base_production_batches IS
  'One owner-entered Base daily or shift production sheet with idempotent save identity.';
COMMENT ON TABLE public.base_daily_production_entries IS
  'Worker-level Base production rows with rate, assignment, and machine/job context snapshots.';
