-- Weavly Lite + Weavly Base commercial restructure.
--
-- Lite is the complete former Base estimator/costing desk. Base is Lite plus
-- the owner-only Base Production Core. This migration is deliberately
-- additive: it never deletes costing, rate, quality, or production records.

-- ---------------------------------------------------------------------------
-- Canonical plan catalog
-- ---------------------------------------------------------------------------

INSERT INTO public.subscription_plans (id, name, amount_paise, interval, tier)
VALUES
  ('weavly_lite_2026', 'Weavly Lite', 299900, 'yearly', 'lite'),
  ('weavly_base_2026', 'Weavly Base', 999900, 'yearly', 'base')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  amount_paise = EXCLUDED.amount_paise,
  interval = EXCLUDED.interval,
  is_active = true,
  tier = EXCLUDED.tier;

-- The original paid Base catalog row remains a valid foreign-key target for
-- old records. Its current commercial identity is now Lite; historical
-- payment amounts remain in subscription_payments and are not rewritten.
UPDATE public.subscription_plans
SET name = 'Weavly Lite',
    amount_paise = 299900,
    interval = 'yearly',
    tier = 'lite'
WHERE id = 'plan_SeGvwQdsTlRbZd';

-- ---------------------------------------------------------------------------
-- Entitlement predicate
-- ---------------------------------------------------------------------------

