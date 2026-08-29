-- Base Production Core
--
-- A deliberately small owner-only workflow for Base tenants:
-- costing -> production job -> owner-entered metres -> piece-rate payable.
--
-- These tables are separate from the Full Suite production, order, worker,
-- advance, and payroll tables. That keeps the existing premium boundary intact
-- and prevents a Base job from becoming a formal party order by accident.

CREATE TABLE public.base_production_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  rate_per_meter numeric(12,2) NOT NULL CHECK (
    rate_per_meter >= 0
    AND rate_per_meter NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id)
);

CREATE INDEX base_production_workers_org_active_idx
  ON public.base_production_workers(org_id, is_active, name);
CREATE UNIQUE INDEX base_production_workers_org_name_unique
  ON public.base_production_workers(org_id, lower(btrim(name)));

CREATE TABLE public.base_production_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  costing_id uuid NOT NULL,
  costing_group_id uuid,
  costing_version integer CHECK (costing_version IS NULL OR costing_version > 0),
  quality_label text NOT NULL CHECK (char_length(btrim(quality_label)) BETWEEN 1 AND 160),
  target_meters numeric(14,2) NOT NULL CHECK (
    target_meters > 0
    AND target_meters NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  start_date date NOT NULL DEFAULT current_date,
  due_date date,
  customer_reference text CHECK (customer_reference IS NULL OR char_length(customer_reference) <= 160),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  planned_cost_per_meter numeric(14,2) NOT NULL DEFAULT 0 CHECK (
    planned_cost_per_meter >= 0
    AND planned_cost_per_meter NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  planned_price_per_meter numeric(14,2) NOT NULL DEFAULT 0 CHECK (
    planned_price_per_meter >= 0
    AND planned_price_per_meter NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  CONSTRAINT base_production_jobs_costing_same_org_fkey
    FOREIGN KEY (org_id, costing_id)
    REFERENCES public.estimator_quotes(org_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT base_production_jobs_dates_check
    CHECK (due_date IS NULL OR due_date >= start_date)
);

CREATE INDEX base_production_jobs_org_status_idx
  ON public.base_production_jobs(org_id, status, updated_at DESC);

CREATE TABLE public.base_production_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  production_date date NOT NULL DEFAULT current_date,
  meters numeric(14,2) NOT NULL CHECK (
    meters > 0
    AND meters NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  worker_rate_snapshot numeric(12,2) NOT NULL CHECK (
    worker_rate_snapshot >= 0
    AND worker_rate_snapshot NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  client_request_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  CONSTRAINT base_production_entries_job_same_org_fkey
    FOREIGN KEY (org_id, job_id)
    REFERENCES public.base_production_jobs(org_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT base_production_entries_worker_same_org_fkey
    FOREIGN KEY (org_id, worker_id)
    REFERENCES public.base_production_workers(org_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX base_production_entries_org_date_idx
  ON public.base_production_entries(org_id, production_date DESC);
CREATE INDEX base_production_entries_job_date_idx
  ON public.base_production_entries(job_id, production_date DESC);
CREATE INDEX base_production_entries_worker_date_idx
  ON public.base_production_entries(worker_id, production_date DESC);
CREATE UNIQUE INDEX base_production_entries_org_request_unique
  ON public.base_production_entries(org_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE TABLE public.base_worker_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (
    amount > 0
    AND amount NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  recovered_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (
    recovered_amount >= 0
    AND recovered_amount <= amount
  ),
  description text CHECK (description IS NULL OR char_length(description) <= 240),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deducted')),
  recovered_at timestamptz,
  last_recovered_period_end date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  CONSTRAINT base_worker_advances_worker_same_org_fkey
    FOREIGN KEY (org_id, worker_id)
    REFERENCES public.base_production_workers(org_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT base_worker_advances_status_check
    CHECK (
      (status = 'pending' AND recovered_amount < amount)
      OR (status = 'deducted' AND recovered_amount = amount)
    )
);

CREATE INDEX base_worker_advances_pending_idx
  ON public.base_worker_advances(org_id, worker_id, created_at)
  WHERE status = 'pending';

CREATE TABLE public.base_payroll_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_pay numeric(14,2) NOT NULL CHECK (gross_pay >= 0),
  advance_deducted numeric(14,2) NOT NULL DEFAULT 0 CHECK (advance_deducted >= 0),
  net_payout numeric(14,2) NOT NULL DEFAULT 0 CHECK (net_payout >= 0),
  payment_mode text NOT NULL CHECK (payment_mode IN ('cash', 'bank_transfer', 'upi', 'cheque')),
  status text NOT NULL DEFAULT 'paid' CHECK (status = 'paid'),
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  UNIQUE (org_id, worker_id, period_start, period_end),
  CONSTRAINT base_payroll_settlements_worker_same_org_fkey
    FOREIGN KEY (org_id, worker_id)
    REFERENCES public.base_production_workers(org_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT base_payroll_settlements_dates_check
    CHECK (period_start <= period_end)
);

CREATE INDEX base_payroll_settlements_worker_period_idx
  ON public.base_payroll_settlements(org_id, worker_id, period_end DESC);

-- One access predicate is reused by every Base table policy. Premium tenants
-- also satisfy the Base entitlement, but the Full Suite workspace does not
-- expose this route in navigation; direct access remains owner-only.
CREATE OR REPLACE FUNCTION public.base_production_core_access(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    p_org_id IS NOT NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS membership
      WHERE membership.id = (SELECT auth.uid())
        AND membership.org_id = p_org_id
        AND membership.role::text = 'owner'
    )
    AND public.org_has_subscription_tier(p_org_id, 'base');
$function$;

REVOKE ALL ON FUNCTION public.base_production_core_access(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.base_production_core_access(uuid)
  TO authenticated;

ALTER TABLE public.base_production_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_production_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_worker_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_payroll_settlements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.base_production_workers,
  public.base_production_jobs,
  public.base_production_entries,
  public.base_worker_advances,
  public.base_payroll_settlements
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.base_production_workers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.base_production_jobs TO authenticated;
GRANT SELECT, INSERT ON public.base_production_entries TO authenticated;
GRANT SELECT, INSERT ON public.base_worker_advances TO authenticated;
GRANT SELECT ON public.base_payroll_settlements TO authenticated;

CREATE POLICY base_production_workers_owner_access
  ON public.base_production_workers
  FOR ALL TO authenticated
  USING (public.base_production_core_access(org_id))
  WITH CHECK (public.base_production_core_access(org_id));

CREATE POLICY base_production_jobs_owner_access
  ON public.base_production_jobs
  FOR ALL TO authenticated
  USING (public.base_production_core_access(org_id))
  WITH CHECK (public.base_production_core_access(org_id));

CREATE POLICY base_production_entries_owner_read
  ON public.base_production_entries
  FOR SELECT TO authenticated
  USING (public.base_production_core_access(org_id));

CREATE POLICY base_production_entries_owner_insert
  ON public.base_production_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.base_production_core_access(org_id));

CREATE POLICY base_worker_advances_owner_read
  ON public.base_worker_advances
  FOR SELECT TO authenticated
  USING (public.base_production_core_access(org_id));

CREATE POLICY base_worker_advances_owner_insert
  ON public.base_worker_advances
  FOR INSERT TO authenticated
  WITH CHECK (public.base_production_core_access(org_id));

CREATE POLICY base_payroll_settlements_owner_read
  ON public.base_payroll_settlements
  FOR SELECT TO authenticated
  USING (public.base_production_core_access(org_id));

CREATE OR REPLACE FUNCTION public.validate_base_production_job_costing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_record_kind text;
  v_is_archived boolean;
BEGIN
  SELECT quote.record_kind, quote.is_archived
  INTO v_record_kind, v_is_archived
  FROM public.estimator_quotes AS quote
  WHERE quote.org_id = NEW.org_id
    AND quote.id = NEW.costing_id;

  IF v_record_kind IS DISTINCT FROM 'costing' OR COALESCE(v_is_archived, false) THEN
    RAISE EXCEPTION 'A Base production job must use an active saved costing'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_base_production_job_costing
  ON public.base_production_jobs;
CREATE TRIGGER validate_base_production_job_costing
  BEFORE INSERT OR UPDATE OF org_id, costing_id
  ON public.base_production_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_base_production_job_costing();

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

  -- The rate is always taken from the worker master at insert time. The
  -- action also supplies it for a friendly application path, but the trigger
  -- is the final integrity boundary for direct Data API inserts.
  NEW.worker_rate_snapshot := v_worker_rate;

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

DROP TRIGGER IF EXISTS validate_base_production_entry
  ON public.base_production_entries;
CREATE TRIGGER validate_base_production_entry
  BEFORE INSERT
  ON public.base_production_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_base_production_entry();

REVOKE ALL ON FUNCTION public.validate_base_production_job_costing()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_base_production_entry()
  FROM PUBLIC, anon, authenticated, service_role;

-- Settlement is the only path that writes payroll snapshots and recovers
-- advances. Gross pay is calculated from stored metre/rate snapshots, never
-- from a client-provided amount. The 50% recovery cap is the same rule used
-- by the Full Suite payroll engine.
CREATE OR REPLACE FUNCTION public.settle_base_worker_payroll(
  p_worker_id uuid,
  p_period_end date,
  p_payment_mode text DEFAULT 'cash'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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

  IF v_org_id IS NULL OR NOT public.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required'
      USING ERRCODE = '42501';
  END IF;

  IF p_worker_id IS NULL OR p_period_end IS NULL OR p_period_end > (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RAISE EXCEPTION 'A valid payroll period is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_payment_mode IS NULL OR p_payment_mode NOT IN ('cash', 'bank_transfer', 'upi', 'cheque') THEN
    RAISE EXCEPTION 'A valid payment mode is required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':base-payroll:' || p_worker_id::text, 0)
  );

  SELECT EXISTS (
    SELECT 1
    FROM public.base_production_workers AS worker
    WHERE worker.org_id = v_org_id
      AND worker.id = p_worker_id
  )
  INTO v_worker_exists;

  IF NOT v_worker_exists THEN
    RAISE EXCEPTION 'Worker not found'
      USING ERRCODE = '23503';
  END IF;

  -- A second click on the same day is idempotent. Settlements move forward
  -- monotonically, so a later run cannot accidentally pay the same entries.
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
    RAISE EXCEPTION 'Payroll period must move forward'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE((MAX(settlement.period_end) + 1)::date, date_trunc('month', p_period_end)::date)
  INTO v_period_start
  FROM public.base_payroll_settlements AS settlement
  WHERE settlement.org_id = v_org_id
    AND settlement.worker_id = p_worker_id
    AND settlement.period_end < p_period_end;

  SELECT COALESCE(SUM(entry.meters * entry.worker_rate_snapshot), 0)
  INTO v_gross
  FROM public.base_production_entries AS entry
  WHERE entry.org_id = v_org_id
    AND entry.worker_id = p_worker_id
    AND entry.production_date >= v_period_start
    AND entry.production_date <= p_period_end;

  SELECT COALESCE(SUM(GREATEST(advance.amount - advance.recovered_amount, 0)), 0)
  INTO v_total_pending_advances
  FROM public.base_worker_advances AS advance
  WHERE advance.org_id = v_org_id
    AND advance.worker_id = p_worker_id
    AND advance.status = 'pending'
    AND advance.recovered_amount < advance.amount;

  IF v_gross <= 0 THEN
    RAISE EXCEPTION 'There is no recorded production to settle for this period'
      USING ERRCODE = '22023';
  END IF;

  v_gross := round(v_gross, 2);
  v_max_deduction := round(v_gross * 0.5, 2);
  v_actual_deduction := round(LEAST(v_total_pending_advances, v_max_deduction), 2);
  v_budget := v_actual_deduction;

  INSERT INTO public.base_payroll_settlements (
    org_id,
    worker_id,
    period_start,
    period_end,
    gross_pay,
    advance_deducted,
    net_payout,
    payment_mode,
    created_by
  )
  VALUES (
    v_org_id,
    p_worker_id,
    v_period_start,
    p_period_end,
    round(v_gross, 2),
    round(v_actual_deduction, 2),
    round(GREATEST(v_gross - v_actual_deduction, 0), 2),
    p_payment_mode,
    auth.uid()
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

    v_recover_now := LEAST(
      v_budget,
      GREATEST(v_advance.amount - v_advance.recovered_amount, 0)
    );

    UPDATE public.base_worker_advances
    SET recovered_amount = recovered_amount + v_recover_now,
        status = CASE
          WHEN recovered_amount + v_recover_now >= amount THEN 'deducted'
          ELSE 'pending'
        END,
        recovered_at = now(),
        last_recovered_period_end = p_period_end
    WHERE id = v_advance.id
      AND org_id = v_org_id;

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
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_base_worker_payroll(uuid, date, text)
  TO authenticated;

COMMENT ON TABLE public.base_production_workers IS
  'Minimal Base-plan piece-rate worker roster. Full Suite worker records remain in workers.';
COMMENT ON TABLE public.base_production_jobs IS
  'Minimal Base-plan production jobs created from standalone estimator costings; not formal party orders.';
COMMENT ON TABLE public.base_production_entries IS
  'Owner-entered Base-plan production metres with an immutable worker-rate snapshot.';
COMMENT ON TABLE public.base_worker_advances IS
  'Minimal Base-plan worker advances with capped payroll recovery.';
COMMENT ON TABLE public.base_payroll_settlements IS
  'Owner-recorded Base-plan piece-rate payroll settlements.';
