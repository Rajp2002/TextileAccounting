-- Atomic, server-only activation for order-based Estimator and Full Suite
-- purchases. The function serializes all billing activation per organization,
-- binds activation to a locally tracked Razorpay order, and prevents two
-- concurrent renewals from extending from the same prior period end.

ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS checkout_purchase_type text,
  ADD COLUMN IF NOT EXISTS checkout_amount_paise integer,
  ADD COLUMN IF NOT EXISTS checkout_currency text;

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

-- Razorpay order IDs are one checkout boundary. These guards complement the
-- existing unique razorpay_payment_id constraint on subscription_payments.
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_subscriptions_razorpay_order_id_unique
  ON public.org_subscriptions (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_payments_captured_order_unique
  ON public.subscription_payments (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL AND status = 'captured';

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

  IF p_plan_tier IS NULL OR p_plan_tier NOT IN ('base', 'premium') THEN
    RAISE EXCEPTION 'Invalid billing plan tier.' USING ERRCODE = '22023';
  END IF;

  IF p_purchase_type IS NULL OR p_purchase_type NOT IN ('initial_purchase', 'renewal') THEN
    RAISE EXCEPTION 'Invalid billing purchase type.' USING ERRCODE = '22023';
  END IF;

  IF p_currency IS DISTINCT FROM 'INR' THEN
    RAISE EXCEPTION 'Invalid billing currency.' USING ERRCODE = '22023';
  END IF;

  v_expected_amount := CASE
    WHEN p_plan_tier = 'base' AND p_purchase_type = 'initial_purchase' THEN 826000
    WHEN p_plan_tier = 'base' AND p_purchase_type = 'renewal' THEN 236000
    WHEN p_plan_tier = 'premium' AND p_purchase_type = 'initial_purchase' THEN 2950000
    WHEN p_plan_tier = 'premium' AND p_purchase_type = 'renewal' THEN 826000
  END;

  IF p_amount_paise IS DISTINCT FROM v_expected_amount THEN
    RAISE EXCEPTION 'Payment amount does not match the bound plan and purchase type.' USING ERRCODE = '22023';
  END IF;

  -- One billing activation transaction per organization. This is the critical
  -- serialization point that prevents concurrent renewals losing a paid year.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));
  v_now := clock_timestamp();

  -- Strong idempotency by either captured payment ID or captured order ID.
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

  -- The order must have exactly one local row created by create-order, and its
  -- immutable commercial context must match every activation argument.
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
      AND (
        history.razorpay_payment_id IS NOT NULL
        OR history.status IN ('active', 'paused', 'halted', 'cancelled', 'completed', 'expired')
      )
  ) INTO v_has_target_history;

  IF p_purchase_type = 'renewal' AND NOT v_has_target_history THEN
    RAISE EXCEPTION 'Renewal pricing requires prior paid history for this plan.' USING ERRCODE = '22023';
  END IF;

  -- Extend from the latest target-plan end under the advisory lock. A signed
  -- initial order that raced another activation is also appended, never lost.
  SELECT GREATEST(
      v_now,
      COALESCE(MAX(history.current_end), v_now)
    )
    INTO v_anchor
  FROM public.org_subscriptions AS history
  WHERE history.org_id = p_org_id
    AND history.id <> v_order_subscription.id
    AND history.plan_tier = p_plan_tier
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

REVOKE ALL ON FUNCTION public.activate_order_billing_purchase(
  uuid, text, text, integer, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.activate_order_billing_purchase(
  uuid, text, text, integer, text, text, text, text
) TO service_role;

COMMENT ON FUNCTION public.activate_order_billing_purchase(
  uuid, text, text, integer, text, text, text, text
) IS 'Atomically validates and activates a server-bound Razorpay Estimator or Full Suite purchase/renewal.';
