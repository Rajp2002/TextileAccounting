-- A failed or dismissed first checkout must not unlock renewal pricing.
-- The application derives purchase type before order creation; this trigger is
-- the database backstop for both order creation and later activation.

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
     OR NEW.plan_tier NOT IN ('base', 'premium') THEN
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

REVOKE ALL ON FUNCTION public.enforce_paid_history_for_billing_renewal()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_paid_history_for_billing_renewal
  ON public.org_subscriptions;

CREATE TRIGGER enforce_paid_history_for_billing_renewal
  BEFORE INSERT OR UPDATE OF
    org_id,
    plan_tier,
    status,
    billing_model,
    checkout_purchase_type,
    razorpay_payment_id,
    razorpay_subscription_id
  ON public.org_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_paid_history_for_billing_renewal();

COMMENT ON FUNCTION public.enforce_paid_history_for_billing_renewal()
IS 'Rejects Base or Premium renewal-priced order rows unless a distinct same-tier subscription has captured or otherwise proven paid history.';
