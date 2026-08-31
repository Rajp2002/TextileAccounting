-- Original financial amounts and earning lines are never deleted or edited.
-- Reversal is a separate receipt, available only for the latest active payment.
ALTER TABLE public.base_payroll_settlements DROP CONSTRAINT base_payroll_settlements_status_check;
ALTER TABLE public.base_payroll_settlements ADD CONSTRAINT base_payroll_settlements_status_check CHECK (status IN ('paid', 'reversed'));
ALTER TABLE public.base_payroll_settlements ADD COLUMN recovery_receipt_complete boolean NOT NULL DEFAULT false;
DO $block$
DECLARE v_constraint text;
BEGIN
  SELECT conname INTO v_constraint FROM pg_constraint
  WHERE conrelid = 'public.base_payroll_settlements'::regclass AND contype = 'u'
    AND pg_get_constraintdef(oid) = 'UNIQUE (org_id, worker_id, period_start, period_end)';
  IF v_constraint IS NOT NULL THEN EXECUTE format('ALTER TABLE public.base_payroll_settlements DROP CONSTRAINT %I', v_constraint); END IF;
END;
$block$;
CREATE UNIQUE INDEX base_payroll_active_worker_period_unique ON public.base_payroll_settlements(org_id, worker_id, period_start, period_end) WHERE status = 'paid';

CREATE TABLE public.base_payroll_advance_recoveries (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  settlement_id uuid NOT NULL,
  advance_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  recovered_amount_before numeric(14,2) NOT NULL CHECK (recovered_amount_before >= 0),
  recovered_at_before timestamptz,
  recovered_period_before date,
  PRIMARY KEY (settlement_id, advance_id),
  FOREIGN KEY (org_id, settlement_id) REFERENCES public.base_payroll_settlements(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, advance_id) REFERENCES public.base_worker_advances(org_id, id) ON DELETE RESTRICT
);
CREATE INDEX base_payroll_advance_recoveries_advance_idx ON public.base_payroll_advance_recoveries(org_id, advance_id);
CREATE TABLE public.base_payroll_reversals (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  settlement_id uuid PRIMARY KEY,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 240),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, settlement_id) REFERENCES public.base_payroll_settlements(org_id, id) ON DELETE CASCADE
);
CREATE TABLE public.base_payroll_payment_requests (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  settlement_id uuid NOT NULL,
  payload jsonb NOT NULL,
  response jsonb NOT NULL,
  PRIMARY KEY (org_id, request_id),
  FOREIGN KEY (org_id, settlement_id) REFERENCES public.base_payroll_settlements(org_id, id) ON DELETE CASCADE
);
CREATE INDEX base_payroll_payment_requests_settlement_idx ON public.base_payroll_payment_requests(org_id, settlement_id);
ALTER TABLE public.base_payroll_advance_recoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_payroll_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_payroll_payment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.base_payroll_advance_recoveries, public.base_payroll_reversals, public.base_payroll_payment_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.base_payroll_reversals TO authenticated;
CREATE POLICY base_payroll_reversals_owner_read ON public.base_payroll_reversals FOR SELECT TO authenticated USING (private.base_production_core_access(org_id));

