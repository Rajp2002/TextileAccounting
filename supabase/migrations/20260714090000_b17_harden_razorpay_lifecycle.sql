-- B17: harden Razorpay webhook replay, out-of-order state, failed-to-captured
-- reconciliation, referral conversion, and provider-idempotent refunds.

ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS checkout_purchase_type text,
  ADD COLUMN IF NOT EXISTS checkout_amount_paise integer,
  ADD COLUMN IF NOT EXISTS checkout_currency text,
  ADD COLUMN IF NOT EXISTS provider_event_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_event_id text,
  ADD COLUMN IF NOT EXISTS provider_status_rank integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_subscriptions_checkout_purchase_type_check'
      AND conrelid = 'public.org_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.org_subscriptions
      ADD CONSTRAINT org_subscriptions_checkout_purchase_type_check
      CHECK (checkout_purchase_type IS NULL OR checkout_purchase_type IN ('initial_purchase', 'renewal'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_subscriptions_checkout_amount_check'
      AND conrelid = 'public.org_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.org_subscriptions
      ADD CONSTRAINT org_subscriptions_checkout_amount_check
      CHECK (checkout_amount_paise IS NULL OR checkout_amount_paise > 0)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_subscriptions_checkout_currency_check'
      AND conrelid = 'public.org_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.org_subscriptions
      ADD CONSTRAINT org_subscriptions_checkout_currency_check
      CHECK (checkout_currency IS NULL OR checkout_currency = 'INR')
      NOT VALID;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_subscriptions_razorpay_order_id_unique
  ON public.org_subscriptions (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_payments_captured_order_unique
  ON public.subscription_payments (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL AND status = 'captured';

ALTER TABLE public.referral_refunds
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_refunds_idempotency_key_unique
  ON public.referral_refunds (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Claim one webhook event atomically. Replays with the same event ID but a
-- different body/type are conflicts, while failed or stale work can retry.
CREATE OR REPLACE FUNCTION public.claim_razorpay_webhook_event(
  p_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_stale_after_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_event public.razorpay_webhook_events%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_stale_after interval;
BEGIN
  IF NULLIF(btrim(p_event_id), '') IS NULL
     OR NULLIF(btrim(p_event_type), '') IS NULL
     OR p_payload_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid Razorpay event claim.' USING ERRCODE = '22023';
  END IF;

  IF p_stale_after_seconds NOT BETWEEN 30 AND 3600 THEN
    RAISE EXCEPTION 'Invalid Razorpay stale-event window.' USING ERRCODE = '22023';
  END IF;
  v_stale_after := make_interval(secs => p_stale_after_seconds);

  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id, 0));
  SELECT event.* INTO v_event
  FROM public.razorpay_webhook_events AS event
  WHERE event.event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.razorpay_webhook_events (
      event_id, event_type, payload_hash, status, attempts, received_at, updated_at
    ) VALUES (
      p_event_id, p_event_type, p_payload_hash, 'processing', 1, v_now, v_now
    );
    RETURN jsonb_build_object('process', true, 'retry', false, 'attempts', 1);
  END IF;

  IF v_event.event_type IS DISTINCT FROM p_event_type
     OR v_event.payload_hash IS DISTINCT FROM p_payload_hash THEN
    RETURN jsonb_build_object('process', false, 'conflict', true, 'attempts', v_event.attempts);
  END IF;

  IF v_event.status = 'processed' THEN
    RETURN jsonb_build_object('process', false, 'duplicate', true, 'attempts', v_event.attempts);
  END IF;

  IF v_event.status = 'processing' AND v_event.updated_at > v_now - v_stale_after THEN
    RETURN jsonb_build_object('process', false, 'duplicate', true, 'attempts', v_event.attempts);
  END IF;

  UPDATE public.razorpay_webhook_events
  SET status = 'processing',
      attempts = attempts + 1,
      last_error = NULL,
      updated_at = v_now
  WHERE event_id = p_event_id
  RETURNING * INTO v_event;

  RETURN jsonb_build_object('process', true, 'retry', true, 'attempts', v_event.attempts);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_razorpay_webhook_event(text, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_razorpay_webhook_event(text, text, text, integer)
  TO service_role;

-- Apply subscription lifecycle snapshots monotonically by provider event time.
-- A newer recovery event may reactivate a halted subscription; an older event
-- can never regress the final state.
CREATE OR REPLACE FUNCTION public.apply_razorpay_subscription_event(
  p_razorpay_subscription_id text,
  p_status text,
  p_event_created_at timestamptz,
  p_event_id text,
  p_current_start timestamptz DEFAULT NULL,
  p_current_end timestamptz DEFAULT NULL,
  p_charge_at timestamptz DEFAULT NULL,
  p_paid_count integer DEFAULT NULL,
  p_remaining_count integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_subscription public.org_subscriptions%ROWTYPE;
  v_rank integer;
BEGIN
  IF NULLIF(btrim(p_razorpay_subscription_id), '') IS NULL
     OR p_event_created_at IS NULL
     OR NULLIF(btrim(p_event_id), '') IS NULL THEN
    RAISE EXCEPTION 'Missing Razorpay subscription event identity.' USING ERRCODE = '22023';
  END IF;

  v_rank := CASE p_status
    WHEN 'authenticated' THEN 20
    WHEN 'pending' THEN 30
    WHEN 'paused' THEN 40
    WHEN 'halted' THEN 50
    WHEN 'active' THEN 60
    WHEN 'cancelled' THEN 80
    WHEN 'completed' THEN 85
    WHEN 'expired' THEN 90
    ELSE NULL
  END;
  IF v_rank IS NULL THEN
    RAISE EXCEPTION 'Unsupported Razorpay subscription status.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_razorpay_subscription_id, 0));
  SELECT subscription.* INTO v_subscription
  FROM public.org_subscriptions AS subscription
  WHERE subscription.razorpay_subscription_id = p_razorpay_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'missing', true);
  END IF;

  IF v_subscription.provider_event_created_at > p_event_created_at
     OR (
       v_subscription.provider_event_created_at = p_event_created_at
       AND v_subscription.provider_status_rank >= v_rank
     ) THEN
    RETURN jsonb_build_object(
      'applied', false,
      'stale', true,
      'orgId', v_subscription.org_id,
      'status', v_subscription.status
    );
  END IF;

  UPDATE public.org_subscriptions
  SET status = p_status,
      current_start = COALESCE(p_current_start, current_start),
      current_end = COALESCE(p_current_end, current_end),
      charge_at = COALESCE(p_charge_at, charge_at),
      paid_count = COALESCE(p_paid_count, paid_count),
      remaining_count = COALESCE(p_remaining_count, remaining_count),
      cancel_at_cycle_end = CASE WHEN p_status = 'cancelled' THEN true ELSE cancel_at_cycle_end END,
      provider_event_created_at = p_event_created_at,
      provider_event_id = p_event_id,
      provider_status_rank = v_rank,
      updated_at = clock_timestamp()
  WHERE id = v_subscription.id
  RETURNING * INTO v_subscription;

  RETURN jsonb_build_object(
    'applied', true,
    'orgId', v_subscription.org_id,
    'status', v_subscription.status,
    'currentEnd', v_subscription.current_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_razorpay_subscription_event(
  text, text, timestamptz, text, timestamptz, timestamptz, timestamptz, integer, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_razorpay_subscription_event(
  text, text, timestamptz, text, timestamptz, timestamptz, timestamptz, integer, integer
) TO service_role;

-- Convert the referral use and create its discount window in one transaction.
CREATE OR REPLACE FUNCTION public.claim_referral_conversion(p_referee_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_usage public.referral_uses%ROWTYPE;
  v_referrer_org_id uuid;
  v_existing_window uuid;
  v_valid_from timestamptz;
  v_valid_until timestamptz;
BEGIN
  IF p_referee_org_id IS NULL THEN
    RAISE EXCEPTION 'Missing referee organization.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_referee_org_id::text, 0));
  SELECT usage.* INTO v_usage
  FROM public.referral_uses AS usage
  WHERE usage.referee_org_id = p_referee_org_id
    AND usage.status IN ('pending', 'converted')
  ORDER BY usage.created_at
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('converted', false, 'eligible', false);
  END IF;

  SELECT code.org_id INTO v_referrer_org_id
  FROM public.referral_codes AS code
  WHERE code.id = v_usage.referral_code_id;
  IF v_referrer_org_id IS NULL THEN
    RAISE EXCEPTION 'Referral code has no referrer organization.' USING ERRCODE = '23503';
  END IF;

  SELECT discount_window.id INTO v_existing_window
  FROM public.referral_discount_windows AS discount_window
  WHERE discount_window.referral_use_id = v_usage.id;

  IF v_existing_window IS NOT NULL THEN
    UPDATE public.referral_uses
    SET status = 'converted', converted_at = COALESCE(converted_at, clock_timestamp())
    WHERE id = v_usage.id;
    RETURN jsonb_build_object('converted', true, 'alreadyProcessed', true);
  END IF;

  SELECT GREATEST(clock_timestamp(), COALESCE(MAX(subscription.current_end), clock_timestamp()))
    INTO v_valid_from
  FROM public.org_subscriptions AS subscription
  WHERE subscription.org_id = v_referrer_org_id
    AND subscription.current_end > clock_timestamp();
  v_valid_until := v_valid_from + interval '3 months';

  INSERT INTO public.referral_discount_windows (
    referrer_org_id, referral_use_id, discount_pct, valid_from, valid_until
  ) VALUES (
    v_referrer_org_id, v_usage.id, 10, v_valid_from, v_valid_until
  );

  UPDATE public.referral_uses
  SET status = 'converted', converted_at = clock_timestamp()
  WHERE id = v_usage.id;

  RETURN jsonb_build_object('converted', true, 'alreadyProcessed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral_conversion(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_conversion(uuid)
  TO service_role;

-- Atomically reserve one external refund per payment. Failed or stale pending
-- claims can retry with the same provider idempotency key.
CREATE OR REPLACE FUNCTION public.claim_referral_refund(
  p_org_id uuid,
  p_razorpay_payment_id text,
  p_original_amount_paise integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_existing public.referral_refunds%ROWTYPE;
  v_windows jsonb;
  v_window_count integer;
  v_discount_pct integer;
  v_refund_amount integer;
  v_idempotency_key text;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_org_id IS NULL
     OR NULLIF(btrim(p_razorpay_payment_id), '') IS NULL
     OR p_original_amount_paise <= 0 THEN
    RAISE EXCEPTION 'Invalid referral refund identity.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_razorpay_payment_id, 0));
  SELECT refund.* INTO v_existing
  FROM public.referral_refunds AS refund
  WHERE refund.razorpay_payment_id = p_razorpay_payment_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.referrer_org_id IS DISTINCT FROM p_org_id
       OR v_existing.original_amount_paise IS DISTINCT FROM p_original_amount_paise THEN
      RAISE EXCEPTION 'Referral refund payment context mismatch.' USING ERRCODE = '23505';
    END IF;

    IF v_existing.status = 'issued' THEN
      RETURN jsonb_build_object('eligible', true, 'claimed', false, 'status', 'issued');
    END IF;

    IF v_existing.status = 'pending' AND v_existing.updated_at > v_now - interval '5 minutes' THEN
      RETURN jsonb_build_object('eligible', true, 'claimed', false, 'status', 'pending');
    END IF;

    UPDATE public.referral_refunds
    SET status = 'pending',
        attempts = attempts + 1,
        last_error = NULL,
        updated_at = v_now
    WHERE id = v_existing.id
    RETURNING * INTO v_existing;

    RETURN jsonb_build_object(
      'eligible', true,
      'claimed', true,
      'status', 'pending',
      'refundAmountPaise', v_existing.refund_amount_paise,
      'discountPct', v_existing.discount_pct_applied,
      'windowCount', COALESCE(jsonb_array_length(v_existing.windows_applied), 0),
      'idempotencyKey', v_existing.idempotency_key
    );
  END IF;

  SELECT
    COALESCE(jsonb_agg(discount_window.id ORDER BY discount_window.id), '[]'::jsonb),
    COUNT(*)::integer,
    LEAST(100, COALESCE(SUM(discount_window.discount_pct), 0))::integer
  INTO v_windows, v_window_count, v_discount_pct
  FROM public.referral_discount_windows AS discount_window
  WHERE discount_window.referrer_org_id = p_org_id
    AND discount_window.valid_from <= v_now
    AND discount_window.valid_until >= v_now;

  IF v_window_count = 0 OR v_discount_pct = 0 THEN
    RETURN jsonb_build_object('eligible', false, 'claimed', false, 'status', 'not_applicable');
  END IF;

  v_refund_amount := round(p_original_amount_paise * (v_discount_pct / 100.0));
  v_idempotency_key := left(
    'wvl_refund_' || regexp_replace(p_razorpay_payment_id, '[^A-Za-z0-9_-]', '_', 'g'),
    80
  );

  INSERT INTO public.referral_refunds (
    referrer_org_id,
    razorpay_payment_id,
    original_amount_paise,
    refund_amount_paise,
    discount_pct_applied,
    windows_applied,
    status,
    idempotency_key,
    attempts,
    updated_at
  ) VALUES (
    p_org_id,
    p_razorpay_payment_id,
    p_original_amount_paise,
    v_refund_amount,
    v_discount_pct,
    v_windows,
    'pending',
    v_idempotency_key,
    1,
    v_now
  ) RETURNING * INTO v_existing;

  RETURN jsonb_build_object(
    'eligible', true,
    'claimed', true,
    'status', 'pending',
    'refundAmountPaise', v_refund_amount,
    'discountPct', v_discount_pct,
    'windowCount', v_window_count,
    'idempotencyKey', v_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral_refund(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_refund(uuid, text, integer)
  TO service_role;

-- Preserve the established activation implementation behind a new wrapper so
-- a canonical captured payment can supersede an earlier failed snapshot with
-- the same payment ID without violating the unique payment constraint.
DO $$
BEGIN
  IF to_regprocedure('public.activate_order_billing_purchase_legacy(uuid,text,text,integer,text,text,text,text)') IS NULL THEN
    IF to_regprocedure('public.activate_order_billing_purchase(uuid,text,text,integer,text,text,text,text)') IS NULL THEN
      RAISE EXCEPTION 'activate_order_billing_purchase must exist before B17 hardening';
    END IF;
    ALTER FUNCTION public.activate_order_billing_purchase(
      uuid, text, text, integer, text, text, text, text
    ) RENAME TO activate_order_billing_purchase_legacy;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.activate_order_billing_purchase(
  p_org_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_amount_paise integer,
  p_method text,
  p_plan_tier text,
  p_purchase_type text,
  p_currency text DEFAULT 'INR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_failed_payment public.subscription_payments%ROWTYPE;
  v_result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  SELECT payment.* INTO v_failed_payment
  FROM public.subscription_payments AS payment
  WHERE payment.razorpay_payment_id = p_razorpay_payment_id
    AND payment.status = 'failed'
  FOR UPDATE;

  IF FOUND THEN
    IF v_failed_payment.org_id IS DISTINCT FROM p_org_id
       OR v_failed_payment.razorpay_order_id IS DISTINCT FROM p_razorpay_order_id
       OR v_failed_payment.amount_paise IS DISTINCT FROM p_amount_paise THEN
      RAISE EXCEPTION 'Failed payment context does not match captured checkout.' USING ERRCODE = '23505';
    END IF;
    DELETE FROM public.subscription_payments WHERE id = v_failed_payment.id;
  END IF;

  v_result := public.activate_order_billing_purchase_legacy(
    p_org_id,
    p_razorpay_order_id,
    p_razorpay_payment_id,
    p_amount_paise,
    p_method,
    p_plan_tier,
    p_purchase_type,
    p_currency
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_order_billing_purchase(
  uuid, text, text, integer, text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_order_billing_purchase(
  uuid, text, text, integer, text, text, text, text
) TO service_role;

REVOKE ALL ON FUNCTION public.activate_order_billing_purchase_legacy(
  uuid, text, text, integer, text, text, text, text
) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.claim_razorpay_webhook_event(text, text, text, integer)
  IS 'Atomically claims a signed Razorpay event and rejects event-ID/body conflicts.';
COMMENT ON FUNCTION public.apply_razorpay_subscription_event(
  text, text, timestamptz, text, timestamptz, timestamptz, timestamptz, integer, integer
) IS 'Applies Razorpay subscription state monotonically by provider event time.';
COMMENT ON FUNCTION public.claim_referral_refund(uuid, text, integer)
  IS 'Reserves one referral refund with a stable provider idempotency key.';