-- Keep the existing `base` requirement as the costing minimum so the many
-- established estimator, saved-costing, quality, and Rate Book policies now
-- serve Lite and Base alike. Production uses the new explicit requirement
-- `base_production` and therefore remains unavailable to Lite.
CREATE OR REPLACE FUNCTION public.org_has_subscription_tier(
  p_org_id uuid,
  p_required text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_org_id IS NOT NULL
    AND p_required IN ('base', 'base_production', 'premium')
    AND (
      (SELECT auth.jwt() ->> 'role') = 'service_role'
      OR (
        (SELECT auth.jwt() ->> 'role') = 'authenticated'
        AND EXISTS (
          SELECT 1
          FROM public.profiles AS membership
          WHERE membership.id = (SELECT auth.uid())
            AND membership.org_id = p_org_id
        )
        AND (
          p_required <> 'premium'
          OR EXISTS (
            SELECT 1
            FROM public.organizations AS organization
            WHERE organization.id = p_org_id
              AND organization.product_experience = 'full_suite'
          )
        )
        AND (
          EXISTS (
            SELECT 1
            FROM public.org_subscriptions AS subscription
            WHERE subscription.org_id = p_org_id
              AND subscription.status IN (
                'active', 'authenticated', 'pending', 'paused',
                'halted', 'cancelled', 'completed'
              )
              AND (subscription.current_start IS NULL OR subscription.current_start <= now())
              AND (
                (subscription.current_end IS NULL AND subscription.status IN ('active', 'authenticated'))
                OR subscription.current_end + CASE
                  WHEN subscription.plan_tier = 'trial' THEN interval '0 seconds'
                  ELSE interval '24 hours'
                END >= now()
              )
              AND CASE
                WHEN p_required = 'premium' THEN subscription.plan_tier IN ('premium', 'trial')
                WHEN p_required = 'base_production' THEN subscription.plan_tier IN ('base', 'premium', 'trial')
                ELSE subscription.plan_tier IN ('lite', 'base', 'premium', 'trial')
              END
          )
          OR (
            -- A paid Base customer keeps the complete Lite costing desk after
            -- expiry. Only the Base production capability ends; records are
            -- retained and a later Base renewal restores production access.
            p_required = 'base'
            AND EXISTS (
              SELECT 1
              FROM public.org_subscriptions AS expired_base
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

REVOKE ALL ON FUNCTION public.org_has_subscription_tier(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_has_subscription_tier(uuid, text)
  TO authenticated, service_role;

-- Base Production Core policies all call this private predicate. Redefining
-- one helper updates the RLS boundary for jobs, metres, machines, batches,
-- advances, and settlements without duplicating entitlement logic.
CREATE OR REPLACE FUNCTION private.base_production_core_access(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    p_org_id IS NOT NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS membership
      WHERE membership.id = (SELECT auth.uid())
        AND membership.org_id = p_org_id
        AND membership.role::text = 'owner'
    )
    AND public.org_has_subscription_tier(p_org_id, 'base_production');
$function$;

REVOKE ALL ON FUNCTION private.base_production_core_access(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.base_production_core_access(uuid)
  TO authenticated;

COMMENT ON FUNCTION private.base_production_core_access(uuid) IS
  'Internal owner-and-Weavly-Base predicate for Base Production Core RLS policies.';

-- The first Base Production Core migration exposed the same predicate from
-- the public schema, and its earliest tables still reference that function in
-- their RLS policies. Keep that compatibility surface, but make it delegate
-- to the one centralized Base-only predicate above.
CREATE OR REPLACE FUNCTION public.base_production_core_access(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT private.base_production_core_access(p_org_id);
$function$;

REVOKE ALL ON FUNCTION public.base_production_core_access(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.base_production_core_access(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.base_production_core_access(uuid) IS
  'Compatibility wrapper for the centralized owner-and-Weavly-Base production predicate.';

-- ---------------------------------------------------------------------------
-- Existing-account migration
-- ---------------------------------------------------------------------------

-- Reclassify every former Base entitlement as Lite unless the organization
-- has an explicit Base workspace marker or already owns Base Production Core
-- records. This is intentionally reversible through a later entitlement
-- update and preserves every existing row and payment history.
WITH production_orgs AS (
  SELECT org_id FROM public.base_production_jobs
  UNION
  SELECT org_id FROM public.base_production_entries
  UNION
  SELECT org_id FROM public.base_production_workers
  UNION
  SELECT org_id FROM public.base_worker_advances
  UNION
  SELECT org_id FROM public.base_payroll_settlements
  UNION
  SELECT org_id FROM public.base_production_machines
  UNION
  SELECT org_id FROM public.base_production_batches
  UNION
  SELECT org_id FROM public.base_daily_production_entries
  UNION
  SELECT org_id FROM public.base_daily_production_allocations
)
UPDATE public.org_subscriptions AS subscription
SET plan_tier = CASE
      WHEN organization.product_experience = 'base'
        OR production_org.org_id IS NOT NULL THEN 'base'
      ELSE 'lite'
    END,
    plan_id = CASE
      WHEN organization.product_experience = 'base'
        OR production_org.org_id IS NOT NULL THEN 'weavly_base_2026'
      ELSE 'weavly_lite_2026'
    END,
    updated_at = now()
FROM public.organizations AS organization
LEFT JOIN production_orgs AS production_org
  ON production_org.org_id = organization.id
WHERE subscription.org_id = organization.id
  AND subscription.plan_tier = 'base';

COMMENT ON TABLE public.org_subscriptions IS
  'Tenant subscription lifecycle. lite is the complete former Base costing product; base adds Base Production Core; premium is retained for legacy operational history.';

-- ---------------------------------------------------------------------------
-- Checkout and renewal backstops
-- ---------------------------------------------------------------------------

ALTER TABLE public.billing_checkout_attempts
  DROP CONSTRAINT IF EXISTS billing_checkout_attempts_plan_tier_check;

ALTER TABLE public.billing_checkout_attempts
  ADD CONSTRAINT billing_checkout_attempts_plan_tier_check
  CHECK (plan_tier IN ('lite', 'base', 'premium'));

CREATE OR REPLACE FUNCTION public.claim_billing_checkout_attempt(
  p_org_id uuid,
  p_client_request_id text,
  p_plan_tier text,
  p_purchase_type text,
  p_billing_model text,
  p_base_amount_paise integer,
  p_gst_amount_paise integer,
  p_total_amount_paise integer,
  p_currency text DEFAULT 'INR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_existing public.billing_checkout_attempts%ROWTYPE;
  v_created public.billing_checkout_attempts%ROWTYPE;
BEGIN
  IF p_org_id IS NULL
     OR NULLIF(btrim(p_client_request_id), '') IS NULL
     OR p_plan_tier NOT IN ('lite', 'base', 'premium')
     OR p_purchase_type NOT IN ('initial_purchase', 'renewal')
     OR p_billing_model IS DISTINCT FROM 'upfront_first_year_plus_annual_renewal'
     OR p_currency IS DISTINCT FROM 'INR'
     OR p_total_amount_paise <= 0 THEN
    RAISE EXCEPTION 'Invalid billing attempt context.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  SELECT attempt.* INTO v_existing
  FROM public.billing_checkout_attempts AS attempt
  WHERE attempt.org_id = p_org_id
    AND attempt.client_request_id = p_client_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.plan_tier IS DISTINCT FROM p_plan_tier
       OR v_existing.purchase_type IS DISTINCT FROM p_purchase_type
       OR v_existing.total_amount_paise IS DISTINCT FROM p_total_amount_paise THEN
      RAISE EXCEPTION 'Billing request key was already used for another purchase.' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('isNew', false, 'attempt', to_jsonb(v_existing));
  END IF;

  SELECT attempt.* INTO v_existing
  FROM public.billing_checkout_attempts AS attempt
  WHERE attempt.org_id = p_org_id
    AND attempt.plan_tier = p_plan_tier
    AND attempt.purchase_type = p_purchase_type
    AND attempt.total_amount_paise = p_total_amount_paise
    AND attempt.status IN ('creating', 'created', 'processing', 'unknown', 'authorized', 'activation_pending')
  ORDER BY attempt.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object('isNew', false, 'attempt', to_jsonb(v_existing));
  END IF;

  INSERT INTO public.billing_checkout_attempts (
    org_id, client_request_id, plan_tier, purchase_type, billing_model,
    base_amount_paise, gst_amount_paise, total_amount_paise, currency,
    status, expires_at
  ) VALUES (
    p_org_id, btrim(p_client_request_id), p_plan_tier, p_purchase_type, p_billing_model,
    p_base_amount_paise, p_gst_amount_paise, p_total_amount_paise, p_currency,
    'creating', clock_timestamp() + interval '30 minutes'
  ) RETURNING * INTO v_created;

  RETURN jsonb_build_object('isNew', true, 'attempt', to_jsonb(v_created));
END;
$$;

REVOKE ALL ON FUNCTION public.claim_billing_checkout_attempt(uuid, text, text, text, text, integer, integer, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_billing_checkout_attempt(uuid, text, text, text, text, integer, integer, integer, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_manual_renewal_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_current_end timestamptz;
BEGIN
  IF NEW.billing_model IS DISTINCT FROM 'upfront_first_year_plus_annual_renewal'
     OR NEW.checkout_purchase_type IS DISTINCT FROM 'renewal'
     OR NEW.plan_tier NOT IN ('lite', 'base', 'premium') THEN
    RETURN NEW;
  END IF;

  SELECT MAX(history.current_end)
    INTO v_current_end
  FROM public.org_subscriptions AS history
  WHERE history.org_id = NEW.org_id
    AND history.id <> NEW.id
    AND history.plan_tier = NEW.plan_tier
    AND (
      history.razorpay_payment_id IS NOT NULL
      OR history.status IN ('active', 'authenticated', 'paused', 'completed')
      OR EXISTS (
        SELECT 1
        FROM public.subscription_payments AS payment
        WHERE payment.subscription_id = history.id
          AND payment.org_id = NEW.org_id
          AND payment.status = 'captured'
      )
    );

  IF v_current_end IS NOT NULL
     AND v_current_end > clock_timestamp() + interval '30 days' THEN
    RAISE EXCEPTION 'Manual renewal opens during the final 30 days of the current paid period.'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_manual_renewal_window
  ON public.org_subscriptions;
CREATE TRIGGER enforce_manual_renewal_window
  BEFORE INSERT OR UPDATE OF
    org_id, plan_tier, billing_model, checkout_purchase_type, status,
    razorpay_payment_id
  ON public.org_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_manual_renewal_window();

CREATE OR REPLACE FUNCTION public.enforce_paid_history_for_billing_renewal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_has_paid_history boolean;
BEGIN
  IF NEW.billing_model IS DISTINCT FROM 'upfront_first_year_plus_annual_renewal'
     OR NEW.checkout_purchase_type IS DISTINCT FROM 'renewal'
     OR NEW.plan_tier NOT IN ('lite', 'base', 'premium') THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.org_subscriptions AS history
    WHERE history.org_id = NEW.org_id
      AND history.id <> NEW.id
      AND history.plan_tier = NEW.plan_tier
      AND (
        history.razorpay_payment_id IS NOT NULL
        OR (
          history.razorpay_subscription_id IS NOT NULL
          AND history.current_start IS NOT NULL
          AND history.current_end IS NOT NULL
        )
        OR history.status IN ('active', 'authenticated', 'paused', 'completed', 'expired')
        OR EXISTS (
          SELECT 1
          FROM public.subscription_payments AS payment
          WHERE payment.subscription_id = history.id
            AND payment.org_id = NEW.org_id
            AND payment.status = 'captured'
        )
      )
  ) INTO v_has_paid_history;

  IF NOT v_has_paid_history THEN
    RAISE EXCEPTION 'Renewal pricing requires prior captured or paid history for this plan.'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_paid_history_for_billing_renewal
  ON public.org_subscriptions;
CREATE TRIGGER enforce_paid_history_for_billing_renewal
  BEFORE INSERT OR UPDATE OF
    org_id, plan_tier, status, billing_model, checkout_purchase_type,
    razorpay_payment_id, razorpay_subscription_id
  ON public.org_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_paid_history_for_billing_renewal();

-- ---------------------------------------------------------------------------
-- Atomic activation catalog
-- ---------------------------------------------------------------------------

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
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_order_billing_purchase_legacy(uuid, text, text, integer, text, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.activate_order_billing_purchase_legacy(uuid, text, text, integer, text, text, text, text)
  IS 'Atomically validates and activates a server-bound Weavly Lite, Weavly Base, or legacy operational purchase/renewal.';

-- ---------------------------------------------------------------------------
-- Plan usage analytics
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.plan_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_name text NOT NULL CHECK (event_name IN (
    'estimator_opened', 'costing_started', 'costing_completed',
    'costing_saved', 'costing_reopened', 'costing_recalculated',
    'quality_created', 'quality_reused', 'rate_book_viewed',
    'rate_book_action', 'production_cta_viewed', 'production_cta_clicked',
    'upgrade_screen_opened', 'base_pricing_viewed', 'upgrade_initiated',
    'upgrade_completed', 'production_created',
    'production_created_from_costing', 'production_status_updated',
    'production_quantity_updated', 'production_completed',
    'production_viewed', 'production_activity'
  )),
  plan_tier text NOT NULL CHECK (plan_tier IN ('none', 'trial', 'lite', 'base', 'premium')),
  properties jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(properties) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_usage_events_org_created_idx
  ON public.plan_usage_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS plan_usage_events_event_created_idx
  ON public.plan_usage_events(event_name, created_at DESC);

ALTER TABLE public.plan_usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.plan_usage_events FROM PUBLIC, anon, authenticated;
GRANT INSERT, SELECT ON TABLE public.plan_usage_events TO service_role;

COMMENT ON TABLE public.plan_usage_events IS
  'Server-recorded Lite/Base usage and conversion events. Client plan claims are never trusted; the API derives plan_tier from the active subscription.';