CREATE OR REPLACE FUNCTION public.reverse_base_payroll_settlement(p_settlement_id uuid, p_reason text, p_payment_not_made boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_org_id uuid;
  v_settlement public.base_payroll_settlements%ROWTYPE;
  v_recovery record;
  v_recorded_recovery numeric;
BEGIN
  SELECT org_id INTO v_org_id FROM public.profiles WHERE id = auth.uid() AND role::text = 'owner';
  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;
  IF p_payment_not_made IS DISTINCT FROM true OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Confirm that payment was not made and explain the recording mistake.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_settlement FROM public.base_payroll_settlements WHERE org_id = v_org_id AND id = p_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found' USING ERRCODE = '23503'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':base-payroll:' || v_settlement.worker_id::text, 0));
  SELECT * INTO v_settlement FROM public.base_payroll_settlements WHERE org_id = v_org_id AND id = p_settlement_id FOR UPDATE;
  IF v_settlement.status = 'reversed' THEN RETURN jsonb_build_object('settlement_id', p_settlement_id, 'idempotent', true); END IF;
  IF EXISTS (SELECT 1 FROM public.base_payroll_settlements WHERE org_id = v_org_id AND worker_id = v_settlement.worker_id AND status = 'paid' AND period_end > v_settlement.period_end) THEN
    RAISE EXCEPTION 'A later settlement depends on this record. Resolve the latest settlement first.' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO v_recorded_recovery FROM public.base_payroll_advance_recoveries WHERE org_id = v_org_id AND settlement_id = p_settlement_id;
  IF v_recorded_recovery <> v_settlement.advance_deducted THEN
    RAISE EXCEPTION 'This older settlement has no complete per-advance recovery receipt. It cannot be safely reversed automatically.' USING ERRCODE = '22023';
  END IF;
  FOR v_recovery IN SELECT * FROM public.base_payroll_advance_recoveries WHERE org_id = v_org_id AND settlement_id = p_settlement_id ORDER BY advance_id LOOP
    UPDATE public.base_worker_advances SET recovered_amount = recovered_amount - v_recovery.amount,
      status = 'pending', recovered_at = v_recovery.recovered_at_before, last_recovered_period_end = v_recovery.recovered_period_before
    WHERE org_id = v_org_id AND id = v_recovery.advance_id AND recovered_amount = v_recovery.recovered_amount_before + v_recovery.amount;
    IF NOT FOUND THEN RAISE EXCEPTION 'Advance history changed. No reversal was recorded.' USING ERRCODE = '40001'; END IF;
  END LOOP;
  INSERT INTO public.base_payroll_reversals(org_id, settlement_id, reason, created_by) VALUES (v_org_id, p_settlement_id, btrim(p_reason), auth.uid());
  UPDATE public.base_payroll_settlements SET status = 'reversed' WHERE org_id = v_org_id AND id = p_settlement_id;
  UPDATE public.base_production_batches AS batch SET status = 'saved', updated_at = now(), updated_by = auth.uid()
  WHERE batch.org_id = v_org_id AND batch.status = 'finalized'
    AND batch.production_date BETWEEN v_settlement.period_start AND v_settlement.period_end
    AND NOT EXISTS (
      SELECT 1 FROM public.base_daily_production_entries AS entry JOIN public.base_payroll_settlements AS paid
      ON paid.org_id = entry.org_id AND paid.worker_id = entry.worker_id AND paid.status = 'paid'
        AND batch.production_date BETWEEN paid.period_start AND paid.period_end
      WHERE entry.org_id = batch.org_id AND entry.batch_id = batch.id
    );
  RETURN jsonb_build_object('settlement_id', p_settlement_id, 'idempotent', false);
END;
$function$;
REVOKE ALL ON FUNCTION public.reverse_base_payroll_settlement(uuid, text, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_base_payroll_settlement(uuid, text, boolean) TO authenticated;


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
    AND settlement.status = 'paid'
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
    AND settlement.status = 'paid'
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
    AND settlement.status = 'paid'
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
    SELECT advance.id, advance.amount, advance.recovered_amount, advance.recovered_at, advance.last_recovered_period_end
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

    INSERT INTO public.base_payroll_advance_recoveries(org_id, settlement_id, advance_id, amount, recovered_amount_before, recovered_at_before, recovered_period_before)
    VALUES (v_org_id, v_settlement_id, v_advance.id, v_recover_now, v_advance.recovered_amount, v_advance.recovered_at, v_advance.last_recovered_period_end);
    v_budget := v_budget - v_recover_now;
  END LOOP;

  UPDATE public.base_payroll_settlements SET recovery_receipt_complete = true WHERE org_id = v_org_id AND id = v_settlement_id;

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
  v_request_id uuid;
  v_request public.base_payroll_payment_requests%ROWTYPE;
  v_payload jsonb;
  v_status text;
BEGIN
  SELECT org_id INTO v_org_id FROM public.profiles
  WHERE id = auth.uid() AND role::text = 'owner';
  IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
    RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
  END IF;
  IF p_expected IS NULL OR jsonb_typeof(p_expected) <> 'object'
     OR NOT p_expected ?& ARRAY['client_request_id', 'period_start', 'gross_pay', 'advance_deducted', 'net_payout', 'advance_balance_before'] THEN
    RAISE EXCEPTION 'Review the worker payroll before payment' USING ERRCODE = '22023';
  END IF;

  v_request_id := (p_expected ->> 'client_request_id')::uuid;
  IF v_request_id IS NULL THEN RAISE EXCEPTION 'A payment request identifier is required' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':base-payroll:' || p_worker_id::text, 0));
  v_payload := jsonb_build_object('worker_id', p_worker_id, 'period_end', p_period_end, 'payment_mode', p_payment_mode, 'expected', p_expected);
  SELECT * INTO v_request FROM public.base_payroll_payment_requests WHERE org_id = v_org_id AND request_id = v_request_id;
  IF FOUND THEN
    SELECT status INTO v_status FROM public.base_payroll_settlements WHERE org_id = v_org_id AND id = v_request.settlement_id;
    IF v_status = 'reversed' THEN RAISE EXCEPTION 'This payment request was reversed. Reload payroll before recording another payment.' USING ERRCODE = '40001'; END IF;
    IF v_request.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'This payment request already recorded different details. Reload payroll.' USING ERRCODE = '40001'; END IF;
    RETURN v_request.response || jsonb_build_object('idempotent', true);
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
  INSERT INTO public.base_payroll_payment_requests(org_id, request_id, settlement_id, payload, response)
  VALUES (v_org_id, v_request_id, (v_result ->> 'settlement_id')::uuid, v_payload, v_result);
  RETURN v_result;
