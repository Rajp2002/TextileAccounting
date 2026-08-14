-- Staged referral rewards
--
-- A referral has two user-visible stages:
--   used   - the code was applied, but the referee has not paid the initial
--            Base Plan year yet;
--   active - the initial Base Plan year was paid and one free renewal year is
--            ready to be redeemed.
--
-- This forward migration keeps the existing referral ledger, adds an India
-- calendar-year earning bucket, and changes redemption to reserve every
-- active credit in one action. The original migration remains immutable.

ALTER TABLE public.referral_year_credits
  ADD COLUMN IF NOT EXISTS credit_year integer;

UPDATE public.referral_year_credits
SET credit_year = EXTRACT(YEAR FROM (granted_at AT TIME ZONE 'Asia/Kolkata'))::integer
WHERE credit_year IS NULL;

ALTER TABLE public.referral_year_credits
  ALTER COLUMN credit_year SET DEFAULT (
    EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Kolkata'))::integer
  );

ALTER TABLE public.referral_year_credits
  ALTER COLUMN credit_year SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referral_year_credits_credit_year_check'
      AND conrelid = 'public.referral_year_credits'::regclass
  ) THEN
    ALTER TABLE public.referral_year_credits
      ADD CONSTRAINT referral_year_credits_credit_year_check
      CHECK (credit_year BETWEEN 2000 AND 2200);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_referral_year_credits_referrer_year_status
  ON public.referral_year_credits(referrer_org_id, credit_year, status, granted_at);

