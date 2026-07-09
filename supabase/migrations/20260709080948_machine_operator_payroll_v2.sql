-- Machine Operator Payroll v2
--
-- Backward-compatible additions:
-- - Preserve workers/fixed_workers split.
-- - Add machine-type-aware operator assignments with effective dates.
-- - Snapshot assignment/pay-mode/rate/machine-type context on production logs.
-- - Keep legacy production_logs.worker_id for existing meter-worker payroll.

CREATE TABLE IF NOT EXISTS public.machine_type_pay_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  machine_type TEXT NOT NULL CHECK (machine_type IN ('jacquard', 'power_loom', 'rapier', 'water_jet', 'other')),
  default_pay_mode TEXT NOT NULL CHECK (default_pay_mode IN ('per_meter', 'fixed_monthly', 'fixed_daily', 'fixed_shift')),
  default_rate NUMERIC NOT NULL DEFAULT 0 CHECK (default_rate >= 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT machine_type_pay_defaults_effective_range
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_machine_type_pay_defaults_org_type_active
  ON public.machine_type_pay_defaults(org_id, machine_type, active, effective_from DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_machine_type_pay_defaults_one_current
  ON public.machine_type_pay_defaults(org_id, machine_type)
  WHERE active IS TRUE AND effective_to IS NULL;

ALTER TABLE public.machine_type_pay_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "machine_type_pay_defaults_select_org" ON public.machine_type_pay_defaults;
CREATE POLICY "machine_type_pay_defaults_select_org"
  ON public.machine_type_pay_defaults
  FOR SELECT TO authenticated
  USING (org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid);

DROP POLICY IF EXISTS "machine_type_pay_defaults_owner_manage" ON public.machine_type_pay_defaults;
CREATE POLICY "machine_type_pay_defaults_owner_manage"
  ON public.machine_type_pay_defaults
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_type_pay_defaults TO authenticated;

CREATE TABLE IF NOT EXISTS public.machine_operator_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  worker_type TEXT NOT NULL CHECK (worker_type IN ('meter_worker', 'fixed_worker')),
  meter_worker_id BIGINT REFERENCES public.workers(id) ON DELETE RESTRICT,
  fixed_worker_id BIGINT REFERENCES public.fixed_workers(id) ON DELETE RESTRICT,
  machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE NOT NULL,
  machine_type TEXT NOT NULL CHECK (machine_type IN ('jacquard', 'power_loom', 'rapier', 'water_jet', 'other')),
  shift TEXT NOT NULL CHECK (shift IN ('day', 'night')),
  pay_mode TEXT NOT NULL CHECK (pay_mode IN ('per_meter', 'fixed_monthly', 'fixed_daily', 'fixed_shift')),
  rate NUMERIC NOT NULL CHECK (rate >= 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_primary_operator BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT machine_operator_assignments_exactly_one_worker CHECK (
    (
      worker_type = 'meter_worker'
      AND meter_worker_id IS NOT NULL
      AND fixed_worker_id IS NULL
    )
    OR (
      worker_type = 'fixed_worker'
      AND fixed_worker_id IS NOT NULL
      AND meter_worker_id IS NULL
    )
  ),
  CONSTRAINT machine_operator_assignments_pay_mode_matches_worker_type CHECK (
    (worker_type = 'meter_worker' AND pay_mode = 'per_meter')
    OR (worker_type = 'fixed_worker' AND pay_mode IN ('fixed_monthly', 'fixed_daily', 'fixed_shift'))
  ),
  CONSTRAINT machine_operator_assignments_effective_range
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_machine_operator_assignments_org_machine_shift
  ON public.machine_operator_assignments(org_id, machine_id, shift, active, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_machine_operator_assignments_meter_worker
  ON public.machine_operator_assignments(org_id, meter_worker_id, active, effective_from DESC)
  WHERE meter_worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_machine_operator_assignments_fixed_worker
  ON public.machine_operator_assignments(org_id, fixed_worker_id, active, effective_from DESC)
  WHERE fixed_worker_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_machine_operator_assignments_one_current_primary
  ON public.machine_operator_assignments(org_id, machine_id, shift)
  WHERE active IS TRUE AND is_primary_operator IS TRUE AND effective_to IS NULL;

ALTER TABLE public.machine_operator_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "machine_operator_assignments_select_org" ON public.machine_operator_assignments;
CREATE POLICY "machine_operator_assignments_select_org"
  ON public.machine_operator_assignments
  FOR SELECT TO authenticated
  USING (org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid);

DROP POLICY IF EXISTS "machine_operator_assignments_owner_manage" ON public.machine_operator_assignments;
CREATE POLICY "machine_operator_assignments_owner_manage"
  ON public.machine_operator_assignments
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_operator_assignments TO authenticated;

DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL
     AND to_regprocedure('public.log_audit_event()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger WHERE tgname = 'audit_machine_operator_assignments'
     ) THEN
    CREATE TRIGGER audit_machine_operator_assignments
      AFTER INSERT OR UPDATE OR DELETE ON public.machine_operator_assignments
      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
  END IF;
END $$;

INSERT INTO public.machine_type_pay_defaults (org_id, machine_type, default_pay_mode, default_rate)
SELECT o.id, defaults.machine_type, defaults.default_pay_mode, 0
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('jacquard', 'per_meter'),
    ('power_loom', 'per_meter'),
    ('rapier', 'fixed_monthly'),
    ('water_jet', 'fixed_monthly'),
    ('other', 'fixed_monthly')
) AS defaults(machine_type, default_pay_mode)
ON CONFLICT DO NOTHING;

ALTER TABLE public.production_logs
  ADD COLUMN IF NOT EXISTS operator_assignment_id UUID REFERENCES public.machine_operator_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operator_worker_type TEXT CHECK (operator_worker_type IS NULL OR operator_worker_type IN ('meter_worker', 'fixed_worker')),
  ADD COLUMN IF NOT EXISTS meter_worker_id BIGINT REFERENCES public.workers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fixed_worker_id BIGINT REFERENCES public.fixed_workers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operator_pay_mode_snapshot TEXT CHECK (
    operator_pay_mode_snapshot IS NULL
    OR operator_pay_mode_snapshot IN ('per_meter', 'fixed_monthly', 'fixed_daily', 'fixed_shift')
  ),
  ADD COLUMN IF NOT EXISTS operator_rate_snapshot NUMERIC CHECK (operator_rate_snapshot IS NULL OR operator_rate_snapshot >= 0),
  ADD COLUMN IF NOT EXISTS machine_type_snapshot TEXT CHECK (
    machine_type_snapshot IS NULL
    OR machine_type_snapshot IN ('jacquard', 'power_loom', 'rapier', 'water_jet', 'other')
  );

CREATE INDEX IF NOT EXISTS idx_production_logs_operator_assignment_cycle
  ON public.production_logs(org_id, operator_assignment_id, date, shift)
  WHERE operator_assignment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_production_logs_meter_worker_cycle
  ON public.production_logs(org_id, meter_worker_id, date)
  WHERE meter_worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_production_logs_fixed_worker_cycle
  ON public.production_logs(org_id, fixed_worker_id, date)
  WHERE fixed_worker_id IS NOT NULL;

UPDATE public.production_logs
SET
  operator_worker_type = COALESCE(operator_worker_type, 'meter_worker'),
  meter_worker_id = COALESCE(meter_worker_id, worker_id),
  operator_pay_mode_snapshot = COALESCE(operator_pay_mode_snapshot, 'per_meter'),
  operator_rate_snapshot = COALESCE(operator_rate_snapshot, worker_rate_snapshot),
  machine_type_snapshot = COALESCE(machine_type_snapshot, 'other')
WHERE worker_id IS NOT NULL
  AND operator_assignment_id IS NULL;

CREATE OR REPLACE FUNCTION public.calculate_operator_payroll_gross(
  p_org_id UUID,
  p_worker_type TEXT,
  p_worker_id BIGINT,
  p_cycle_start DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle_end DATE := (p_cycle_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_total NUMERIC := 0;
  v_component NUMERIC := 0;
  v_attendance_days INT := 0;
  v_fixed_role TEXT;
  v_monthly_salary NUMERIC := 0;
  v_has_machine_operator_context BOOLEAN := FALSE;
BEGIN
  IF p_org_id IS NULL OR p_worker_id IS NULL OR p_cycle_start IS NULL THEN
    RAISE EXCEPTION 'payroll calculation requires org, worker, and cycle start'
      USING ERRCODE = '23514';
  END IF;

  IF p_worker_type NOT IN ('meter', 'fixed') THEN
    RAISE EXCEPTION 'invalid worker_type'
      USING ERRCODE = '23514';
  END IF;

  IF p_worker_type = 'meter' THEN
    SELECT COALESCE(SUM(
      CASE
        WHEN COALESCE(pl.operator_pay_mode_snapshot, 'per_meter') = 'per_meter'
          THEN GREATEST(COALESCE(pl.meters, 0), 0)
               * GREATEST(COALESCE(pl.operator_rate_snapshot, pl.worker_rate_snapshot, 0), 0)
        ELSE 0
      END
    ), 0)
    INTO v_total
    FROM public.production_logs pl
    WHERE pl.org_id = p_org_id
      AND pl.date >= p_cycle_start
      AND pl.date <= v_cycle_end
      AND COALESCE(pl.meters, 0) > 0
      AND (
        pl.meter_worker_id = p_worker_id
        OR (
          pl.operator_assignment_id IS NULL
          AND pl.worker_id = p_worker_id
        )
      );

    RETURN COALESCE(v_total, 0);
  END IF;

  SELECT fw.role, COALESCE(fw.monthly_salary, 0)
  INTO v_fixed_role, v_monthly_salary
  FROM public.fixed_workers fw
  WHERE fw.org_id = p_org_id
    AND fw.id = p_worker_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker not found for this organization.'
      USING ERRCODE = '23503';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.machine_operator_assignments moa
    WHERE moa.org_id = p_org_id
      AND moa.fixed_worker_id = p_worker_id
      AND moa.effective_from <= v_cycle_end
      AND (moa.effective_to IS NULL OR moa.effective_to >= p_cycle_start)
    UNION ALL
    SELECT 1
    FROM public.production_logs pl
    WHERE pl.org_id = p_org_id
      AND pl.fixed_worker_id = p_worker_id
      AND pl.date >= p_cycle_start
      AND pl.date <= v_cycle_end
  )
  INTO v_has_machine_operator_context;

  IF NOT v_has_machine_operator_context THEN
    IF v_fixed_role = 'daily' THEN
      SELECT COUNT(*)
      INTO v_attendance_days
      FROM public.attendance a
      WHERE a.org_id = p_org_id
        AND a.fixed_worker_id = p_worker_id
        AND a.date >= p_cycle_start
        AND a.date <= v_cycle_end
        AND COALESCE(a.present, false) IS TRUE;

      RETURN LEAST(v_monthly_salary, (v_monthly_salary / 30) * COALESCE(v_attendance_days, 0));
    END IF;

    RETURN v_monthly_salary;
  END IF;

  -- Fixed monthly machine operators: assignment rate is the monthly salary snapshot.
  SELECT COALESCE(MAX(moa.rate), 0)
  INTO v_component
  FROM public.machine_operator_assignments moa
  WHERE moa.org_id = p_org_id
    AND moa.fixed_worker_id = p_worker_id
    AND moa.pay_mode = 'fixed_monthly'
    AND moa.effective_from <= v_cycle_end
    AND (moa.effective_to IS NULL OR moa.effective_to >= p_cycle_start);

  v_total := v_total + COALESCE(NULLIF(v_component, 0), 0);

  IF v_component IS NULL OR v_component = 0 THEN
    SELECT COALESCE(MAX(pl.operator_rate_snapshot), 0)
    INTO v_component
    FROM public.production_logs pl
    WHERE pl.org_id = p_org_id
      AND pl.fixed_worker_id = p_worker_id
      AND pl.operator_pay_mode_snapshot = 'fixed_monthly'
      AND pl.date >= p_cycle_start
      AND pl.date <= v_cycle_end;

    v_total := v_total + COALESCE(v_component, 0);
  END IF;

  -- Fixed shift machine operators: each assignment/date/shift is payable once.
  SELECT COALESCE(SUM(shift_rate), 0)
  INTO v_component
  FROM (
    SELECT
      pl.operator_assignment_id,
      pl.date,
      pl.shift,
      MAX(COALESCE(pl.operator_rate_snapshot, 0)) AS shift_rate
    FROM public.production_logs pl
    WHERE pl.org_id = p_org_id
      AND pl.fixed_worker_id = p_worker_id
      AND pl.operator_pay_mode_snapshot = 'fixed_shift'
      AND pl.operator_assignment_id IS NOT NULL
      AND pl.date >= p_cycle_start
      AND pl.date <= v_cycle_end
      AND COALESCE(pl.meters, 0) > 0
    GROUP BY pl.operator_assignment_id, pl.date, pl.shift
  ) payable_shifts;

  v_total := v_total + COALESCE(v_component, 0);

  SELECT COUNT(*)
  INTO v_attendance_days
  FROM public.attendance a
  WHERE a.org_id = p_org_id
    AND a.fixed_worker_id = p_worker_id
    AND a.date >= p_cycle_start
    AND a.date <= v_cycle_end
    AND COALESCE(a.present, false) IS TRUE;

  IF COALESCE(v_attendance_days, 0) > 0 THEN
    SELECT COALESCE(SUM(day_rate), 0)
    INTO v_component
    FROM (
      SELECT
        a.date,
        MAX(COALESCE(moa.rate, v_monthly_salary / 30)) AS day_rate
      FROM public.attendance a
      LEFT JOIN public.machine_operator_assignments moa
        ON moa.org_id = a.org_id
       AND moa.fixed_worker_id = a.fixed_worker_id
       AND moa.pay_mode = 'fixed_daily'
       AND moa.effective_from <= a.date
       AND (moa.effective_to IS NULL OR moa.effective_to >= a.date)
      WHERE a.org_id = p_org_id
        AND a.fixed_worker_id = p_worker_id
        AND a.date >= p_cycle_start
        AND a.date <= v_cycle_end
        AND COALESCE(a.present, false) IS TRUE
      GROUP BY a.date
    ) payable_days;
  ELSE
    SELECT COALESCE(SUM(day_rate), 0)
    INTO v_component
    FROM (
      SELECT
        pl.date,
        MAX(COALESCE(pl.operator_rate_snapshot, 0)) AS day_rate
      FROM public.production_logs pl
      WHERE pl.org_id = p_org_id
        AND pl.fixed_worker_id = p_worker_id
        AND pl.operator_pay_mode_snapshot = 'fixed_daily'
        AND pl.date >= p_cycle_start
        AND pl.date <= v_cycle_end
        AND COALESCE(pl.meters, 0) > 0
      GROUP BY pl.date
    ) payable_days;
  END IF;

  v_total := v_total + COALESCE(v_component, 0);

  RETURN COALESCE(v_total, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_operator_payroll_gross(UUID, TEXT, BIGINT, DATE)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.settle_worker_payroll_hardened(
  p_org_id UUID,
  p_worker_type TEXT,
  p_worker_id BIGINT,
  p_cycle_start DATE,
  p_gross_amount NUMERIC,
  p_is_final_settlement BOOLEAN DEFAULT false,
  p_manual_deduction_override NUMERIC DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_payment_mode TEXT DEFAULT NULL,
  p_manual_adjustments JSONB DEFAULT '[]'::jsonb,
  p_verified_by_owner BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gross_amount NUMERIC;
BEGIN
  PERFORM public.assert_payroll_owner_actor(p_org_id, p_actor_id);

  IF p_payment_mode IS NULL OR p_payment_mode NOT IN ('cash', 'bank_transfer', 'upi', 'cheque') THEN
    RAISE EXCEPTION 'payment_mode is required for payroll settlement'
      USING ERRCODE = '23514';
  END IF;

  IF p_verified_by_owner IS NOT TRUE THEN
    RAISE EXCEPTION 'owner verification is required for payroll settlement'
      USING ERRCODE = '42501';
  END IF;

  v_gross_amount := public.calculate_operator_payroll_gross(
    p_org_id,
    p_worker_type,
    p_worker_id,
    p_cycle_start
  );

  PERFORM set_config('app.actor_id', p_actor_id::text, true);

  RETURN public.settle_worker_payroll(
    p_org_id,
    p_worker_type,
    p_worker_id,
    p_cycle_start,
    v_gross_amount,
    p_is_final_settlement,
    p_manual_deduction_override,
    p_actor_id,
    p_payment_mode,
    p_manual_adjustments,
    p_verified_by_owner
  ) || jsonb_build_object(
    'server_calculated_gross', v_gross_amount,
    'client_gross_ignored', COALESCE(p_gross_amount, 0) IS DISTINCT FROM v_gross_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_worker_payroll_hardened(UUID, TEXT, BIGINT, DATE, NUMERIC, BOOLEAN, NUMERIC, UUID, TEXT, JSONB, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_worker_payroll_hardened(UUID, TEXT, BIGINT, DATE, NUMERIC, BOOLEAN, NUMERIC, UUID, TEXT, JSONB, BOOLEAN)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.replace_shift_production_logs(
  p_logs JSONB,
  p_allow_overwrite BOOLEAN DEFAULT FALSE,
  p_access_code_used BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(inserted_count INT, replaced_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_role TEXT;
  v_date DATE;
  v_shift TEXT;
  v_replaced_count INT := 0;
  v_inserted_count INT := 0;
  v_grain RECORD;
BEGIN
  v_org_id := NULLIF(auth.jwt() ->> 'org_id', '')::uuid;
  PERFORM public.assert_org_not_locked(v_org_id);

  v_role := auth.jwt() ->> 'user_role';

  IF v_role NOT IN ('owner', 'supervisor') OR v_org_id IS NULL THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF JSONB_TYPEOF(p_logs) IS DISTINCT FROM 'array' OR JSONB_ARRAY_LENGTH(p_logs) = 0 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  DROP TABLE IF EXISTS pg_temp.weavly_shift_logs;
  CREATE TEMP TABLE weavly_shift_logs ON COMMIT DROP AS
  SELECT
    machine_id::uuid AS machine_id,
    worker_id::bigint AS worker_id,
    NULLIF(order_id, '')::uuid AS order_id,
    meters::numeric AS meters,
    opening_meter_reading::numeric AS opening_meter_reading,
    closing_meter_reading::numeric AS closing_meter_reading,
    COALESCE(counter_was_reset, FALSE)::boolean AS counter_was_reset,
    shift::text AS shift,
    date::date AS date,
    worker_rate_snapshot::numeric AS worker_rate_snapshot,
    NULLIF(operator_assignment_id, '')::uuid AS operator_assignment_id,
    NULLIF(operator_worker_type, '')::text AS operator_worker_type,
    meter_worker_id::bigint AS meter_worker_id,
    fixed_worker_id::bigint AS fixed_worker_id,
    NULLIF(operator_pay_mode_snapshot, '')::text AS operator_pay_mode_snapshot,
    operator_rate_snapshot::numeric AS operator_rate_snapshot,
    NULLIF(machine_type_snapshot, '')::text AS machine_type_snapshot,
    COALESCE(submitted_at, now())::timestamptz AS submitted_at,
    COALESCE(client_ip, 'unknown')::text AS client_ip,
    NULLIF(BTRIM(COALESCE(zero_meter_reason, '')), '')::text AS zero_meter_reason
  FROM JSONB_TO_RECORDSET(p_logs) AS x(
    machine_id text,
    worker_id bigint,
    order_id text,
    meters numeric,
    opening_meter_reading numeric,
    closing_meter_reading numeric,
    counter_was_reset boolean,
    shift text,
    date date,
    worker_rate_snapshot numeric,
    operator_assignment_id text,
    operator_worker_type text,
    meter_worker_id bigint,
    fixed_worker_id bigint,
    operator_pay_mode_snapshot text,
    operator_rate_snapshot numeric,
    machine_type_snapshot text,
    submitted_at timestamptz,
    client_ip text,
    zero_meter_reason text
  );

  UPDATE weavly_shift_logs
  SET
    meter_worker_id = COALESCE(meter_worker_id, worker_id),
    operator_worker_type = CASE
      WHEN operator_worker_type IS NOT NULL THEN operator_worker_type
      WHEN COALESCE(worker_id, meter_worker_id) IS NOT NULL THEN 'meter_worker'
      WHEN fixed_worker_id IS NOT NULL THEN 'fixed_worker'
      ELSE NULL
    END,
    operator_pay_mode_snapshot = COALESCE(operator_pay_mode_snapshot, CASE WHEN COALESCE(worker_id, meter_worker_id) IS NOT NULL THEN 'per_meter' END),
    operator_rate_snapshot = COALESCE(operator_rate_snapshot, worker_rate_snapshot),
    machine_type_snapshot = COALESCE(machine_type_snapshot, 'other');

  SELECT MIN(date), MIN(shift)
  INTO v_date, v_shift
  FROM weavly_shift_logs;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    WHERE date IS DISTINCT FROM v_date
       OR shift IS DISTINCT FROM v_shift
  ) THEN
    RAISE EXCEPTION 'All production logs in one submission must share date and shift.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    GROUP BY machine_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate machine entries in one production submission.';
  END IF;

  IF EXISTS (SELECT 1 FROM weavly_shift_logs WHERE meters IS NULL) THEN
    RAISE EXCEPTION 'Production meters are required.';
  END IF;

  IF EXISTS (SELECT 1 FROM weavly_shift_logs WHERE meters < 0) THEN
    RAISE EXCEPTION 'Production meters cannot be negative.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':' || v_date::text || ':' || v_shift, 0)
  );

  PERFORM 1
  FROM public.orders o
  WHERE o.org_id = v_org_id
    AND o.id IN (
      SELECT DISTINCT order_id
      FROM weavly_shift_logs
      WHERE order_id IS NOT NULL
      UNION
      SELECT DISTINCT pl.order_id
      FROM public.production_logs pl
      JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
      WHERE pl.org_id = v_org_id
        AND pl.date = v_date
        AND pl.shift = v_shift
        AND pl.order_id IS NOT NULL
    )
  FOR UPDATE;

  PERFORM 1
  FROM public.machines m
  WHERE m.org_id = v_org_id
    AND m.id IN (
      SELECT DISTINCT machine_id
      FROM weavly_shift_logs
      WHERE machine_id IS NOT NULL
    )
  FOR UPDATE;

  DROP TABLE IF EXISTS pg_temp.weavly_affected_production_grains;
  CREATE TEMP TABLE weavly_affected_production_grains (
    org_id UUID NOT NULL,
    order_id UUID NOT NULL,
    source_date DATE NOT NULL,
    source_shift TEXT NOT NULL,
    PRIMARY KEY (org_id, order_id, source_date, source_shift)
  ) ON COMMIT DROP;

  INSERT INTO weavly_affected_production_grains (org_id, order_id, source_date, source_shift)
  SELECT DISTINCT pl.org_id, pl.order_id, pl.date, pl.shift
  FROM public.production_logs pl
  JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
  WHERE pl.org_id = v_org_id
    AND pl.date = v_date
    AND pl.shift = v_shift
    AND pl.order_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN public.machines m ON m.id = l.machine_id AND m.org_id = v_org_id
    WHERE m.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Machine not found for this organization.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN public.workers w ON w.id = l.meter_worker_id AND w.org_id = v_org_id
    WHERE l.meter_worker_id IS NOT NULL AND w.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Worker not found for this organization.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN public.fixed_workers fw ON fw.id = l.fixed_worker_id AND fw.org_id = v_org_id
    WHERE l.fixed_worker_id IS NOT NULL AND fw.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Fixed worker not found for this organization.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN public.orders o ON o.id = l.order_id AND o.org_id = v_org_id
    WHERE l.order_id IS NOT NULL AND o.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Order not found for this organization.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN public.machine_operator_assignments moa
      ON moa.id = l.operator_assignment_id
     AND moa.org_id = v_org_id
     AND moa.machine_id = l.machine_id
     AND moa.shift = l.shift
     AND moa.worker_type = l.operator_worker_type
     AND COALESCE(moa.meter_worker_id, -1) = COALESCE(l.meter_worker_id, -1)
     AND COALESCE(moa.fixed_worker_id, -1) = COALESCE(l.fixed_worker_id, -1)
     AND moa.pay_mode = l.operator_pay_mode_snapshot
     AND moa.active IS TRUE
     AND moa.effective_from <= l.date
     AND (moa.effective_to IS NULL OR moa.effective_to >= l.date)
    WHERE l.operator_assignment_id IS NOT NULL
      AND moa.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Operator assignment not found or inactive for this production shift.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    WHERE meters > 0
      AND (
        order_id IS NULL
        OR operator_worker_type IS NULL
        OR operator_pay_mode_snapshot IS NULL
        OR COALESCE(operator_rate_snapshot, worker_rate_snapshot, 0) <= 0
        OR (
          operator_assignment_id IS NULL
          AND COALESCE(worker_id, meter_worker_id) IS NULL
        )
        OR (
          operator_assignment_id IS NOT NULL
          AND (
            (operator_worker_type = 'meter_worker' AND meter_worker_id IS NULL)
            OR (operator_worker_type = 'fixed_worker' AND fixed_worker_id IS NULL)
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Production logs with meters > 0 require operator assignment, order, and a valid rate.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    WHERE operator_worker_type = 'fixed_worker'
      AND operator_pay_mode_snapshot = 'per_meter'
  ) THEN
    RAISE EXCEPTION 'Fixed machine operator logs cannot use per-meter pay mode.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    WHERE operator_worker_type = 'meter_worker'
      AND operator_pay_mode_snapshot <> 'per_meter'
  ) THEN
    RAISE EXCEPTION 'Meter worker logs must use per-meter pay mode.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    JOIN public.orders o ON o.id = l.order_id AND o.org_id = v_org_id
    JOIN public.machines m ON m.id = l.machine_id AND m.org_id = v_org_id
    WHERE l.order_id IS NOT NULL
      AND (
        o.status IS DISTINCT FROM 'active'
        OR m.status IS DISTINCT FROM 'active'
        OR m.current_order_id IS DISTINCT FROM l.order_id
      )
  ) THEN
    RAISE EXCEPTION 'Production can only be logged for the active order currently assigned to this loom.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.production_logs pl
    JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
    JOIN public.orders o ON o.id = pl.order_id AND o.org_id = v_org_id
    WHERE pl.org_id = v_org_id
      AND pl.date = v_date
      AND pl.shift = v_shift
      AND pl.order_id IS NOT NULL
      AND o.status IS DISTINCT FROM 'active'
  ) THEN
    RAISE EXCEPTION 'Production logs for non-active orders cannot be replaced.';
  END IF;

  IF EXISTS (
    WITH submitted_order_totals AS (
      SELECT order_id, ROUND(COALESCE(SUM(meters), 0), 2) AS submitted_meters
      FROM weavly_shift_logs
      WHERE order_id IS NOT NULL
        AND meters > 0
      GROUP BY order_id
    ),
    affected_orders AS (
      SELECT order_id
      FROM submitted_order_totals
      UNION
      SELECT DISTINCT pl.order_id
      FROM public.production_logs pl
      JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
      WHERE pl.org_id = v_org_id
        AND pl.date = v_date
        AND pl.shift = v_shift
        AND pl.order_id IS NOT NULL
    ),
    weavly_order_totals_after_replacement AS (
      SELECT
        ao.order_id,
        ROUND(
          COALESCE((
            SELECT SUM(CASE WHEN pl.meters > 0 THEN pl.meters ELSE 0 END)
            FROM public.production_logs pl
            WHERE pl.org_id = v_org_id
              AND pl.order_id = ao.order_id
              AND NOT EXISTS (
                SELECT 1
                FROM weavly_shift_logs l
                WHERE l.machine_id = pl.machine_id
                  AND pl.date = v_date
                  AND pl.shift = v_shift
              )
          ), 0)
          + COALESCE(sot.submitted_meters, 0),
          2
        ) AS next_meters
      FROM affected_orders ao
      LEFT JOIN submitted_order_totals sot ON sot.order_id = ao.order_id
    )
    SELECT 1
    FROM weavly_order_totals_after_replacement totals
    JOIN public.orders o ON o.id = totals.order_id AND o.org_id = v_org_id
    WHERE totals.next_meters > COALESCE(o.total_target_meters, 0) + 0.01
  ) THEN
    RAISE EXCEPTION 'Production would exceed order target.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    WHERE meters = 0
      AND (zero_meter_reason IS NULL OR BTRIM(zero_meter_reason) = '')
  ) THEN
    RAISE EXCEPTION 'Zero-meter logs require a reason.';
  END IF;

  SELECT COUNT(*)
  INTO v_replaced_count
  FROM public.production_logs pl
  JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
  WHERE pl.org_id = v_org_id
    AND pl.date = v_date
    AND pl.shift = v_shift;

  IF v_replaced_count > 0 AND NOT p_allow_overwrite THEN
    RAISE EXCEPTION 'DUPLICATE_LOG_DETECTED';
  END IF;

  IF v_replaced_count > 0 THEN
    INSERT INTO public.audit_log (
      org_id,
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      is_access_code_used
    )
    SELECT
      v_org_id,
      'production_logs',
      v_date::text || ':' || v_shift,
      'shift_self_correction',
      JSONB_AGG(TO_JSONB(pl) ORDER BY pl.id),
      (SELECT JSONB_AGG(TO_JSONB(l) ORDER BY l.machine_id) FROM weavly_shift_logs l),
      auth.uid(),
      p_access_code_used
    FROM public.production_logs pl
    JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
    WHERE pl.org_id = v_org_id
      AND pl.date = v_date
      AND pl.shift = v_shift;

    DELETE FROM public.production_logs pl
    USING weavly_shift_logs l
    WHERE pl.org_id = v_org_id
      AND pl.date = v_date
      AND pl.shift = v_shift
      AND pl.machine_id = l.machine_id;
  END IF;

  INSERT INTO public.production_logs (
    org_id,
    machine_id,
    worker_id,
    order_id,
    meters,
    opening_meter_reading,
    closing_meter_reading,
    counter_was_reset,
    shift,
    date,
    worker_rate_snapshot,
    operator_assignment_id,
    operator_worker_type,
    meter_worker_id,
    fixed_worker_id,
    operator_pay_mode_snapshot,
    operator_rate_snapshot,
    machine_type_snapshot,
    created_by,
    updated_by,
    submitted_at,
    client_ip,
    zero_meter_reason
  )
  SELECT
    v_org_id,
    machine_id,
    CASE WHEN operator_worker_type = 'meter_worker' THEN meter_worker_id ELSE NULL END,
    order_id,
    meters,
    opening_meter_reading,
    closing_meter_reading,
    counter_was_reset,
    shift,
    date,
    CASE WHEN operator_worker_type = 'meter_worker' THEN COALESCE(operator_rate_snapshot, worker_rate_snapshot, 0) ELSE 0 END,
    operator_assignment_id,
    operator_worker_type,
    CASE WHEN operator_worker_type = 'meter_worker' THEN meter_worker_id ELSE NULL END,
    CASE WHEN operator_worker_type = 'fixed_worker' THEN fixed_worker_id ELSE NULL END,
    operator_pay_mode_snapshot,
    COALESCE(operator_rate_snapshot, worker_rate_snapshot, 0),
    machine_type_snapshot,
    auth.uid(),
    auth.uid(),
    submitted_at,
    client_ip,
    CASE WHEN meters = 0 THEN zero_meter_reason ELSE NULL END
  FROM weavly_shift_logs;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  INSERT INTO weavly_affected_production_grains (org_id, order_id, source_date, source_shift)
  SELECT DISTINCT v_org_id, order_id, date, shift
  FROM weavly_shift_logs
  WHERE order_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  FOR v_grain IN
    SELECT org_id, order_id, source_date, source_shift
    FROM weavly_affected_production_grains
    ORDER BY source_date, source_shift, order_id
  LOOP
    PERFORM 1
    FROM public.reconcile_generated_stock_for_production_grain(
      v_grain.org_id,
      v_grain.order_id,
      v_grain.source_date,
      v_grain.source_shift,
      auth.uid()
    );
  END LOOP;

  RETURN QUERY SELECT v_inserted_count, v_replaced_count;
END;
$$;

COMMENT ON FUNCTION public.replace_shift_production_logs(JSONB, BOOLEAN, BOOLEAN) IS
  'Machine Operator Payroll v2 production replacement RPC: accepts assignment snapshots and prevents fixed operator logs from producing meter wages.';

GRANT EXECUTE ON FUNCTION public.replace_shift_production_logs(JSONB, BOOLEAN, BOOLEAN)
  TO authenticated, service_role;