END;
$function$;


-- Preserve paid source rows byte-for-byte while correcting unpaid coworkers.
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
  v_paid_entry public.base_daily_production_entries%ROWTYPE;
  v_paid_allocations jsonb;
  v_payload_allocations jsonb;
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
    AND batch_id = v_batch_id
    AND NOT EXISTS (SELECT 1 FROM public.base_payroll_settlements AS paid
      WHERE paid.org_id = v_org_id AND paid.worker_id = base_daily_production_entries.worker_id
        AND paid.status = 'paid' AND p_production_date <= paid.period_end);

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
    IF EXISTS (SELECT 1 FROM public.base_payroll_settlements AS paid
      WHERE paid.org_id = v_org_id AND paid.worker_id = v_row.worker_id
        AND paid.status = 'paid' AND p_production_date <= paid.period_end) THEN
      SELECT * INTO v_paid_entry FROM public.base_daily_production_entries
      WHERE org_id = v_org_id AND batch_id = v_batch_id AND worker_id = v_row.worker_id;
      IF NOT FOUND THEN
        -- A placeholder is not new production; paid workers may appear in the
        -- shift roster without having an entry in this particular batch.
        IF v_row.entry_status = 'blank' AND v_row.meters IS NULL AND jsonb_array_length(v_row.allocations) = 0 THEN CONTINUE; END IF;
        RAISE EXCEPTION 'This worker has settled pay through this date. New backdated work requires a payroll adjustment.' USING ERRCODE = '22023';
      END IF;
      SELECT COALESCE(jsonb_agg(jsonb_build_object('machine_id', machine_id, 'job_id', job_id, 'meters', meters) ORDER BY machine_id, job_id), '[]'::jsonb)
      INTO v_paid_allocations FROM public.base_daily_production_allocations WHERE org_id = v_org_id AND entry_id = v_paid_entry.id;
      SELECT COALESCE(jsonb_agg(jsonb_build_object('machine_id', machine_id, 'job_id', job_id, 'meters', meters) ORDER BY machine_id, job_id), '[]'::jsonb)
      INTO v_payload_allocations FROM jsonb_to_recordset(v_row.allocations) AS payload(machine_id uuid, job_id uuid, meters numeric);
      IF v_paid_entry.meters IS DISTINCT FROM v_row.meters
        OR v_paid_entry.entry_status IS DISTINCT FROM v_row.entry_status
        OR NULLIF(btrim(v_paid_entry.notes), '') IS DISTINCT FROM v_row.notes
        OR v_paid_allocations IS DISTINCT FROM v_payload_allocations THEN
        RAISE EXCEPTION 'Paid worker entries are protected. Only unpaid worker entries can be corrected.' USING ERRCODE = '22023';
      END IF;
      CONTINUE;
    END IF;
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

  SELECT COALESCE(SUM(COALESCE(meters, 0)), 0), COUNT(*) FILTER (WHERE entry_status = 'entered'),
    COUNT(*) FILTER (WHERE entry_status = 'zero'), COUNT(*) FILTER (WHERE entry_status = 'absent')
  INTO v_batch_total_meters, v_entered_count, v_zero_count, v_absent_count
  FROM public.base_daily_production_entries WHERE org_id = v_org_id AND batch_id = v_batch_id;

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

-- Older authenticated write entrypoints remain until the app cutover migration.

-- Legacy job-entry inserts must obey the same payroll boundary as daily sheets.
-- Otherwise backdated work could disappear behind a settled period.
CREATE OR REPLACE FUNCTION private.guard_base_legacy_payroll_boundary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.org_id::text || ':base-payroll:' || NEW.worker_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.base_payroll_settlements
    WHERE org_id = NEW.org_id AND worker_id = NEW.worker_id AND status = 'paid' AND period_end >= NEW.production_date) THEN
    RAISE EXCEPTION 'This worker has settled pay through this date. New backdated work requires a payroll adjustment.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.guard_base_legacy_payroll_boundary() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER base_legacy_payroll_boundary BEFORE INSERT ON public.base_production_entries
FOR EACH ROW EXECUTE FUNCTION private.guard_base_legacy_payroll_boundary();
