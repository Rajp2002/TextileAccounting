-- Unpaid days off for fixed-salary staff.
--
-- Every employed day up to the pay period end is paid automatically. The owner
-- records only the exceptions: a past day the worker did not come. A day off
-- is unpaid, so a month's pay becomes salary x (days - days off) / days in that
-- month, still rounded once per salary-rate/calendar-month segment.
--
-- Paid days are locked by the existing settlement snapshot; reversing that
-- payment unlocks them. Days inside a completed payroll period are locked
-- until the period is reopened.

CREATE TABLE public.base_staff_days_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL,
  off_date date NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, worker_id, off_date),
  FOREIGN KEY (org_id, worker_id) REFERENCES public.base_production_workers(org_id, id) ON DELETE RESTRICT
);
ALTER TABLE public.base_staff_days_off ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.base_staff_days_off FROM PUBLIC, anon, authenticated, service_role;
-- Reads only. Every write goes through set_base_staff_day_off.
GRANT SELECT ON TABLE public.base_staff_days_off TO authenticated;
-- The owner data export reads every organization table with the service role.
GRANT SELECT ON TABLE public.base_staff_days_off TO service_role;
CREATE POLICY base_staff_days_off_owner_read ON public.base_staff_days_off
  FOR SELECT TO authenticated USING (private.base_production_core_access(org_id));

CREATE OR REPLACE FUNCTION public.set_base_staff_day_off(p_worker_id uuid, p_off_date date, p_off boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
  v_worker public.base_production_workers%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  SELECT org_id INTO v_org FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF v_org IS NULL OR NOT private.base_production_core_access(v_org)
     OR EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org AND is_locked_down) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;
  IF p_worker_id IS NULL OR p_off_date IS NULL OR p_off IS NULL THEN
    RAISE EXCEPTION 'Choose a worker and a day.' USING ERRCODE = '22023';
  END IF;

  -- Same order as payment and period completion, so a day cannot change
  -- while that worker is being paid or the period is being completed.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text || ':base-incentives', 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text || ':base-payroll:' || p_worker_id::text, 0));

  SELECT * INTO v_worker FROM public.base_production_workers WHERE org_id = v_org AND id = p_worker_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Worker not found' USING ERRCODE = '23503'; END IF;
  IF v_worker.pay_type IS DISTINCT FROM 'fixed_monthly' THEN
    RAISE EXCEPTION 'Days off apply to fixed-salary staff only.' USING ERRCODE = '22023';
  END IF;
  IF p_off_date > v_today THEN
    RAISE EXCEPTION 'A day can be marked off only once it has arrived.' USING ERRCODE = '22023';
  END IF;
  IF v_worker.start_date IS NULL OR p_off_date < v_worker.start_date
     OR (v_worker.end_date IS NOT NULL AND p_off_date > v_worker.end_date) THEN
    RAISE EXCEPTION 'This day is outside the worker''s employment dates.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.base_payroll_settlements
             WHERE org_id = v_org AND worker_id = p_worker_id AND status = 'paid' AND period_end >= p_off_date) THEN
    RAISE EXCEPTION 'This day is already paid. Reverse the payment to change it.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.base_payroll_periods
             WHERE org_id = v_org AND status = 'settled' AND period_start <= p_off_date AND period_end >= p_off_date) THEN
    RAISE EXCEPTION 'Reopen the completed payroll period before changing this day.' USING ERRCODE = '22023';
  END IF;

  IF p_off THEN
    INSERT INTO public.base_staff_days_off(org_id, worker_id, off_date, created_by)
    VALUES (v_org, p_worker_id, p_off_date, auth.uid())
    ON CONFLICT (org_id, worker_id, off_date) DO NOTHING;
  ELSE
    DELETE FROM public.base_staff_days_off WHERE org_id = v_org AND worker_id = p_worker_id AND off_date = p_off_date;
  END IF;
  RETURN jsonb_build_object('worker_id', p_worker_id, 'off_date', p_off_date, 'off', p_off);
END;
$$;
REVOKE ALL ON FUNCTION public.set_base_staff_day_off(uuid, date, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_base_staff_day_off(uuid, date, boolean) TO authenticated;

-- private.base_salary_lines minus the worker's days off in each segment.
-- Callers still clamp p_start and p_end to the employment dates.
CREATE OR REPLACE FUNCTION private.base_staff_salary_lines(p_org uuid, p_worker uuid, p_start date, p_end date)
RETURNS TABLE(period_start date, period_end date, monthly_salary numeric, paid_days integer, month_days integer, off_days integer, gross_pay numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT line.period_start, line.period_end, line.monthly_salary, line.paid_days - off.days, line.month_days, off.days,
    round(line.monthly_salary * (line.paid_days - off.days) / line.month_days, 2)
  FROM public.base_production_workers AS worker
  CROSS JOIN LATERAL private.base_salary_lines(worker.salary_history, p_start, p_end) AS line
  CROSS JOIN LATERAL (
    SELECT count(*)::integer AS days FROM public.base_staff_days_off AS day_off
    WHERE day_off.org_id = p_org AND day_off.worker_id = p_worker
      AND day_off.off_date BETWEEN line.period_start AND line.period_end
  ) AS off
  WHERE worker.org_id = p_org AND worker.id = p_worker
  ORDER BY line.period_start;
$$;
REVOKE ALL ON FUNCTION private.base_staff_salary_lines(uuid, uuid, date, date) FROM PUBLIC, anon, authenticated, service_role;

-- Switch the payroll writer and its snapshot to the days-off lines. Assert each
-- anchor appears exactly once so schema drift fails loudly, not partially.
DO $migration$
DECLARE definition text; anchor text;
BEGIN
  definition := pg_get_functiondef('public.settle_base_worker_payroll(uuid,date,text)'::regprocedure);
  anchor := 'FROM private.base_salary_lines(' || chr(10) || '      v_salary_worker.salary_history, ';
  IF (length(definition) - length(replace(definition, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'Unexpected fixed-salary payroll gross';
  END IF;
  definition := replace(definition, anchor, 'FROM private.base_staff_salary_lines(' || chr(10) || '      v_org_id, p_worker_id, ');
  EXECUTE definition;

  definition := pg_get_functiondef('private.capture_base_payroll_settlement_lines()'::regprocedure);
  anchor := 'FROM private.base_salary_lines(v_worker.salary_history, ';
  IF (length(definition) - length(replace(definition, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'Unexpected fixed-salary snapshot source';
  END IF;
  definition := replace(definition, anchor, 'FROM private.base_staff_salary_lines(NEW.org_id, NEW.worker_id, ');
  anchor := 'line.month_days::text || '' days)''';
  IF (length(definition) - length(replace(definition, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION 'Unexpected fixed-salary snapshot label';
  END IF;
  definition := replace(definition, anchor,
    'line.month_days::text || '' days'' || CASE WHEN line.off_days > 0 THEN '', '' || line.off_days::text || '' off'' ELSE '''' END || '')''');
  EXECUTE definition;
END;
$migration$;
