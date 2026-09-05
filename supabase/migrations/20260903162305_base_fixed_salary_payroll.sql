-- Base fixed staff use the existing audited settlement/recovery lifecycle.
-- No legacy workers, production rows, or saved costing snapshots are rewritten.
ALTER TABLE public.base_production_workers
  ADD COLUMN pay_type text NOT NULL DEFAULT 'piece_rate' CHECK (pay_type IN ('piece_rate', 'fixed_monthly')),
  ADD COLUMN role text NOT NULL DEFAULT '' CHECK (length(role) <= 80),
  ADD COLUMN monthly_salary numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_salary BETWEEN 0 AND 10000000),
  ADD COLUMN start_date date,
  ADD COLUMN end_date date,
  ADD COLUMN salary_effective_from date,
  ADD COLUMN salary_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT base_salary_dates CHECK (end_date IS NULL OR end_date >= start_date),
  ADD CONSTRAINT base_salary_setup CHECK (pay_type = 'piece_rate' OR (monthly_salary > 0 AND start_date IS NOT NULL AND salary_effective_from >= start_date));

CREATE OR REPLACE FUNCTION private.guard_base_staff_compensation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, private AS $$
DECLARE v_latest_paid date;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.org_id::text || ':base-payroll:' || NEW.id::text, 0));
  IF TG_OP = 'UPDATE' THEN
    IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.pay_type IS DISTINCT FROM OLD.pay_type THEN
      RAISE EXCEPTION 'Worker organization and pay type cannot be changed. Add a separate worker record.' USING ERRCODE = '22023';
    END IF;
    IF NEW.salary_history IS DISTINCT FROM OLD.salary_history THEN
      RAISE EXCEPTION 'Salary history is maintained automatically.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NEW.pay_type = 'piece_rate' THEN
    NEW.monthly_salary := 0;
    NEW.salary_history := '[]'::jsonb;
    RETURN NEW;
  END IF;
  NEW.rate_per_meter := 0;
  IF NEW.start_date IS NULL OR NEW.monthly_salary <= 0 THEN
    RAISE EXCEPTION 'Enter a joining date and positive monthly salary.' USING ERRCODE = '22023';
  END IF;
  IF NOT NEW.is_active AND NEW.end_date IS NULL THEN
    RAISE EXCEPTION 'Enter the last working day before making salaried staff inactive.' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.salary_effective_from := NEW.start_date;
    NEW.salary_history := jsonb_build_array(jsonb_build_object('effective_from', NEW.start_date, 'monthly_salary', NEW.monthly_salary));
  ELSE
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
      RAISE EXCEPTION 'Joining date is protected. Add a separate record for a new employment period.' USING ERRCODE = '22023';
    END IF;
    SELECT max(period_end) INTO v_latest_paid FROM public.base_payroll_settlements
    WHERE org_id = NEW.org_id AND worker_id = NEW.id AND status = 'paid';
    IF NEW.end_date IS DISTINCT FROM OLD.end_date AND (NEW.end_date IS NULL OR NEW.end_date < v_latest_paid) THEN
      RAISE EXCEPTION 'Last working day cannot remove paid days or reopen a closed employment period.' USING ERRCODE = '22023';
    END IF;
    IF OLD.end_date IS NOT NULL AND NOT OLD.is_active AND NEW.is_active THEN
      RAISE EXCEPTION 'Add a separate record for a new employment period.' USING ERRCODE = '22023';
    END IF;
    IF NEW.monthly_salary IS DISTINCT FROM OLD.monthly_salary THEN
      IF NEW.salary_effective_from IS NULL OR NEW.salary_effective_from <= OLD.salary_effective_from
        OR NEW.salary_effective_from < (now() AT TIME ZONE 'Asia/Kolkata')::date
        OR NEW.salary_effective_from <= v_latest_paid THEN
        RAISE EXCEPTION 'Salary changes need an effective date from today onward, after the previous rate and all paid periods.' USING ERRCODE = '22023';
      END IF;
      NEW.salary_history := OLD.salary_history || jsonb_build_array(jsonb_build_object('effective_from', NEW.salary_effective_from, 'monthly_salary', NEW.monthly_salary));
    ELSE
      NEW.salary_effective_from := OLD.salary_effective_from;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_base_staff_compensation() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER guard_base_staff_compensation BEFORE INSERT OR UPDATE ON public.base_production_workers
FOR EACH ROW EXECUTE FUNCTION private.guard_base_staff_compensation();

