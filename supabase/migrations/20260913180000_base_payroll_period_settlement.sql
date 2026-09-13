-- ============================================================
-- MIGRATION: Base Payroll Pay-Period Settlement Workflow
-- 1. Base Payroll Periods table (period lifecycle and immutable snapshot)
-- 2. Settlements note and period association
-- 3. Atomicity & completion RPCs with advisory locks
-- ============================================================

-- 1. Base Payroll Periods Table
CREATE TABLE IF NOT EXISTS public.base_payroll_periods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    period_start date NOT NULL,
    period_end date NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'ready_to_complete', 'settled')),
    total_gross numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_gross >= 0),
    total_recovery numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_recovery >= 0),
    total_net numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_net >= 0),
    total_workers integer NOT NULL DEFAULT 0 CHECK (total_workers >= 0),
    paid_workers integer NOT NULL DEFAULT 0 CHECK (paid_workers >= 0),
    settled_at timestamptz,
    settled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    calculation_snapshot jsonb,
    resolved_worker_ids text[] DEFAULT '{}',
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, period_start, period_end),
    CONSTRAINT base_payroll_periods_dates_check CHECK (period_start <= period_end)
);

CREATE INDEX IF NOT EXISTS idx_base_payroll_periods_org_dates
    ON public.base_payroll_periods (org_id, period_start, period_end);

ALTER TABLE public.base_payroll_periods ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.base_payroll_periods FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.base_payroll_periods TO authenticated;

DROP POLICY IF EXISTS base_payroll_periods_owner_read ON public.base_payroll_periods;
CREATE POLICY base_payroll_periods_owner_read
    ON public.base_payroll_periods
    FOR SELECT TO authenticated
    USING (private.base_production_core_access(org_id));

DROP POLICY IF EXISTS base_payroll_periods_owner_write ON public.base_payroll_periods;
CREATE POLICY base_payroll_periods_owner_write
    ON public.base_payroll_periods
    FOR ALL TO authenticated
    USING (private.base_production_core_access(org_id))
    WITH CHECK (private.base_production_core_access(org_id));

-- 2. Settlements note and period reference
ALTER TABLE public.base_payroll_settlements
    ADD COLUMN IF NOT EXISTS note text,
    ADD COLUMN IF NOT EXISTS payroll_period_id uuid REFERENCES public.base_payroll_periods(id) ON DELETE SET NULL;

-- 3. Complete Payroll Period RPC
CREATE OR REPLACE FUNCTION public.complete_base_payroll_period(
    p_period_start date,
    p_period_end date,
    p_calculation_snapshot jsonb,
    p_resolved_worker_ids text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
    v_org_id uuid;
    v_period_id uuid;
    v_total_gross numeric := 0;
    v_total_recovery numeric := 0;
    v_total_net numeric := 0;
    v_paid_count integer := 0;
    v_existing_status text;
BEGIN
    SELECT profile.org_id INTO v_org_id
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid() AND profile.role::text = 'owner';

    IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
        RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
    END IF;

    IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_start > p_period_end THEN
        RAISE EXCEPTION 'A valid pay period is required' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_org_id::text || ':base-payroll-period:' || p_period_start::text || ':' || p_period_end::text, 0)
    );

    SELECT id, status INTO v_period_id, v_existing_status
    FROM public.base_payroll_periods
    WHERE org_id = v_org_id AND period_start = p_period_start AND period_end = p_period_end;

    IF v_existing_status = 'settled' THEN
        RETURN jsonb_build_object('success', true, 'period_id', v_period_id, 'idempotent', true);
    END IF;

    -- Aggregate totals from active settlements in this period
    SELECT
        COALESCE(SUM(gross_pay), 0),
        COALESCE(SUM(advance_deducted), 0),
        COALESCE(SUM(net_payout), 0),
        COUNT(DISTINCT worker_id)
    INTO v_total_gross, v_total_recovery, v_total_net, v_paid_count
    FROM public.base_payroll_settlements
    WHERE org_id = v_org_id
      AND period_end = p_period_end
      AND status = 'paid';

    INSERT INTO public.base_payroll_periods (
        org_id, period_start, period_end, status,
        total_gross, total_recovery, total_net,
        total_workers, paid_workers,
        settled_at, settled_by, calculation_snapshot, resolved_worker_ids, updated_at
    )
    VALUES (
        v_org_id, p_period_start, p_period_end, 'settled',
        v_total_gross, v_total_recovery, v_total_net,
        COALESCE(jsonb_array_length(p_calculation_snapshot->'workers'), v_paid_count),
        v_paid_count,
        now(), auth.uid(), p_calculation_snapshot, p_resolved_worker_ids, now()
    )
    ON CONFLICT (org_id, period_start, period_end) DO UPDATE
    SET status = 'settled',
        total_gross = EXCLUDED.total_gross,
        total_recovery = EXCLUDED.total_recovery,
        total_net = EXCLUDED.total_net,
        total_workers = EXCLUDED.total_workers,
        paid_workers = EXCLUDED.paid_workers,
        settled_at = now(),
        settled_by = auth.uid(),
        calculation_snapshot = EXCLUDED.calculation_snapshot,
        resolved_worker_ids = EXCLUDED.resolved_worker_ids,
        updated_at = now()
    RETURNING id INTO v_period_id;

    -- Associate settlements with the period
    UPDATE public.base_payroll_settlements
    SET payroll_period_id = v_period_id
    WHERE org_id = v_org_id AND period_end = p_period_end AND status = 'paid';

    RETURN jsonb_build_object(
        'success', true,
        'period_id', v_period_id,
        'status', 'settled',
        'total_gross', v_total_gross,
        'total_recovery', v_total_recovery,
        'total_net', v_total_net,
        'paid_workers', v_paid_count
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_base_payroll_period(date, date, jsonb, text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_base_payroll_period(date, date, jsonb, text[]) TO authenticated;

-- 4. Reopen Payroll Period RPC
CREATE OR REPLACE FUNCTION public.reopen_base_payroll_period(
    p_period_id uuid,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
    v_org_id uuid;
    v_period public.base_payroll_periods%ROWTYPE;
BEGIN
    SELECT profile.org_id INTO v_org_id
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid() AND profile.role::text = 'owner';

    IF v_org_id IS NULL OR NOT private.base_production_core_access(v_org_id) THEN
        RAISE EXCEPTION 'Base Production Core access is required' USING ERRCODE = '42501';
    END IF;

    IF p_reason IS NULL OR char_length(btrim(p_reason)) < 3 THEN
        RAISE EXCEPTION 'A reason for reopening is required.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_period
    FROM public.base_payroll_periods
    WHERE id = p_period_id AND org_id = v_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll period not found' USING ERRCODE = '23503';
    END IF;

    UPDATE public.base_payroll_periods
    SET status = 'in_progress',
        settled_at = NULL,
        settled_by = NULL,
        notes = COALESCE(notes || E'\n', '') || 'Reopened at ' || now()::text || ': ' || btrim(p_reason),
        updated_at = now()
    WHERE id = p_period_id AND org_id = v_org_id;

    RETURN jsonb_build_object('success', true, 'period_id', p_period_id, 'status', 'in_progress');
END;
$function$;

REVOKE ALL ON FUNCTION public.reopen_base_payroll_period(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_base_payroll_period(uuid, text) TO authenticated;

-- 5. Extend settle_base_worker_payroll_reviewed to record optional payment note
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
