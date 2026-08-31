-- Keep outstanding earnings across month/year boundaries.
-- Apply after the existing Base history/readiness migrations.

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

  SELECT COALESCE((MAX(settlement.period_end) + 1)::date, LEAST(
    date_trunc('month', p_period_end)::date,
    (SELECT MIN(source.production_date) FROM (
      SELECT entry.production_date FROM public.base_production_entries AS entry
      WHERE entry.org_id = v_org_id AND entry.worker_id = p_worker_id AND entry.meters > 0
      UNION ALL
      SELECT batch.production_date FROM public.base_daily_production_entries AS daily
      JOIN public.base_production_batches AS batch ON batch.org_id = daily.org_id AND batch.id = daily.batch_id
      WHERE daily.org_id = v_org_id AND daily.worker_id = p_worker_id
        AND daily.entry_status = 'entered' AND daily.meters > 0
    ) AS source WHERE source.production_date <= p_period_end)
  ))
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

-- The old writer keeps its signature for safe database-first rollout. New
-- clients must send the exact reviewed values. Raising here rolls back the
-- settlement, captured lines, finalization and advance recovery together.
CREATE OR REPLACE FUNCTION public.settle_base_worker_payroll_reviewed(
  p_worker_id uuid,
  p_period_end date,
  p_payment_mode text,
  p_expected jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_result jsonb;
  v_actual jsonb;
  v_key text;
BEGIN
  SELECT org_id INTO v_org_id FROM public.profiles
  WHERE id = auth.uid() AND role::text = 'owner';
  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;
  IF p_expected IS NULL OR jsonb_typeof(p_expected) <> 'object'
     OR NOT p_expected ?& ARRAY['period_start', 'gross_pay', 'advance_deducted', 'net_payout', 'advance_balance_before'] THEN
    RAISE EXCEPTION 'Review the worker payroll before payment' USING ERRCODE = '22023';
  END IF;

  v_result := public.settle_base_worker_payroll(p_worker_id, p_period_end, p_payment_mode);
  SELECT jsonb_build_object(
    'period_start', settlement.period_start,
    'gross_pay', settlement.gross_pay,
    'advance_deducted', settlement.advance_deducted,
    'net_payout', settlement.net_payout,
    'advance_balance_before', settlement.advance_balance_before
  ) INTO v_actual
  FROM public.base_payroll_settlements AS settlement
  WHERE settlement.id = (v_result ->> 'settlement_id')::uuid
    AND settlement.org_id = v_org_id AND settlement.worker_id = p_worker_id;

  IF (v_actual ->> 'period_start') IS DISTINCT FROM (p_expected ->> 'period_start') THEN
    RAISE EXCEPTION 'Payroll changed since review. Reload and review the updated period before payment.' USING ERRCODE = '40001';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['gross_pay', 'advance_deducted', 'net_payout', 'advance_balance_before'] LOOP
    IF jsonb_typeof(p_expected -> v_key) IS DISTINCT FROM 'number'
       OR (v_actual ->> v_key)::numeric IS DISTINCT FROM (p_expected ->> v_key)::numeric THEN
      RAISE EXCEPTION 'Payroll changed since review. Reload and review the updated amounts before payment.' USING ERRCODE = '40001';
    END IF;
  END LOOP;
  IF (v_result ->> 'payment_mode') IS DISTINCT FROM p_payment_mode THEN
    RAISE EXCEPTION 'This worker already has a payment recorded with another payment method. Open Payroll records.' USING ERRCODE = '40001';
  END IF;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_base_worker_payroll_reviewed(uuid, date, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_base_worker_payroll_reviewed(uuid, date, text, jsonb) TO authenticated;
