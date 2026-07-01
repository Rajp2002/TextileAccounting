-- Batch 20: payroll RPC hardening and Kharchi atomicity.
--
-- Safety:
-- - Does not mutate business data.
-- - Revokes direct authenticated execution from legacy payroll bypass RPCs.
-- - Adds narrow checked wrappers for settlement, reversal, and supervisor Kharchi.

-- ---------------------------------------------------------------------------
-- Payroll RPC authorization helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_payroll_owner_actor(
  p_org_id UUID,
  p_actor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_org_id UUID := NULLIF(auth.jwt() ->> 'org_id', '')::uuid;
  v_role TEXT := auth.jwt() ->> 'user_role';
BEGIN
  IF v_actor_id IS NULL
     OR p_actor_id IS NULL
     OR p_actor_id IS DISTINCT FROM v_actor_id
     OR p_org_id IS NULL
     OR p_org_id IS DISTINCT FROM v_org_id
     OR v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'owner authorization is required for payroll mutation'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_org_not_locked(p_org_id);
END;
$$;

REVOKE ALL ON FUNCTION public.assert_payroll_owner_actor(UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_payroll_reversal_access_code(
  p_org_id UUID,
  p_actor_id UUID,
  p_access_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code TEXT := UPPER(BTRIM(COALESCE(p_access_code, '')));
  v_access_code_hash TEXT;
  v_access_code_expires_at TIMESTAMPTZ;
  v_input_hash TEXT;
  v_consumed_org_id UUID;
BEGIN
  PERFORM public.assert_payroll_owner_actor(p_org_id, p_actor_id);

  IF v_code !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid or expired access code.'
      USING ERRCODE = '42501';
  END IF;

  SELECT o.access_code_hash, o.access_code_expires_at
  INTO v_access_code_hash, v_access_code_expires_at
  FROM public.organizations o
  WHERE o.id = p_org_id
  FOR UPDATE;

  IF v_access_code_hash IS NULL
     OR v_access_code_expires_at IS NULL
     OR v_access_code_expires_at < NOW()
     OR v_access_code_hash !~* '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid or expired access code.'
      USING ERRCODE = '42501';
  END IF;

  v_input_hash := ENCODE(digest(v_code, 'sha256'), 'hex');

  IF LOWER(v_access_code_hash) IS DISTINCT FROM v_input_hash THEN
    RAISE EXCEPTION 'Invalid or expired access code.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.organizations
  SET access_code_hash = NULL,
      access_code_expires_at = NULL,
      last_code_plain = NULL
  WHERE id = p_org_id
    AND access_code_hash = v_access_code_hash
  RETURNING id INTO v_consumed_org_id;

  IF v_consumed_org_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired access code.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.actor_id', p_actor_id::text, true);
  PERFORM set_config('app.access_code_used', 'true', true);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_payroll_reversal_access_code(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Revoke legacy payroll bypass overloads
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_identity TEXT;
BEGIN
  FOREACH v_identity IN ARRAY ARRAY[
    'public.settle_worker_payroll(uuid,text,bigint,text,numeric)',
    'public.settle_worker_payroll(uuid,text,bigint,text,numeric,boolean)',
    'public.settle_worker_payroll(uuid,text,bigint,text,numeric,boolean,uuid)',
    'public.settle_worker_payroll(uuid,text,bigint,text,numeric,boolean,numeric)',
    'public.settle_worker_payroll(uuid,text,bigint,date,numeric,boolean,numeric)',
    'public.settle_worker_payroll(uuid,text,bigint,date,numeric,boolean,numeric,uuid)',
    'public.settle_worker_payroll(uuid,text,bigint,date,numeric,boolean,numeric,uuid,text)',
    'public.settle_worker_payroll(uuid,text,bigint,date,numeric,boolean,numeric,uuid,text,jsonb,boolean)',
    'public.unsettle_worker_payroll(uuid,text,bigint,text)',
    'public.unsettle_worker_payroll(uuid,text,bigint,text,uuid)'
  ]
  LOOP
    IF to_regprocedure(v_identity) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', v_identity);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Hardened payroll RPC wrappers
-- ---------------------------------------------------------------------------

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

  PERFORM set_config('app.actor_id', p_actor_id::text, true);

  RETURN public.settle_worker_payroll(
    p_org_id,
    p_worker_type,
    p_worker_id,
    p_cycle_start,
    p_gross_amount,
    p_is_final_settlement,
    p_manual_deduction_override,
    p_actor_id,
    p_payment_mode,
    p_manual_adjustments,
    p_verified_by_owner
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_worker_payroll_hardened(UUID, TEXT, BIGINT, DATE, NUMERIC, BOOLEAN, NUMERIC, UUID, TEXT, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_worker_payroll_hardened(UUID, TEXT, BIGINT, DATE, NUMERIC, BOOLEAN, NUMERIC, UUID, TEXT, JSONB, BOOLEAN) TO authenticated;

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

  IF COALESCE((v_result ->> 'success')::boolean, false) THEN
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
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.unsettle_worker_payroll_hardened(UUID, TEXT, BIGINT, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unsettle_worker_payroll_hardened(UUID, TEXT, BIGINT, TEXT, UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Atomic supervisor Kharchi RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_supervisor_kharchi(
  p_worker_type TEXT,
  p_worker_id BIGINT,
  p_amount NUMERIC,
  p_description TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_org_id UUID := NULLIF(auth.jwt() ->> 'org_id', '')::uuid;
  v_role TEXT := auth.jwt() ->> 'user_role';
  v_cycle_start_day INT := 1;
  v_today DATE := CURRENT_DATE;
  v_cycle_start_date DATE;
  v_existing_settlement_status TEXT;
  v_balance NUMERIC := 0;
  v_advance_id BIGINT;
  v_float_transaction_id UUID;
  v_rolled_over BOOLEAN := false;
BEGIN
  IF v_actor_id IS NULL
     OR v_org_id IS NULL
     OR v_role NOT IN ('owner', 'supervisor') THEN
    RAISE EXCEPTION 'owner or supervisor authorization is required for kharchi'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_org_not_locked(v_org_id);

  IF p_worker_type NOT IN ('meter', 'fixed') THEN
    RAISE EXCEPTION 'invalid worker_type'
      USING ERRCODE = '23514';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'kharchi amount must be greater than zero'
      USING ERRCODE = '23514';
  END IF;

  IF p_worker_type = 'meter' THEN
    PERFORM 1
    FROM public.workers w
    WHERE w.id = p_worker_id
      AND w.org_id = v_org_id
      AND COALESCE(w.is_active, true) IS TRUE;
  ELSE
    PERFORM 1
    FROM public.fixed_workers fw
    WHERE fw.id = p_worker_id
      AND fw.org_id = v_org_id
      AND COALESCE(fw.is_active, true) IS TRUE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker not found for this organization.'
      USING ERRCODE = '23503';
  END IF;

  SELECT COALESCE(pc.cycle_start_day, 1)
  INTO v_cycle_start_day
  FROM public.payroll_configs pc
  WHERE pc.org_id = v_org_id;

  v_cycle_start_day := COALESCE(v_cycle_start_day, 1);

  IF EXTRACT(DAY FROM v_today)::int >= v_cycle_start_day THEN
    v_cycle_start_date := date_trunc('month', v_today)::date + (v_cycle_start_day - 1);
  ELSE
    v_cycle_start_date := (date_trunc('month', v_today)::date - INTERVAL '1 month')::date + (v_cycle_start_day - 1);
  END IF;

  SELECT ps.status
  INTO v_existing_settlement_status
  FROM public.payroll_settlements ps
  WHERE ps.org_id = v_org_id
    AND ps.cycle_start_date = v_cycle_start_date
    AND (
      (p_worker_type = 'meter' AND ps.meter_worker_id = p_worker_id)
      OR (p_worker_type = 'fixed' AND ps.fixed_worker_id = p_worker_id)
    )
  LIMIT 1;

  IF v_existing_settlement_status = 'paid' THEN
    v_cycle_start_date := (v_cycle_start_date + INTERVAL '1 month')::date;
    v_rolled_over := true;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':' || v_actor_id::text || ':kharchi', 0));

  SELECT COALESCE(SUM(
    CASE
      WHEN sft.type = 'refill' THEN sft.amount
      WHEN sft.type = 'disbursement' THEN -sft.amount
      ELSE 0
    END
  ), 0)
  INTO v_balance
  FROM public.supervisor_float_transactions sft
  WHERE sft.org_id = v_org_id
    AND sft.supervisor_id = v_actor_id;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient float balance.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.worker_advances (
    org_id,
    meter_worker_id,
    fixed_worker_id,
    amount,
    description,
    type,
    cycle_start_date,
    status
  )
  VALUES (
    v_org_id,
    CASE WHEN p_worker_type = 'meter' THEN p_worker_id ELSE NULL END,
    CASE WHEN p_worker_type = 'fixed' THEN p_worker_id ELSE NULL END,
    p_amount,
    NULLIF(BTRIM(COALESCE(p_description, '')), ''),
    'kharchi'::advance_type,
    v_cycle_start_date,
    'pending'
  )
  RETURNING id INTO v_advance_id;

  INSERT INTO public.supervisor_float_transactions (
    org_id,
    supervisor_id,
    type,
    amount,
    worker_advance_id
  )
  VALUES (
    v_org_id,
    v_actor_id,
    'disbursement',
    p_amount,
    v_advance_id
  )
  RETURNING id INTO v_float_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'advance_id', v_advance_id,
    'float_transaction_id', v_float_transaction_id,
    'rolled_over', v_rolled_over,
    'cycle_start_date', v_cycle_start_date,
    'balance_after', v_balance - p_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_supervisor_kharchi(TEXT, BIGINT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_supervisor_kharchi(TEXT, BIGINT, NUMERIC, TEXT) TO authenticated;
