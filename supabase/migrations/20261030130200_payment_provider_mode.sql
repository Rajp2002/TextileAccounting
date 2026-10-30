-- Record whether each checkout attempt and payment ran on live or test Razorpay keys.
--
-- Spec: docs/superpowers/specs/2026-10-30-founder-metrics-and-activity-design.md, section C.
-- The mode was only known at runtime from the key prefix (lib/billing-readiness.ts), so
-- test payments were indistinguishable from real ones afterwards. create-order now writes
-- the mode onto the checkout attempt. Payment rows are written in four places (the
-- activation RPC and three webhook inserts), so a trigger copies the mode from the attempt
-- that created the provider order instead of touching every writer. Existing rows stay
-- NULL; founder revenue counts only 'live'.

ALTER TABLE public.billing_checkout_attempts
  ADD COLUMN provider_mode text CHECK (provider_mode IN ('live', 'test'));
ALTER TABLE public.subscription_payments
  ADD COLUMN provider_mode text CHECK (provider_mode IN ('live', 'test'));

CREATE FUNCTION private.fill_payment_provider_mode() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.provider_mode IS NULL AND NEW.razorpay_order_id IS NOT NULL THEN
    SELECT a.provider_mode INTO NEW.provider_mode
    FROM public.billing_checkout_attempts a
    WHERE a.provider_order_id = NEW.razorpay_order_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.fill_payment_provider_mode() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER subscription_payments_provider_mode
  BEFORE INSERT ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION private.fill_payment_provider_mode();

COMMENT ON COLUMN public.billing_checkout_attempts.provider_mode IS 'Razorpay key mode when the order was created: live or test. NULL for attempts before 2026-10-30.';
COMMENT ON COLUMN public.subscription_payments.provider_mode IS 'Copied from the checkout attempt that created the order. NULL means unknown and is treated as test in founder revenue.';
