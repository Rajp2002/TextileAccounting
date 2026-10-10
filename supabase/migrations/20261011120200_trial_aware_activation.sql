-- Trial-aware activation and provisioning (see
-- docs/superpowers/specs/2026-10-11-base-suppression-and-lite-trial-design.md, section B).
-- A paid conversion from a Lite trial starts a fresh term from the payment date
-- and takes over from the trial: the trial row is excluded from the same-tier
-- history that anchors the term and decides renewal pricing. Dismissed checkouts
-- no longer block the Free account, which uses the shared paid-history predicate.
-- Each function below is the latest definition copied byte-for-byte, changing
-- only the lines named above. Signatures, return types, security, search_path
-- and comments are unchanged, and grants are the latest state of each function:
-- the legacy activation body stays revoked from service_role (20260924085030).

CREATE OR REPLACE FUNCTION public.activate_order_billing_purchase_legacy(
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
  v_expected_amount integer;
  v_order_subscription public.org_subscriptions%ROWTYPE;
  v_existing_payment public.subscription_payments%ROWTYPE;
  v_existing_subscription public.org_subscriptions%ROWTYPE;
  v_new_payment public.subscription_payments%ROWTYPE;
  v_anchor timestamptz;
  v_now timestamptz;
  v_has_target_history boolean;
BEGIN
  IF p_org_id IS NULL
     OR NULLIF(btrim(p_razorpay_order_id), '') IS NULL
     OR NULLIF(btrim(p_razorpay_payment_id), '') IS NULL THEN
    RAISE EXCEPTION 'Missing billing activation identity.' USING ERRCODE = '22023';
  END IF;

  IF p_plan_tier IS NULL OR p_plan_tier NOT IN ('lite', 'base', 'premium') THEN
    RAISE EXCEPTION 'Invalid billing plan tier.' USING ERRCODE = '22023';
  END IF;

  IF p_purchase_type IS NULL OR p_purchase_type NOT IN ('initial_purchase', 'renewal') THEN
    RAISE EXCEPTION 'Invalid billing purchase type.' USING ERRCODE = '22023';
  END IF;

  IF p_currency IS DISTINCT FROM 'INR' THEN
    RAISE EXCEPTION 'Invalid billing currency.' USING ERRCODE = '22023';
  END IF;

  v_expected_amount := CASE
    WHEN p_plan_tier = 'lite' AND p_purchase_type = 'initial_purchase' THEN 299900
    WHEN p_plan_tier = 'lite' AND p_purchase_type = 'renewal' THEN 149900
    WHEN p_plan_tier = 'base' AND p_purchase_type = 'initial_purchase' THEN 999900
    WHEN p_plan_tier = 'base' AND p_purchase_type = 'renewal' THEN 499900
    -- Retain the legacy catalog so previously-issued Premium operational
    -- records can still be reconciled without changing their history.
    WHEN p_plan_tier = 'premium' AND p_purchase_type = 'initial_purchase' THEN 2950000
    WHEN p_plan_tier = 'premium' AND p_purchase_type = 'renewal' THEN 826000
  END;

  IF p_amount_paise IS DISTINCT FROM v_expected_amount THEN
    RAISE EXCEPTION 'Payment amount does not match the bound plan and purchase type.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));
  v_now := clock_timestamp();

  SELECT payment.*
    INTO v_existing_payment
  FROM public.subscription_payments AS payment
  WHERE payment.status = 'captured'
    AND (
      payment.razorpay_payment_id = p_razorpay_payment_id
      OR payment.razorpay_order_id = p_razorpay_order_id
    )
  ORDER BY (payment.razorpay_payment_id = p_razorpay_payment_id) DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_payment.org_id IS DISTINCT FROM p_org_id
       OR v_existing_payment.razorpay_order_id IS DISTINCT FROM p_razorpay_order_id
       OR v_existing_payment.amount_paise IS DISTINCT FROM p_amount_paise THEN
      RAISE EXCEPTION 'Previously processed payment context does not match this checkout.' USING ERRCODE = '23505';
    END IF;

    SELECT subscription.*
      INTO STRICT v_existing_subscription
    FROM public.org_subscriptions AS subscription
    WHERE subscription.id = v_existing_payment.subscription_id;

    IF v_existing_subscription.org_id IS DISTINCT FROM p_org_id
       OR v_existing_subscription.plan_tier IS DISTINCT FROM p_plan_tier
       OR (
         v_existing_subscription.checkout_purchase_type IS NOT NULL
         AND v_existing_subscription.checkout_purchase_type IS DISTINCT FROM p_purchase_type
       )
       OR (
         v_existing_subscription.checkout_amount_paise IS NOT NULL
         AND v_existing_subscription.checkout_amount_paise IS DISTINCT FROM p_amount_paise
       )
       OR (
         v_existing_subscription.checkout_currency IS NOT NULL
         AND v_existing_subscription.checkout_currency IS DISTINCT FROM p_currency
       ) THEN
      RAISE EXCEPTION 'Previously processed subscription context does not match this checkout.' USING ERRCODE = '23505';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'subscription', to_jsonb(v_existing_subscription),
      'payment', to_jsonb(v_existing_payment),
      'alreadyProcessed', true
    );
  END IF;

  SELECT subscription.*
    INTO STRICT v_order_subscription
  FROM public.org_subscriptions AS subscription
  WHERE subscription.razorpay_order_id = p_razorpay_order_id
  FOR UPDATE;

  IF v_order_subscription.org_id IS DISTINCT FROM p_org_id
     OR v_order_subscription.plan_tier IS DISTINCT FROM p_plan_tier
     OR v_order_subscription.billing_model IS DISTINCT FROM 'upfront_first_year_plus_annual_renewal'
     OR v_order_subscription.checkout_purchase_type IS DISTINCT FROM p_purchase_type
     OR v_order_subscription.checkout_amount_paise IS DISTINCT FROM p_amount_paise
     OR v_order_subscription.checkout_currency IS DISTINCT FROM p_currency THEN
    RAISE EXCEPTION 'Payment order is not bound to this organization and commercial context.' USING ERRCODE = '22023';
  END IF;

  IF v_order_subscription.status NOT IN ('created', 'authenticated')
     OR v_order_subscription.razorpay_payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Payment order is not in an activatable state.' USING ERRCODE = '55000';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.org_subscriptions AS history
    WHERE history.org_id = p_org_id
      AND history.id <> v_order_subscription.id
      AND history.plan_tier = p_plan_tier
      AND history.is_trial IS NOT TRUE
      AND (
        history.razorpay_payment_id IS NOT NULL
        OR history.status IN ('active', 'paused', 'halted', 'cancelled', 'completed', 'expired')
      )
  ) INTO v_has_target_history;

  IF p_purchase_type = 'renewal' AND NOT v_has_target_history THEN
    RAISE EXCEPTION 'Renewal pricing requires prior paid history for this plan.' USING ERRCODE = '22023';
  END IF;

  SELECT GREATEST(
      v_now,
      COALESCE(MAX(history.current_end), v_now)
    )
    INTO v_anchor
  FROM public.org_subscriptions AS history
  WHERE history.org_id = p_org_id
    AND history.id <> v_order_subscription.id
    AND history.plan_tier = p_plan_tier
    AND history.is_trial IS NOT TRUE
    AND (
      history.razorpay_payment_id IS NOT NULL
      OR history.status IN ('active', 'paused', 'halted', 'cancelled', 'completed', 'expired')
    );

  UPDATE public.org_subscriptions
  SET status = 'active',
      current_start = v_anchor,
      current_end = v_anchor + interval '365 days',
      razorpay_payment_id = p_razorpay_payment_id,
      updated_at = v_now
  WHERE id = v_order_subscription.id
  RETURNING * INTO v_order_subscription;

  INSERT INTO public.subscription_payments (
    org_id,
    subscription_id,
    razorpay_payment_id,
    razorpay_order_id,
    amount_paise,
    status,
    method,
    captured_at
  ) VALUES (
    p_org_id,
    v_order_subscription.id,
    p_razorpay_payment_id,
    p_razorpay_order_id,
    p_amount_paise,
    'captured',
    NULLIF(btrim(p_method), ''),
    v_now
  )
  RETURNING * INTO v_new_payment;

  RETURN jsonb_build_object(
    'success', true,
    'subscription', to_jsonb(v_order_subscription),
    'payment', to_jsonb(v_new_payment),
    'alreadyProcessed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_order_billing_purchase_legacy(uuid, text, text, integer, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.activate_order_billing_purchase_legacy(uuid, text, text, integer, text, text, text, text)
  IS 'Atomically validates and activates a server-bound Weavly Lite, Weavly Base, or legacy operational purchase/renewal.';

CREATE OR REPLACE FUNCTION public.provision_free_account(p_user_id uuid,p_org_id uuid,p_verified_at timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  IF p_verified_at IS NULL OR p_verified_at > now() THEN RAISE EXCEPTION 'FREE_VERIFICATION_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.free_rollout WHERE singleton AND enrollment_enabled) THEN RAISE EXCEPTION 'FREE_PAUSED'; END IF;
  PERFORM 1 FROM public.organizations o JOIN public.profiles p ON p.org_id=o.id
    WHERE o.id=p_org_id AND o.owner_id=p_user_id AND p.id=p_user_id AND p.role='owner'
      AND p.access_revoked_at IS NULL AND NOT coalesce(o.is_locked_down,false) FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'FREE_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.free_account_grants WHERE org_id=p_org_id AND subject_id=p_user_id) THEN RETURN; END IF;
  IF public.org_has_established_paid_history(p_org_id) THEN RAISE EXCEPTION 'FREE_EXISTING_ACCOUNT'; END IF;
  INSERT INTO public.free_account_subjects(id,verified_at,beta_allowed) VALUES(p_user_id,p_verified_at,true) ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.free_account_grants(org_id,subject_id) VALUES(p_org_id,p_user_id);
  UPDATE public.organizations SET onboarding_complete=true WHERE id=p_org_id;
  INSERT INTO public.free_funnel_events(subject_id,event_id,event_name,entry_point)
    VALUES(p_user_id,p_org_id,'signup_completed','signup') ON CONFLICT DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.provision_free_account(uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.provision_free_account(uuid,uuid,timestamptz) TO service_role;
