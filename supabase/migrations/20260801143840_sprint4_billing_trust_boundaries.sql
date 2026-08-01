-- Sprint 4 billing trust boundaries.
--
-- This migration is additive. It keeps org_subscriptions as the entitlement
-- record and adds separate attempt, invoice, refund, and export-run ledgers so
-- an uncertain checkout can never be mistaken for active access.

CREATE TABLE IF NOT EXISTS public.billing_checkout_attempts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_request_id     text NOT NULL,
  plan_tier             text NOT NULL CHECK (plan_tier IN ('base', 'premium')),
  purchase_type         text NOT NULL CHECK (purchase_type IN ('initial_purchase', 'renewal')),
  billing_model         text NOT NULL,
  base_amount_paise     integer NOT NULL CHECK (base_amount_paise > 0),
  gst_amount_paise      integer NOT NULL CHECK (gst_amount_paise >= 0),
  total_amount_paise    integer NOT NULL CHECK (total_amount_paise > 0),
  currency              text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status                text NOT NULL DEFAULT 'creating'
    CHECK (status IN (
      'creating', 'created', 'processing', 'unknown', 'failed', 'cancelled',
      'authorized', 'captured', 'activation_pending', 'activated', 'duplicate',
      'reconciliation_required', 'refunded'
    )),
  provider_order_id     text UNIQUE,
  provider_payment_id   text,
  provider_order_status text,
  provider_status       text,
  org_subscription_id   uuid REFERENCES public.org_subscriptions(id) ON DELETE SET NULL,
  failure_code          text,
  failure_reason        text,
  expires_at            timestamptz,
  last_checked_at       timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, client_request_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_attempts_org_created
  ON public.billing_checkout_attempts(org_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_attempts_one_active_intent
  ON public.billing_checkout_attempts(org_id, plan_tier, purchase_type)
  WHERE status IN ('creating', 'created', 'processing', 'unknown', 'authorized', 'activation_pending');

CREATE TABLE IF NOT EXISTS public.billing_payment_refunds (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  razorpay_payment_id   text NOT NULL UNIQUE,
  amount_paise          integer NOT NULL CHECK (amount_paise > 0),
  reason                text NOT NULL,
  status                text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'issued', 'failed')),
  idempotency_key       text NOT NULL UNIQUE,
  provider_refund_id    text,
  attempts              integer NOT NULL DEFAULT 1,
  last_error            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_billing_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  legal_name            text NOT NULL CHECK (length(btrim(legal_name)) BETWEEN 2 AND 160),
  address_line1         text NOT NULL CHECK (length(btrim(address_line1)) BETWEEN 3 AND 240),
  address_line2         text,
  city                  text NOT NULL CHECK (length(btrim(city)) BETWEEN 2 AND 100),
  state                 text NOT NULL CHECK (length(btrim(state)) BETWEEN 2 AND 100),
  state_code            text NOT NULL CHECK (state_code ~ '^[0-9]{2}$'),
  postal_code           text NOT NULL CHECK (postal_code ~ '^[0-9]{6}$'),
  billing_email         text NOT NULL CHECK (billing_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  gstin                 text CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.billing_invoice_sequences (
  financial_year       text PRIMARY KEY,
  next_number          integer NOT NULL DEFAULT 1 CHECK (next_number > 0),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_payment_id uuid NOT NULL UNIQUE REFERENCES public.subscription_payments(id) ON DELETE CASCADE,
  invoice_number       text NOT NULL UNIQUE,
  financial_year       text NOT NULL,
  issued_at             timestamptz NOT NULL DEFAULT now(),
  supplier_legal_name   text NOT NULL,
  supplier_gstin        text,
  supplier_address      text NOT NULL,
  supplier_state        text NOT NULL,
  supplier_state_code   text NOT NULL,
  supplier_postal_code  text NOT NULL,
  customer_legal_name   text NOT NULL,
  customer_gstin        text,
  customer_address      text NOT NULL,
  customer_city         text NOT NULL,
  customer_state        text NOT NULL,
  customer_state_code   text NOT NULL,
  customer_postal_code  text NOT NULL,
  customer_email        text NOT NULL,
  place_of_supply       text NOT NULL,
  sac                   text NOT NULL,
  taxable_amount_paise  integer NOT NULL CHECK (taxable_amount_paise >= 0),
  cgst_amount_paise     integer NOT NULL DEFAULT 0 CHECK (cgst_amount_paise >= 0),
  sgst_amount_paise     integer NOT NULL DEFAULT 0 CHECK (sgst_amount_paise >= 0),
  igst_amount_paise     integer NOT NULL DEFAULT 0 CHECK (igst_amount_paise >= 0),
  cess_amount_paise     integer NOT NULL DEFAULT 0 CHECK (cess_amount_paise >= 0),
  total_amount_paise    integer NOT NULL CHECK (total_amount_paise > 0),
  currency              text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status                text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'voided')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (
    taxable_amount_paise
      + cgst_amount_paise
      + sgst_amount_paise
      + igst_amount_paise
      + cess_amount_paise = total_amount_paise
  )
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_org_issued
  ON public.billing_invoices(org_id, issued_at DESC);

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_order_id text;

CREATE TABLE IF NOT EXISTS public.organization_export_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status                text NOT NULL CHECK (status IN ('generated', 'failed')),
  filename              text NOT NULL,
  schema_version        text NOT NULL DEFAULT 'sprint4-v1',
  exported_at           timestamptz NOT NULL DEFAULT now(),
  dataset_counts        jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_hash          text,
  failure_reason        text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_export_runs_org_created
  ON public.organization_export_runs(org_id, created_at DESC);

ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS billing_attempt_id uuid
    REFERENCES public.billing_checkout_attempts(id) ON DELETE SET NULL;

ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS billing_attempt_id uuid
    REFERENCES public.billing_checkout_attempts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_billing_attempt
  ON public.org_subscriptions(billing_attempt_id);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_billing_attempt
  ON public.subscription_payments(billing_attempt_id);

ALTER TABLE public.billing_checkout_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_export_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.billing_checkout_attempts FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_payment_refunds FROM anon, authenticated;
REVOKE ALL ON TABLE public.organization_billing_profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_invoice_sequences FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_invoices FROM anon, authenticated;
REVOKE ALL ON TABLE public.organization_export_runs FROM anon, authenticated;

GRANT SELECT ON TABLE public.billing_checkout_attempts TO authenticated;
GRANT SELECT ON TABLE public.organization_billing_profiles TO authenticated;
GRANT SELECT ON TABLE public.billing_invoices TO authenticated;
GRANT SELECT ON TABLE public.organization_export_runs TO authenticated;

DROP POLICY IF EXISTS billing_attempts_owner_select ON public.billing_checkout_attempts;
CREATE POLICY billing_attempts_owner_select
  ON public.billing_checkout_attempts FOR SELECT TO authenticated
  USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));

