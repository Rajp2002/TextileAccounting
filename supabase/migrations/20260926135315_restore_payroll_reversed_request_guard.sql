-- Fix package F2 (OS-4): restore the reversed-request guard on reviewed
-- payroll payments.
--
-- 20260901110004 refused a re-sent payment request once its settlement was
-- reversed. 20260913180000 re-created this function to add p_note but dropped
-- the request identifier and the request mapping, so re-sending the original
-- request after a reversal paid the worker again.
--
-- This re-creates the 20260913180000 definition with three edits: the request
-- identifier is required again (the app always sends one), a request whose
-- settlement was reversed is refused, and each request is mapped to its
-- settlement. Requests settled while the guard was missing have no mapping and
-- are not covered. Signature, security, search_path and grants are unchanged.

CREATE OR REPLACE FUNCTION public.settle_base_worker_payroll_reviewed(
  p_worker_id uuid,
  p_period_end date,
  p_payment_mode text,
  p_expected jsonb,
  p_note text DEFAULT NULL
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
  v_settlement_id uuid;
  v_request_id uuid;
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

  -- A request whose payment was reversed must not pay again when re-sent.
  v_request_id := (p_expected ->> 'client_request_id')::uuid;
  IF v_request_id IS NULL THEN RAISE EXCEPTION 'A payment request identifier is required' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':base-payroll:' || p_worker_id::text, 0));
  IF EXISTS (
    SELECT 1
    FROM public.base_payroll_payment_requests AS request
    JOIN public.base_payroll_settlements AS settlement
      ON settlement.org_id = request.org_id AND settlement.id = request.settlement_id
    WHERE request.org_id = v_org_id AND request.request_id = v_request_id
      AND settlement.status = 'reversed'
  ) THEN
    RAISE EXCEPTION 'This payment request was reversed. Reload payroll before recording another payment.' USING ERRCODE = '40001';
  END IF;

  v_result := public.settle_base_worker_payroll(p_worker_id, p_period_end, p_payment_mode);
  v_settlement_id := (v_result ->> 'settlement_id')::uuid;

  SELECT jsonb_build_object(
    'period_start', settlement.period_start,
    'gross_pay', settlement.gross_pay,
    'advance_deducted', settlement.advance_deducted,
    'net_payout', settlement.net_payout,
    'advance_balance_before', settlement.advance_balance_before
  ) INTO v_actual
  FROM public.base_payroll_settlements AS settlement
  WHERE settlement.id = v_settlement_id
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

  IF p_note IS NOT NULL AND btrim(p_note) <> '' THEN
    UPDATE public.base_payroll_settlements
    SET note = btrim(p_note)
    WHERE id = v_settlement_id AND org_id = v_org_id;
  END IF;

  INSERT INTO public.base_payroll_payment_requests(org_id, request_id, settlement_id, payload, response)
  VALUES (
    v_org_id, v_request_id, v_settlement_id,
    jsonb_build_object('worker_id', p_worker_id, 'period_end', p_period_end, 'payment_mode', p_payment_mode, 'expected', p_expected),
    v_result
  )
  ON CONFLICT (org_id, request_id) DO NOTHING;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_base_worker_payroll_reviewed(uuid, date, text, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_base_worker_payroll_reviewed(uuid, date, text, jsonb, text) TO authenticated;