-- Pure calculation; no data access or elevated privileges. One rounded line
-- per calendar month/rate segment is used by both settlement and its receipt.
CREATE OR REPLACE FUNCTION private.base_salary_lines(p_history jsonb, p_start date, p_end date)
RETURNS TABLE(period_start date, period_end date, monthly_salary numeric, paid_days integer, month_days integer, gross_pay numeric)
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = pg_catalog AS $$
  WITH rates AS (
    SELECT (item->>'effective_from')::date AS starts,
      lead((item->>'effective_from')::date) OVER (ORDER BY (item->>'effective_from')::date) - 1 AS ends,
      (item->>'monthly_salary')::numeric AS salary
    FROM jsonb_array_elements(p_history) AS item
  ), segments AS (
    SELECT greatest(rates.starts, p_start, month::date) AS starts,
      least(coalesce(rates.ends, p_end), p_end, (month + interval '1 month - 1 day')::date) AS ends,
      salary, extract(day FROM month + interval '1 month - 1 day')::integer AS days_in_month
    FROM rates CROSS JOIN LATERAL generate_series(
      date_trunc('month', greatest(rates.starts, p_start)::timestamp),
      date_trunc('month', least(coalesce(rates.ends, p_end), p_end)::timestamp), interval '1 month') AS month
  )
  SELECT starts, ends, salary, ends - starts + 1, days_in_month,
    round(salary * (ends - starts + 1) / days_in_month, 2)
  FROM segments WHERE ends >= starts ORDER BY starts;
$$;
REVOKE ALL ON FUNCTION private.base_salary_lines(jsonb,date,date) FROM PUBLIC, anon, authenticated, service_role;

-- Staff are indirect labour: production and machine assignments remain piece
-- rate only. Enforce below the UI and through every existing write entrypoint.
CREATE OR REPLACE FUNCTION private.guard_base_piece_worker()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.base_production_workers WHERE org_id = NEW.org_id AND id = NEW.worker_id AND pay_type = 'fixed_monthly') THEN
    RAISE EXCEPTION 'Fixed-salary staff are paid through payroll, not machine production.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_base_piece_worker() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER guard_base_piece_worker BEFORE INSERT OR UPDATE ON public.base_worker_machine_assignments
FOR EACH ROW EXECUTE FUNCTION private.guard_base_piece_worker();
CREATE TRIGGER guard_base_piece_worker BEFORE INSERT OR UPDATE ON public.base_production_entries
FOR EACH ROW EXECUTE FUNCTION private.guard_base_piece_worker();
CREATE TRIGGER guard_base_piece_worker BEFORE INSERT OR UPDATE ON public.base_daily_production_entries
FOR EACH ROW EXECUTE FUNCTION private.guard_base_piece_worker();

ALTER TABLE public.base_payroll_settlement_lines DROP CONSTRAINT base_payroll_settlement_lines_source_kind_check;
ALTER TABLE public.base_payroll_settlement_lines ADD CONSTRAINT base_payroll_settlement_lines_source_kind_check
  CHECK (source_kind IN ('legacy_entry', 'worker_total', 'machine_allocation', 'fixed_salary'));

