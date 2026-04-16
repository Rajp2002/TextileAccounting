-- ============================================================
-- MIGRATION: Razorpay Subscription Schema
-- ============================================================
-- Creates three tables for subscription billing:
--   subscription_plans: reference table mirroring Razorpay plans
--   org_subscriptions:  per-org subscription lifecycle state
--   subscription_payments: payment history per org
--
-- Uses org_id (not factory_id) — this is Loomi's actual tenant key.
-- RLS: owners see their own org's data via profiles.org_id + role = 'owner'
-- Webhook handler uses service_role (createAdminClient) — bypasses RLS.
-- ============================================================

-- ── 1. Subscription plans (mirrors Razorpay) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id             text PRIMARY KEY,              -- Razorpay plan_id e.g. plan_XXXXXXXX
  name           text NOT NULL,
  amount_paise   integer NOT NULL,              -- Amount in paise (₹4000 = 400000)
  interval       text NOT NULL DEFAULT 'monthly',
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Per-org subscription state ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_subscriptions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  razorpay_subscription_id    text UNIQUE,
  razorpay_customer_id        text,
  plan_id                     text REFERENCES public.subscription_plans(id),
  -- Razorpay subscription status values:
  -- created | authenticated | active | paused | halted | cancelled | completed | expired
  status                      text NOT NULL DEFAULT 'created',
  current_start               timestamptz,
  current_end                 timestamptz,
  charge_at                   timestamptz,
  trial_end                   timestamptz,
  total_count                 integer,
  paid_count                  integer DEFAULT 0,
  remaining_count             integer,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Payment history ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id       uuid REFERENCES public.org_subscriptions(id),
  razorpay_payment_id   text UNIQUE,
  razorpay_order_id     text,
  amount_paise          integer NOT NULL,
  status                text NOT NULL,         -- captured | failed | refunded
  method                text,                  -- upi | card | netbanking | wallet
  captured_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ── 4. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org_id
  ON public.org_subscriptions(org_id);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_razorpay_id
  ON public.org_subscriptions(razorpay_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_org_id
  ON public.subscription_payments(org_id);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_razorpay_id
  ON public.subscription_payments(razorpay_payment_id);

-- ── 5. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- subscription_plans is read-only reference data — no RLS needed (not sensitive)
-- but we still protect it from anonymous writes
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read plans
CREATE POLICY "plans_authenticated_select"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (true);

-- Only service_role can write plans (via createAdminClient in server actions)
-- No INSERT/UPDATE/DELETE policy = service_role only

-- Owners can see their own org's subscription
CREATE POLICY "owners_see_own_subscription"
  ON public.org_subscriptions FOR SELECT
  USING (
    org_id = (
      SELECT org_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Owners can see their own org's payment history
CREATE POLICY "owners_see_own_payments"
  ON public.subscription_payments FOR SELECT
  USING (
    org_id = (
      SELECT org_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  );
