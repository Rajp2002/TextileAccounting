-- B13 payroll settlement lifecycle hardening.
--
-- - Serialize first-time settlement by organization/worker/cycle and reject an
--   already-paid grain instead of upserting and re-deducting carry-forward debt.
-- - Protect deducted or settlement-linked advances from authenticated deletion.
-- - Provide an atomic exit-settlement boundary that deactivates the worker in
--   the same transaction as final payroll settlement.

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

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_org_id::text || ':payroll:' || p_worker_type || ':' || p_worker_id::text || ':' || p_cycle_start::text,
    0
  ));

  IF EXISTS (
    SELECT 1
    FROM public.payroll_settlements ps
    WHERE ps.org_id = p_org_id
      AND ps.worker_type = p_worker_type
      AND ps.cycle_start_date = p_cycle_start
      AND (
        (p_worker_type = 'meter' AND ps.meter_worker_id = p_worker_id)
        OR (p_worker_type = 'fixed' AND ps.fixed_worker_id = p_worker_id)
      )
  ) THEN
    RAISE EXCEPTION 'Payroll is already settled for this worker and cycle.'
      USING ERRCODE = '23505';
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

CREATE OR REPLACE FUNCTION public.protect_settled_worker_advance_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role'
     OR COALESCE(current_setting('app.payroll_reversal', true), '') = 'true' THEN
    RETURN OLD;
  END IF;

  IF OLD.status = 'deducted'
     OR OLD.settlement_id IS NOT NULL
     OR OLD.origin_settlement_id IS NOT NULL THEN
    RAISE EXCEPTION 'Deducted or settlement-linked advances cannot be deleted.'
      USING ERRCODE = '23503';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_settled_worker_advance_delete ON public.worker_advances;
CREATE TRIGGER trg_protect_settled_worker_advance_delete
  BEFORE DELETE ON public.worker_advances
  FOR EACH ROW EXECUTE FUNCTION public.protect_settled_worker_advance_delete();

CREATE OR REPLACE FUNCTION public.unsettle_worker_payroll_hardened(
  p_org_id UUID,
  p_worker_type TEXT,
  p_worker_id BIGINT,
  p_month TEXT,
  p_actor_id UUID,
  p_access_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public.consume_payroll_reversal_access_code(p_org_id, p_actor_id, p_access_code);
  PERFORM set_config('app.payroll_reversal', 'true', true);

  v_result := public.unsettle_worker_payroll(
    p_org_id,
    p_worker_type,
    p_worker_id,
    p_month,
    p_actor_id
  );

  IF NOT COALESCE((v_result ->> 'success')::boolean, false) THEN
    RAISE EXCEPTION '%', COALESCE(v_result ->> 'error', 'Failed to revert payment.')
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.audit_log (
    org_id,
    table_name,
    record_id,
    action,
    new_data,
    changed_by,
    is_access_code_used
  )
  VALUES (
    p_org_id,
    'payroll_settlements',
    p_worker_type || ':' || p_worker_id::text || ':' || p_month,
    'UPDATE',
    jsonb_build_object(
      'authorized_by_hardened_rpc', true,
      'worker_type', p_worker_type,
      'worker_id', p_worker_id,
      'month', p_month
    ),
    p_actor_id,
    true
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.unsettle_worker_payroll_hardened(UUID, TEXT, BIGINT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unsettle_worker_payroll_hardened(UUID, TEXT, BIGINT, TEXT, UUID, TEXT)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_exiting_worker_payroll_hardened(
  p_org_id UUID,
  p_worker_type TEXT,
  p_worker_id BIGINT,
  p_cycle_start DATE,
  p_gross_amount NUMERIC,
  p_is_final_settlement BOOLEAN DEFAULT true,
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
  v_result JSONB;
  v_deactivated_worker_id BIGINT;
BEGIN
  IF p_is_final_settlement IS NOT TRUE THEN
    RAISE EXCEPTION 'Exit settlement must be a final settlement.'
      USING ERRCODE = '23514';
  END IF;

  v_result := public.settle_worker_payroll_hardened(
    p_org_id,
    p_worker_type,
    p_worker_id,
    p_cycle_start,
    p_gross_amount,
    true,
    p_manual_deduction_override,
    p_actor_id,
    p_payment_mode,
    p_manual_adjustments,
    p_verified_by_owner
  );

  IF p_worker_type = 'meter' THEN
    UPDATE public.workers
    SET is_active = false
    WHERE org_id = p_org_id
      AND id = p_worker_id
    RETURNING id INTO v_deactivated_worker_id;
  ELSIF p_worker_type = 'fixed' THEN
    UPDATE public.fixed_workers
    SET is_active = false
    WHERE org_id = p_org_id
      AND id = p_worker_id
    RETURNING id INTO v_deactivated_worker_id;
  END IF;

  IF v_deactivated_worker_id IS NULL THEN
    RAISE EXCEPTION 'Worker not found for final settlement.'
      USING ERRCODE = '23503';
  END IF;

  RETURN v_result || jsonb_build_object(
    'worker_deactivated', true,
    'deactivated_worker_id', v_deactivated_worker_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_exiting_worker_payroll_hardened(UUID, TEXT, BIGINT, DATE, NUMERIC, BOOLEAN, NUMERIC, UUID, TEXT, JSONB, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_exiting_worker_payroll_hardened(UUID, TEXT, BIGINT, DATE, NUMERIC, BOOLEAN, NUMERIC, UUID, TEXT, JSONB, BOOLEAN)
  TO authenticated;