-- Convert a referee only after the referee has paid the initial Base Plan
-- amount and the referrer is an active paid Base Plan member. The five-credit
-- limit resets each India calendar year and is serialized per referrer.
CREATE OR REPLACE FUNCTION public.claim_referral_conversion(p_referee_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_usage             public.referral_uses%ROWTYPE;
  v_referrer_org_id   uuid;
  v_existing_credit   public.referral_year_credits%ROWTYPE;
  v_credit_count      integer;
  v_available_count   integer;
  v_referral_year     integer;
  v_referee_qualified boolean;
  v_now               timestamptz := clock_timestamp();
BEGIN
  IF p_referee_org_id IS NULL THEN
    RAISE EXCEPTION 'Missing referee organization.' USING ERRCODE = '22023';
  END IF;

  v_referral_year := EXTRACT(YEAR FROM (v_now AT TIME ZONE 'Asia/Kolkata'))::integer;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_referee_org_id::text, 0));

  SELECT usage.*
    INTO v_usage
  FROM public.referral_uses AS usage
  WHERE usage.referee_org_id = p_referee_org_id
    AND usage.status IN ('pending', 'converted')
  ORDER BY usage.created_at, usage.id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('converted', false, 'eligible', false, 'reason', 'no_pending_referral');
  END IF;

  SELECT code.org_id
    INTO v_referrer_org_id
  FROM public.referral_codes AS code
  WHERE code.id = v_usage.referral_code_id;

  IF v_referrer_org_id IS NULL THEN
    RAISE EXCEPTION 'Referral code has no referrer organization.' USING ERRCODE = '23503';
  END IF;

  SELECT credit.*
    INTO v_existing_credit
  FROM public.referral_year_credits AS credit
  WHERE credit.referral_use_id = v_usage.id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.referral_uses
    SET status = 'converted',
        converted_at = COALESCE(converted_at, v_now)
    WHERE id = v_usage.id;

    SELECT COUNT(*)::integer
      INTO v_available_count
    FROM public.referral_year_credits AS credit
    WHERE credit.referrer_org_id = v_referrer_org_id
      AND credit.status = 'available';

    RETURN jsonb_build_object(
      'converted', true,
      'eligible', true,
      'alreadyProcessed', true,
      'availableCredits', v_available_count
    );
  END IF;

  -- A legacy converted use may have no annual-credit row. Do not silently
  -- mint a new reward for that old state; only a pending use can be newly
  -- converted under this policy.
  IF v_usage.status = 'converted' THEN
    RETURN jsonb_build_object(
      'converted', false,
      'eligible', false,
      'alreadyProcessed', true,
      'reason', 'legacy_referral_already_converted'
    );
  END IF;

  v_referee_qualified := public.referral_has_paid_base_initial_purchase(p_referee_org_id);
  IF NOT v_referee_qualified THEN
    RETURN jsonb_build_object(
      'converted', false,
      'eligible', false,
      'reason', 'referee_initial_base_payment_required'
    );
  END IF;

  IF NOT public.referral_is_active_base_member(v_referrer_org_id) THEN
    RETURN jsonb_build_object(
      'converted', false,
      'eligible', false,
      'reason', 'referrer_active_base_required'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_referrer_org_id::text, 0));

  -- Count every credit issued in the year, including redeemed/revoked rows,
  -- so the annual limit cannot be bypassed by redeeming and then referring
  -- again. The ledger remains auditable for every qualifying payment.
  SELECT COUNT(*)::integer
    INTO v_credit_count
  FROM public.referral_year_credits AS credit
  WHERE credit.referrer_org_id = v_referrer_org_id
    AND credit.credit_year = v_referral_year;

  IF v_credit_count >= 5 THEN
    UPDATE public.referral_uses
    SET status = 'expired',
        converted_at = COALESCE(converted_at, v_now)
    WHERE id = v_usage.id;

    RETURN jsonb_build_object(
      'converted', false,
      'eligible', false,
      'reason', 'referral_cap_reached',
      'cap', 5,
      'year', v_referral_year
    );
  END IF;

  INSERT INTO public.referral_year_credits (
    referrer_org_id,
    referral_use_id,
    credit_year,
    status,
    granted_at,
    created_at,
    updated_at
  ) VALUES (
    v_referrer_org_id,
    v_usage.id,
    v_referral_year,
    'available',
    v_now,
    v_now,
    v_now
  )
  RETURNING * INTO v_existing_credit;

  UPDATE public.referral_uses
  SET status = 'converted',
      converted_at = v_now
  WHERE id = v_usage.id;

  SELECT COUNT(*)::integer
    INTO v_available_count
  FROM public.referral_year_credits AS credit
  WHERE credit.referrer_org_id = v_referrer_org_id
    AND credit.status = 'available';

  RETURN jsonb_build_object(
    'converted', true,
    'eligible', true,
    'alreadyProcessed', false,
    'creditId', v_existing_credit.id,
    'availableCredits', v_available_count,
    'cap', 5,
    'year', v_referral_year
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral_conversion(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_conversion(uuid)
  TO service_role;

-- Redeem every active credit at once. Each credit becomes one consecutive
-- free 365-day Base entitlement, so five active credits reserve the next five
-- annual renewals. Redemption is intentionally available at any time.
CREATE OR REPLACE FUNCTION public.redeem_referral_year_credit(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_credit          public.referral_year_credits%ROWTYPE;
  v_subscription    public.org_subscriptions%ROWTYPE;
  v_current_end     timestamptz;
  v_anchor          timestamptz;
  v_now             timestamptz := clock_timestamp();
  v_remaining       integer;
  v_redeemed_count  integer := 0;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Missing organization.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  IF NOT public.referral_is_active_base_member(p_org_id) THEN
    RETURN jsonb_build_object(
      'redeemed', false,
      'reason', 'active_base_membership_required',
      'message', 'Referral rewards require an active Base Plan with the initial year paid.'
    );
  END IF;

  SELECT MAX(subscription.current_end)
    INTO v_current_end
  FROM public.org_subscriptions AS subscription
  WHERE subscription.org_id = p_org_id
    AND subscription.plan_tier = 'base'
    AND subscription.status IN ('active', 'authenticated', 'paused', 'halted', 'cancelled', 'completed')
    AND subscription.current_end > v_now;

  IF v_current_end IS NULL THEN
    RETURN jsonb_build_object(
      'redeemed', false,
      'reason', 'active_base_period_required',
      'message', 'An active Base Plan period is required before redeeming this reward.'
    );
  END IF;

  FOR v_credit IN
    SELECT credit.*
    FROM public.referral_year_credits AS credit
    WHERE credit.referrer_org_id = p_org_id
      AND credit.status = 'available'
    ORDER BY credit.granted_at, credit.id
    FOR UPDATE
  LOOP
    v_anchor := GREATEST(v_now, v_current_end);

    INSERT INTO public.org_subscriptions (
      org_id,
      plan_id,
      plan_tier,
      status,
      current_start,
      current_end,
      billing_model,
      checkout_purchase_type,
      checkout_amount_paise,
      checkout_currency,
      cancel_at_cycle_end,
      created_at,
      updated_at
    ) VALUES (
      p_org_id,
      NULL,
      'base',
      'active',
      v_anchor,
      v_anchor + interval '365 days',
      'referral_free_annual_renewal',
      'renewal',
      NULL,
      'INR',
      false,
      v_now,
      v_now
    )
    RETURNING * INTO v_subscription;

    UPDATE public.referral_year_credits
    SET status = 'redeemed',
        redeemed_at = v_now,
        redeemed_subscription_id = v_subscription.id,
        updated_at = v_now
    WHERE id = v_credit.id;

    v_current_end := v_subscription.current_end;
    v_redeemed_count := v_redeemed_count + 1;
  END LOOP;

  IF v_redeemed_count = 0 THEN
    RETURN jsonb_build_object(
      'redeemed', false,
      'reason', 'no_available_credit',
      'message', 'There is no active referral reward available yet.'
    );
  END IF;

  SELECT COUNT(*)::integer
    INTO v_remaining
  FROM public.referral_year_credits AS credit
  WHERE credit.referrer_org_id = p_org_id
    AND credit.status = 'available';

  RETURN jsonb_build_object(
    'redeemed', true,
    'redeemedCount', v_redeemed_count,
    'activeUntil', v_current_end,
    'remainingCredits', v_remaining
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_referral_year_credit(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral_year_credit(uuid)
  TO service_role;

COMMENT ON TABLE public.referral_year_credits IS
  'One free Base Plan renewal year per qualifying paid referral; maximum five credits per referrer per India calendar year.';
COMMENT ON FUNCTION public.claim_referral_conversion(uuid) IS
  'Atomically grants one annual Base Plan credit after a referee pays the initial Base Plan amount, capped at five credits per India calendar year.';
COMMENT ON FUNCTION public.redeem_referral_year_credit(uuid) IS
  'Atomically consumes every active referral credit and appends one consecutive free 365-day Base entitlement per credit.';
