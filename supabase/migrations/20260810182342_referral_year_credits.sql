-- Annual referral rewards
--
-- The original referral implementation represented a reward as a percentage
-- discount window and an external Razorpay refund.  Annual billing has no
-- monthly invoice to discount, so the live policy is now one free Base Plan
-- year per qualifying paid referral, capped at five total referral credits.
--
-- Existing discount/refund tables remain read-only audit history.  This
-- migration deliberately does not convert old discount windows into free
-- years; the production database currently has no converted referrals.

CREATE TABLE IF NOT EXISTS public.referral_year_credits (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referral_use_id          uuid NOT NULL UNIQUE REFERENCES public.referral_uses(id) ON DELETE CASCADE,
  status                   text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'redeemed', 'revoked')),
  granted_at               timestamptz NOT NULL DEFAULT now(),
  redeemed_at              timestamptz,
  redeemed_subscription_id uuid UNIQUE REFERENCES public.org_subscriptions(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_year_credits_referrer_status
  ON public.referral_year_credits(referrer_org_id, status, granted_at);

CREATE INDEX IF NOT EXISTS idx_referral_year_credits_use_id
  ON public.referral_year_credits(referral_use_id);

ALTER TABLE public.referral_year_credits ENABLE ROW LEVEL SECURITY;

-- Referral writes are server-only.  Owners can read only their own earned
-- credits; signup code resolution and all claims use the service role.
REVOKE ALL ON TABLE public.referral_year_credits FROM anon, authenticated;
GRANT SELECT ON TABLE public.referral_year_credits TO authenticated;

DROP POLICY IF EXISTS owners_see_own_year_credits ON public.referral_year_credits;
CREATE POLICY owners_see_own_year_credits
  ON public.referral_year_credits FOR SELECT
  TO authenticated
  USING (
    referrer_org_id = (
      SELECT org_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'owner'
    )
  );

-- The browser never needs to resolve referral codes or write referral uses.
-- Keep owner-scoped read access for exports and authenticated diagnostics, and
-- leave all inserts/updates/deletes to the service role.
REVOKE ALL ON TABLE public.referral_codes,
                     public.referral_uses,
                     public.referral_discount_windows,
                     public.referral_refunds
  FROM anon, authenticated;

GRANT SELECT ON TABLE public.referral_codes,
                         public.referral_uses,
                         public.referral_discount_windows,
                         public.referral_refunds
  TO authenticated;

DROP POLICY IF EXISTS anyone_can_read_referral_codes ON public.referral_codes;
DROP POLICY IF EXISTS owners_manage_own_referral_code ON public.referral_codes;
DROP POLICY IF EXISTS owners_see_own_referral_uses ON public.referral_uses;
DROP POLICY IF EXISTS owners_see_own_discount_windows ON public.referral_discount_windows;
DROP POLICY IF EXISTS owners_see_own_refunds ON public.referral_refunds;

CREATE POLICY owners_see_own_referral_codes
  ON public.referral_codes FOR SELECT
  TO authenticated
  USING (
    org_id = (
      SELECT org_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'owner'
    )
  );

CREATE POLICY owners_see_own_referral_uses
  ON public.referral_uses FOR SELECT
  TO authenticated
  USING (
    referee_org_id = (
      SELECT org_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'owner'
    )
    OR EXISTS (
      SELECT 1
      FROM public.referral_codes AS code
      WHERE code.id = referral_uses.referral_code_id
        AND code.org_id = (
          SELECT org_id
          FROM public.profiles
          WHERE id = (SELECT auth.uid()) AND role = 'owner'
        )
    )
  );

CREATE POLICY owners_see_own_discount_windows
  ON public.referral_discount_windows FOR SELECT
  TO authenticated
  USING (
    referrer_org_id = (
      SELECT org_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'owner'
    )
  );

CREATE POLICY owners_see_own_refunds
  ON public.referral_refunds FOR SELECT
  TO authenticated
  USING (
    referrer_org_id = (
      SELECT org_id
      FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'owner'
    )
  );

-- A paid initial Base Plan purchase is the only payment proof that can make
-- an organization eligible to refer or redeem a reward.  In particular, a
-- trial row and a free referral renewal do not satisfy this helper.
CREATE OR REPLACE FUNCTION public.referral_has_paid_base_initial_purchase(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_org_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.subscription_payments AS payment
        JOIN public.org_subscriptions AS subscription
          ON subscription.id = payment.subscription_id
        WHERE payment.org_id = p_org_id
          AND payment.status = 'captured'
          AND payment.amount_paise > 0
          AND subscription.org_id = p_org_id
          AND subscription.plan_tier = 'base'
          AND subscription.checkout_purchase_type = 'initial_purchase'
      )
      OR EXISTS (
        SELECT 1
        FROM public.org_subscriptions AS subscription
        WHERE subscription.org_id = p_org_id
          AND subscription.plan_tier = 'base'
          AND subscription.checkout_purchase_type = 'initial_purchase'
          AND subscription.razorpay_payment_id IS NOT NULL
          AND COALESCE(subscription.checkout_amount_paise, 0) > 0
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.referral_is_active_base_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    public.referral_has_paid_base_initial_purchase(p_org_id)
    AND EXISTS (
      SELECT 1
      FROM public.org_subscriptions AS subscription
      WHERE subscription.org_id = p_org_id
        AND subscription.plan_tier = 'base'
        AND subscription.status IN ('active', 'authenticated', 'paused', 'halted', 'cancelled', 'completed')
        AND (subscription.current_start IS NULL OR subscription.current_start <= now())
        AND subscription.current_end > now()
    );
$$;

REVOKE ALL ON FUNCTION public.referral_has_paid_base_initial_purchase(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_is_active_base_member(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referral_has_paid_base_initial_purchase(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.referral_is_active_base_member(uuid)
  TO service_role;

-- Convert a referee only after the referee has paid the initial Base Plan
-- amount and the referrer is an active paid Base Plan member.  The advisory
-- locks serialize both the referee's one-time use and the referrer's five-
-- credit cap.  Replays return the existing credit instead of creating a new
-- one.
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
  v_referee_qualified boolean;
  v_now               timestamptz := clock_timestamp();
BEGIN
  IF p_referee_org_id IS NULL THEN
    RAISE EXCEPTION 'Missing referee organization.' USING ERRCODE = '22023';
  END IF;

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

  SELECT COUNT(*)::integer
    INTO v_credit_count
  FROM public.referral_year_credits AS credit
  WHERE credit.referrer_org_id = v_referrer_org_id;

  IF v_credit_count >= 5 THEN
    UPDATE public.referral_uses
    SET status = 'expired',
        converted_at = COALESCE(converted_at, v_now)
    WHERE id = v_usage.id;

    RETURN jsonb_build_object(
      'converted', false,
      'eligible', false,
      'reason', 'referral_cap_reached',
      'cap', 5
    );
  END IF;

  INSERT INTO public.referral_year_credits (
    referrer_org_id,
    referral_use_id,
    status,
    granted_at,
    created_at,
    updated_at
  ) VALUES (
    v_referrer_org_id,
    v_usage.id,
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
    'cap', 5
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral_conversion(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_conversion(uuid)
  TO service_role;

-- Retire the old percentage/refund claim.  Keeping this function as a safe
-- no-op protects rolling deployments: an older web process can call it, but
-- it can no longer reserve or issue a provider refund under the new policy.
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
BEGIN
  RETURN jsonb_build_object(
    'eligible', false,
    'claimed', false,
    'status', 'retired',
    'reason', 'annual_credit_policy'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral_refund(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_refund(uuid, text, integer)
  TO service_role;

COMMENT ON TABLE public.referral_year_credits IS
  'One free Base Plan renewal year per qualifying paid referral; maximum five credits per referrer.';
COMMENT ON FUNCTION public.claim_referral_conversion(uuid) IS
  'Atomically grants one annual Base Plan credit after a referee pays the initial Base Plan amount.';
COMMENT ON FUNCTION public.claim_referral_refund(uuid, text, integer) IS
  'Retired compatibility no-op. Annual referral rewards are entitlement credits, never payment refunds.';

-- Redeem the oldest available credit as the next annual Base Plan period. No
-- Razorpay order or zero-amount provider call is created; the subscription
-- row is the entitlement ledger and the credit row is the reward ledger.
CREATE OR REPLACE FUNCTION public.redeem_referral_year_credit(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_credit       public.referral_year_credits%ROWTYPE;
  v_subscription public.org_subscriptions%ROWTYPE;
  v_current_end  timestamptz;
  v_anchor       timestamptz;
  v_now          timestamptz := clock_timestamp();
  v_remaining    integer;
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

  SELECT credit.*
    INTO v_credit
  FROM public.referral_year_credits AS credit
  WHERE credit.referrer_org_id = p_org_id
    AND credit.status = 'available'
  ORDER BY credit.granted_at, credit.id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'redeemed', false,
      'reason', 'no_available_credit',
      'message', 'There is no free annual Base Plan year available yet.'
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

  IF v_current_end > v_now + interval '30 days' THEN
    RETURN jsonb_build_object(
      'redeemed', false,
      'reason', 'renewal_not_open',
      'renewalEligibleAt', (v_current_end - interval '30 days'),
      'message', 'Your free renewal becomes available during the final 30 days of the current Base Plan year.'
    );
  END IF;

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

  SELECT COUNT(*)::integer
    INTO v_remaining
  FROM public.referral_year_credits AS credit
  WHERE credit.referrer_org_id = p_org_id
    AND credit.status = 'available';

  RETURN jsonb_build_object(
    'redeemed', true,
    'creditId', v_credit.id,
    'subscriptionId', v_subscription.id,
    'activeUntil', v_subscription.current_end,
    'remainingCredits', v_remaining
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_referral_year_credit(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral_year_credit(uuid)
  TO service_role;

COMMENT ON FUNCTION public.redeem_referral_year_credit(uuid) IS
  'Atomically consumes one earned referral credit and appends one free 365-day Base Plan entitlement.';
