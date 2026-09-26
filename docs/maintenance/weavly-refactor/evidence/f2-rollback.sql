-- ROLLBACK for fix package F2 (not a migration; run only if F2's schema change
-- must be undone). Restores settle_base_worker_payroll_reviewed exactly as
-- 20260913180000 defined it (md5(prosrc) 74d7e947012ae1d129959c9fda6acd95),
-- which removes the OS-4 reversed-request guard again. Rows already written to
-- base_payroll_payment_requests are harmless and are kept. The version below
-- is the one recorded in production on 2026-09-26.
BEGIN;
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

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_base_worker_payroll_reviewed(uuid, date, text, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_base_worker_payroll_reviewed(uuid, date, text, jsonb, text) TO authenticated;
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260926135315';
COMMIT;
-- The F2 application changes (AS-01, CS-3) roll back by reverting the commit.
