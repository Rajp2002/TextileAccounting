-- Retire the former operations plan. Historical subscription, payment, and
-- invoice rows remain intact so accounting records can still be retrieved.

-- A customer with a captured operations purchase keeps Base for the remainder
-- of a paid period, then retains the Lite costing desk like an expired Base
-- customer. Older expired purchases receive a non-current Base history row.
INSERT INTO public.org_subscriptions (
  org_id, plan_id, plan_tier, status, current_start, current_end,
  paid_count, total_count, created_at, updated_at
)
SELECT old.org_id, 'weavly_base_2026', 'base',
       CASE WHEN old.current_end + interval '24 hours' >= now()
                 AND (old.current_start IS NULL OR old.current_start <= now())
            THEN 'active' ELSE 'expired' END,
       old.current_start, old.current_end, old.paid_count, old.total_count,
       clock_timestamp(), clock_timestamp()
FROM public.org_subscriptions AS old
WHERE old.plan_tier = 'premium'
  AND old.current_end IS NOT NULL
  AND (
    old.razorpay_payment_id IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.subscription_payments AS payment
      WHERE payment.subscription_id = old.id AND payment.status = 'captured'
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.org_subscriptions AS current_base
    WHERE current_base.org_id = old.org_id
      AND current_base.plan_tier = 'base'
      AND current_base.current_end >= old.current_end
  );

UPDATE public.subscription_plans
SET is_active = false
WHERE tier NOT IN ('lite', 'base');

ALTER TABLE public.subscription_plans ALTER COLUMN tier DROP DEFAULT;
ALTER TABLE public.org_subscriptions ALTER COLUMN plan_tier DROP DEFAULT;

ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_current_active_tier_check
  CHECK (NOT is_active OR tier IN ('lite', 'base'));

-- Keep older rows for receipts and reconciliation, while preventing new
-- legacy subscriptions and checkout attempts at the database boundary.
CREATE OR REPLACE FUNCTION public.enforce_current_subscription_tier()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.plan_tier NOT IN ('lite', 'base') THEN
    RAISE EXCEPTION 'Only Lite and Base subscriptions are available.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_current_subscription_tier
BEFORE INSERT OR UPDATE OF plan_tier ON public.org_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.enforce_current_subscription_tier();

CREATE TRIGGER enforce_current_checkout_tier
BEFORE INSERT OR UPDATE OF plan_tier ON public.billing_checkout_attempts
FOR EACH ROW EXECUTE FUNCTION public.enforce_current_subscription_tier();

-- Existing estimator policies use `base` as the costing minimum. Production
-- Core policies use `base_production`. Every retired requirement now denies.
CREATE OR REPLACE FUNCTION public.org_has_subscription_tier(
  p_org_id uuid, p_required text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_org_id IS NOT NULL
    AND p_required IN ('base', 'base_production')
    AND (
      (SELECT auth.jwt() ->> 'role') = 'service_role'
      OR (
        (SELECT auth.jwt() ->> 'role') = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM public.profiles AS membership
          WHERE membership.id = (SELECT auth.uid())
            AND membership.org_id = p_org_id
        )
        AND (
          EXISTS (
            SELECT 1 FROM public.org_subscriptions AS subscription
            WHERE subscription.org_id = p_org_id
              AND subscription.status IN (
                'active', 'authenticated', 'pending', 'paused',
                'halted', 'cancelled', 'completed'
              )
              AND (subscription.current_start IS NULL OR subscription.current_start <= now())
              AND (
                (subscription.current_end IS NULL AND subscription.status IN ('active', 'authenticated'))
                OR subscription.current_end + interval '24 hours' >= now()
              )
              AND CASE
                WHEN p_required = 'base_production' THEN subscription.plan_tier = 'base'
                ELSE subscription.plan_tier IN ('lite', 'base')
              END
          )
          OR (
            p_required = 'base'
            AND EXISTS (
              SELECT 1 FROM public.org_subscriptions AS expired_base
              WHERE expired_base.org_id = p_org_id
                AND expired_base.plan_tier = 'base'
                AND expired_base.current_end IS NOT NULL
                AND expired_base.current_end + interval '24 hours' < now()
                AND (
                  expired_base.razorpay_payment_id IS NOT NULL
                  OR expired_base.status IN (
                    'active', 'authenticated', 'paused', 'halted',
                    'cancelled', 'completed', 'expired'
                  )
                )
            )
          )
        )
      )
    );
$$;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_product_experience_check;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS product_experience;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS join_code;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS join_code_expires_at;

-- Old security-definer operational RPCs invoke this helper. Disable them even
-- when a caller still holds a stale function reference.
CREATE OR REPLACE FUNCTION public.assert_premium_rpc_access(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'This operation is unavailable.' USING ERRCODE = '42501';
END;
$$;

-- The old activation functions remain internal for historical billing
-- reconciliation. Only the current wrapper can be called by service_role.
ALTER FUNCTION public.activate_order_billing_purchase(uuid, text, text, integer, text, text, text, text)
  RENAME TO activate_order_billing_purchase_retired;

REVOKE ALL ON FUNCTION public.activate_order_billing_purchase_retired(uuid, text, text, integer, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.activate_order_billing_purchase_legacy(uuid, text, text, integer, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.activate_order_billing_purchase(
  p_org_id uuid, p_razorpay_order_id text, p_razorpay_payment_id text,
  p_amount_paise integer, p_method text, p_plan_tier text,
  p_purchase_type text, p_currency text DEFAULT 'INR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_plan_tier IS NULL OR p_plan_tier NOT IN ('lite', 'base') THEN
    RAISE EXCEPTION 'Only Lite and Base purchases are available.' USING ERRCODE = '22023';
  END IF;
  RETURN public.activate_order_billing_purchase_retired(
    p_org_id, p_razorpay_order_id, p_razorpay_payment_id, p_amount_paise,
    p_method, p_plan_tier, p_purchase_type, p_currency
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_order_billing_purchase(uuid, text, text, integer, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_order_billing_purchase(uuid, text, text, integer, text, text, text, text)
  TO service_role;

ALTER FUNCTION public.claim_billing_checkout_attempt(uuid, text, text, text, text, integer, integer, integer, text)
  RENAME TO claim_billing_checkout_attempt_retired;
REVOKE ALL ON FUNCTION public.claim_billing_checkout_attempt_retired(uuid, text, text, text, text, integer, integer, integer, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.claim_billing_checkout_attempt(
  p_org_id uuid, p_client_request_id text, p_plan_tier text,
  p_purchase_type text, p_billing_model text, p_base_amount_paise integer,
  p_gst_amount_paise integer, p_total_amount_paise integer,
  p_currency text DEFAULT 'INR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_plan_tier IS NULL OR p_plan_tier NOT IN ('lite', 'base') THEN
    RAISE EXCEPTION 'Only Lite and Base purchases are available.' USING ERRCODE = '22023';
  END IF;
  RETURN public.claim_billing_checkout_attempt_retired(
    p_org_id, p_client_request_id, p_plan_tier, p_purchase_type,
    p_billing_model, p_base_amount_paise, p_gst_amount_paise,
    p_total_amount_paise, p_currency
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_billing_checkout_attempt(uuid, text, text, text, text, integer, integer, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_billing_checkout_attempt(uuid, text, text, text, text, integer, integer, integer, text)
  TO service_role;

COMMENT ON TABLE public.org_subscriptions IS
  'Tenant subscription lifecycle for Lite and Base. Older rows remain for payment history.';
