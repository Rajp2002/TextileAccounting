-- Manual annual renewal is intentionally available only during the final
-- thirty days of the current paid period. The API enforces this rule before a
-- Razorpay order is created; this trigger is the database backstop for stale
-- clients and orders created before a session refresh.

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
     OR NEW.plan_tier NOT IN ('base', 'premium') THEN
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

REVOKE ALL ON FUNCTION public.enforce_manual_renewal_window()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_manual_renewal_window
  ON public.org_subscriptions;

CREATE TRIGGER enforce_manual_renewal_window
  BEFORE INSERT OR UPDATE OF
    org_id,
    plan_tier,
    billing_model,
    checkout_purchase_type,
    status,
    razorpay_payment_id
  ON public.org_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_manual_renewal_window();

COMMENT ON FUNCTION public.enforce_manual_renewal_window()
IS 'Prevents same-plan manual renewal orders more than 30 days before the current paid period ends.';