DROP POLICY IF EXISTS billing_profile_owner_select ON public.organization_billing_profiles;
CREATE POLICY billing_profile_owner_select
  ON public.organization_billing_profiles FOR SELECT TO authenticated
  USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));

DROP POLICY IF EXISTS billing_invoices_owner_select ON public.billing_invoices;
CREATE POLICY billing_invoices_owner_select
  ON public.billing_invoices FOR SELECT TO authenticated
  USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));

DROP POLICY IF EXISTS export_runs_owner_select ON public.organization_export_runs;
CREATE POLICY export_runs_owner_select
  ON public.organization_export_runs FOR SELECT TO authenticated
  USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner'));

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
     OR p_plan_tier NOT IN ('base', 'premium')
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

CREATE OR REPLACE FUNCTION public.attach_billing_checkout_order(
  p_attempt_id uuid,
  p_org_id uuid,
  p_provider_order_id text,
  p_org_subscription_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_attempt public.billing_checkout_attempts%ROWTYPE;
BEGIN
  UPDATE public.billing_checkout_attempts
  SET provider_order_id = p_provider_order_id,
      org_subscription_id = p_org_subscription_id,
      status = 'created',
      updated_at = clock_timestamp()
  WHERE id = p_attempt_id
    AND org_id = p_org_id
    AND (provider_order_id IS NULL OR provider_order_id = p_provider_order_id)
  RETURNING * INTO v_attempt;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billing attempt could not be attached to the provider order.' USING ERRCODE = '55000';
  END IF;

  RETURN to_jsonb(v_attempt);
END;
$$;

REVOKE ALL ON FUNCTION public.attach_billing_checkout_order(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_billing_checkout_order(uuid, uuid, text, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.next_billing_invoice_number(p_financial_year text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_number integer;
  v_short_year text;
BEGIN
  IF p_financial_year !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'Invalid financial year.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.billing_invoice_sequences(financial_year)
  VALUES (p_financial_year)
  ON CONFLICT (financial_year) DO NOTHING;

  SELECT next_number INTO v_number
  FROM public.billing_invoice_sequences
  WHERE financial_year = p_financial_year
  FOR UPDATE;

  UPDATE public.billing_invoice_sequences
  SET next_number = v_number + 1,
      updated_at = clock_timestamp()
  WHERE financial_year = p_financial_year;

  v_short_year := replace(p_financial_year, '20', '');
  RETURN 'WVL-' || v_short_year || '-' || lpad(v_number::text, 5, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_billing_invoice_number(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_billing_invoice_number(text)
  TO service_role;

-- A canonical capture may arrive after the owner closed the checkout. Reopen
-- only an unpaid local attempt; the captured provider payment remains the
-- authority and the normal atomic activation RPC still validates all context.
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
  v_result jsonb;
  v_existing_payment public.subscription_payments%ROWTYPE;
  v_attempt public.billing_checkout_attempts%ROWTYPE;
  v_subscription_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  SELECT payment.* INTO v_existing_payment
  FROM public.subscription_payments AS payment
  WHERE payment.status = 'captured'
    AND (payment.razorpay_payment_id = p_razorpay_payment_id OR payment.razorpay_order_id = p_razorpay_order_id)
  ORDER BY (payment.razorpay_payment_id = p_razorpay_payment_id) DESC
  LIMIT 1;

  IF FOUND THEN
    v_result := public.activate_order_billing_purchase_legacy(
      p_org_id, p_razorpay_order_id, p_razorpay_payment_id, p_amount_paise,
      p_method, p_plan_tier, p_purchase_type, p_currency
    );
    RETURN v_result;
  END IF;

  SELECT attempt.* INTO v_attempt
  FROM public.billing_checkout_attempts AS attempt
  WHERE attempt.org_id = p_org_id
    AND attempt.provider_order_id = p_razorpay_order_id
  FOR UPDATE;

  IF FOUND THEN
    v_subscription_id := v_attempt.org_subscription_id;
  END IF;

  IF p_purchase_type = 'initial_purchase'
     AND EXISTS (
       SELECT 1
       FROM public.org_subscriptions AS history
       WHERE history.org_id = p_org_id
         AND history.plan_tier = p_plan_tier
         AND history.razorpay_payment_id IS NOT NULL
         AND (v_subscription_id IS NULL OR history.id <> v_subscription_id)
     ) THEN
    IF v_attempt.id IS NOT NULL THEN
      UPDATE public.billing_checkout_attempts
      SET status = 'duplicate',
          provider_payment_id = p_razorpay_payment_id,
          provider_status = 'captured',
          updated_at = clock_timestamp()
      WHERE id = v_attempt.id;
    END IF;
    RAISE EXCEPTION 'This plan already has a captured purchase. The new payment requires reconciliation.'
      USING ERRCODE = '23505';
  END IF;

  IF v_subscription_id IS NOT NULL THEN
    UPDATE public.org_subscriptions
    SET status = 'created', updated_at = clock_timestamp()
    WHERE id = v_subscription_id
      AND razorpay_payment_id IS NULL
      AND status IN ('cancelled', 'halted', 'failed');
  END IF;

  v_result := public.activate_order_billing_purchase_legacy(
    p_org_id, p_razorpay_order_id, p_razorpay_payment_id, p_amount_paise,
    p_method, p_plan_tier, p_purchase_type, p_currency
  );

  UPDATE public.billing_checkout_attempts
  SET status = 'activated',
      provider_payment_id = p_razorpay_payment_id,
      provider_status = 'captured',
      updated_at = clock_timestamp()
  WHERE org_id = p_org_id
    AND provider_order_id = p_razorpay_order_id;

  UPDATE public.org_subscriptions
  SET billing_attempt_id = (
    SELECT id FROM public.billing_checkout_attempts
    WHERE org_id = p_org_id AND provider_order_id = p_razorpay_order_id
  )
  WHERE org_id = p_org_id AND razorpay_order_id = p_razorpay_order_id;

  UPDATE public.subscription_payments
  SET billing_attempt_id = (
    SELECT id FROM public.billing_checkout_attempts
    WHERE org_id = p_org_id AND provider_order_id = p_razorpay_order_id
  )
  WHERE org_id = p_org_id AND razorpay_payment_id = p_razorpay_payment_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_order_billing_purchase(uuid, text, text, integer, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_order_billing_purchase(uuid, text, text, integer, text, text, text, text)
  TO service_role;

COMMENT ON TABLE public.billing_checkout_attempts IS 'Tenant-scoped server-owned Razorpay checkout attempts. Access is granted only by captured subscription payments.';
COMMENT ON TABLE public.billing_invoices IS 'Immutable, provider-payment-linked GST invoice snapshots. Receipt rows are not invoices.';
COMMENT ON TABLE public.organization_export_runs IS 'Durable server-side organization export generation records; browser download completion is not asserted.';