-- Extend the current audited writer in-place, retaining its locks, request
-- idempotency, reviewed-amount check, recovery receipts and reversal handling.
-- Assert replacement anchors so schema drift fails loudly, not partially.
DO $migration$
DECLARE definition text; original text;
BEGIN
  SELECT pg_get_functiondef('public.settle_base_worker_payroll(uuid,date,text)'::regprocedure) INTO original;
  definition := replace(original, 'v_worker_exists boolean;', 'v_worker_exists boolean; v_salary_worker public.base_production_workers%ROWTYPE;');
  definition := replace(definition, '  SELECT COALESCE(SUM(source.gross_pay), 0)', $branch$
  SELECT * INTO v_salary_worker FROM public.base_production_workers WHERE org_id = v_org_id AND id = p_worker_id;
  IF v_salary_worker.pay_type = 'fixed_monthly' THEN
    SELECT coalesce(max(period_end) + 1, v_salary_worker.start_date) INTO v_period_start
    FROM public.base_payroll_settlements WHERE org_id = v_org_id AND worker_id = p_worker_id AND status = 'paid' AND period_end < p_period_end;
    SELECT coalesce(sum(gross_pay), 0) INTO v_gross FROM private.base_salary_lines(
      v_salary_worker.salary_history, greatest(v_period_start, v_salary_worker.start_date), least(p_period_end, coalesce(v_salary_worker.end_date, p_period_end)));
  ELSE
  SELECT COALESCE(SUM(source.gross_pay), 0)$branch$);
  definition := replace(definition, '  SELECT COALESCE(SUM(GREATEST(advance.amount - advance.recovered_amount, 0)), 0)' || chr(10) || '  INTO v_total_pending_advances',
    '  END IF;' || chr(10) || '  SELECT COALESCE(SUM(GREATEST(advance.amount - advance.recovered_amount, 0)), 0)' || chr(10) || '  INTO v_total_pending_advances');
  definition := replace(definition, 'There is no recorded production to settle for this period', 'There are no earnings to settle for this period');
  IF definition = original OR position('v_salary_worker public' in definition) = 0 OR position('END IF;' || chr(10) || '  SELECT COALESCE(SUM(GREATEST' in definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected Base payroll writer definition';
  END IF;
  EXECUTE definition;

  SELECT pg_get_functiondef('private.capture_base_payroll_settlement_lines()'::regprocedure) INTO original;
  definition := replace(original, 'BEGIN' || chr(10) || '  INSERT INTO public.base_payroll_settlement_lines', $capture$
DECLARE v_worker public.base_production_workers%ROWTYPE;
BEGIN
  SELECT * INTO v_worker FROM public.base_production_workers WHERE org_id = NEW.org_id AND id = NEW.worker_id;
  IF v_worker.pay_type = 'fixed_monthly' THEN
    INSERT INTO public.base_payroll_settlement_lines(org_id,settlement_id,worker_id,production_date,machine_label,costing_label,meters,worker_rate_snapshot,gross_pay,source_kind,source_id)
    SELECT NEW.org_id, NEW.id, NEW.worker_id, line.period_start, 'Fixed salary',
      line.period_start::text || ' to ' || line.period_end::text || ' (' || line.paid_days::text || '/' || line.month_days::text || ' days)',
      0, line.monthly_salary, line.gross_pay, 'fixed_salary', gen_random_uuid()
    FROM private.base_salary_lines(v_worker.salary_history, greatest(NEW.period_start, v_worker.start_date), least(NEW.period_end, coalesce(v_worker.end_date, NEW.period_end))) AS line;
    RETURN NEW;
  END IF;
  INSERT INTO public.base_payroll_settlement_lines$capture$);
  IF definition = original THEN RAISE EXCEPTION 'Unexpected Base payroll snapshot definition'; END IF;
  EXECUTE definition;
END;
$migration$;
REVOKE ALL ON FUNCTION public.settle_base_worker_payroll(uuid,date,text) FROM PUBLIC, anon, authenticated, service_role;

-- Salary totals are authoritative for current factory defaults only. A direct
-- per-metre override remains deliberate; saved quotes/costings never change.
CREATE OR REPLACE FUNCTION private.base_salary_overhead(p_org uuid, p_items jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public AS $$
  SELECT CASE WHEN EXISTS(SELECT 1 FROM public.base_production_workers WHERE org_id=p_org AND pay_type='fixed_monthly') THEN
    coalesce((SELECT jsonb_agg(item) FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) item
      WHERE coalesce(item->>'source','') <> 'base_salary_derived'
        AND NOT (coalesce((item->>'isPreset')::boolean,false) AND item->>'category'='admin')), '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('id','base-staff-salary','label','Fixed Salary Factory Staff',
      'source','base_salary_derived','category','admin','isPreset',true,'isLocked',true,'monthlyAmount',
      coalesce((SELECT sum((SELECT (rate->>'monthly_salary')::numeric FROM jsonb_array_elements(worker.salary_history) rate
        WHERE (rate->>'effective_from')::date <= (now() AT TIME ZONE 'Asia/Kolkata')::date ORDER BY rate->>'effective_from' DESC LIMIT 1))
      FROM public.base_production_workers worker WHERE worker.org_id=p_org AND worker.pay_type='fixed_monthly' AND worker.is_active
        AND worker.start_date <= (now() AT TIME ZONE 'Asia/Kolkata')::date
        AND (worker.end_date IS NULL OR worker.end_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date)),0)))
    ELSE p_items END;
$$;
REVOKE ALL ON FUNCTION private.base_salary_overhead(uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.sync_base_staff_overhead_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND org_id=NEW.factory_id AND role::text='owner') THEN
    RAISE EXCEPTION 'Only the organization owner can update staff overhead.' USING ERRCODE = '42501';
  END IF;
  -- Trigger-only privilege elevation: no caller-provided organization lookup.
  NEW.overhead_items := private.base_salary_overhead(NEW.factory_id, NEW.overhead_items);
  IF EXISTS (SELECT 1 FROM public.base_production_workers WHERE org_id=NEW.factory_id AND pay_type='fixed_monthly')
    AND NEW.overhead_mode = 'monthly_expenses' AND NEW.monthly_output_m > 0 THEN
    SELECT coalesce(sum((item->>'monthlyAmount')::numeric),0) / NEW.monthly_output_m
      INTO NEW.overhead_override_per_m FROM jsonb_array_elements(NEW.overhead_items) item;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_base_staff_overhead_profile() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER sync_base_staff_overhead_profile BEFORE INSERT OR UPDATE ON public.factory_cost_profile
FOR EACH ROW EXECUTE FUNCTION private.sync_base_staff_overhead_profile();

CREATE OR REPLACE FUNCTION private.refresh_base_staff_overhead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND org_id=NEW.org_id AND role::text='owner') THEN
    RAISE EXCEPTION 'Only the organization owner can update staff overhead.' USING ERRCODE = '42501';
  END IF;
  IF NEW.pay_type='fixed_monthly' THEN
    UPDATE public.factory_cost_profile SET updated_at=clock_timestamp() WHERE factory_id=NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.refresh_base_staff_overhead() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER refresh_base_staff_overhead AFTER INSERT OR UPDATE ON public.base_production_workers
FOR EACH ROW EXECUTE FUNCTION private.refresh_base_staff_overhead();
