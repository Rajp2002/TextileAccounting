-- ============================================================
-- MIGRATION: Referral Scheme
-- ============================================================
-- 1. referral_codes: one code per org (owned by referrer)
-- 2. referral_uses: tracks each referree who claims a code
-- 3. referral_discount_windows: one row per converted referral, per referrer (3 months duration)
-- 4. referral_refunds: audit log of every discount-as-refund issued

-- 1. referral_codes: one code per org (owned by referrer)
CREATE TABLE public.referral_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE,            -- e.g. "WEAVLY-RAJ42"
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. referral_uses: tracks each referree who claims a code
CREATE TABLE public.referral_uses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id    uuid NOT NULL REFERENCES public.referral_codes(id),
  referee_org_id      uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'pending', -- pending | converted | expired
  signed_up_at        timestamptz NOT NULL DEFAULT now(),
  converted_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 3. referral_discount_windows: one row per converted referral, per referrer
-- Each row represents a 10% discount for 3 months
CREATE TABLE public.referral_discount_windows (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referral_use_id     uuid NOT NULL UNIQUE REFERENCES public.referral_uses(id) ON DELETE CASCADE,
  discount_pct        integer NOT NULL DEFAULT 10,       -- always 10%
  valid_from          timestamptz NOT NULL DEFAULT now(),
  valid_until         timestamptz NOT NULL,               -- valid_from + 3 months
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 4. referral_refunds: audit log of every discount-as-refund issued
CREATE TABLE public.referral_refunds (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  razorpay_payment_id     text NOT NULL,
  razorpay_refund_id      text,
  original_amount_paise   integer NOT NULL,
  refund_amount_paise     integer NOT NULL,
  discount_pct_applied    integer NOT NULL,  -- e.g. 30 for 3 active windows
  windows_applied         jsonb,             -- array of window IDs that contributed
  status                  text NOT NULL DEFAULT 'pending',  -- pending | issued | failed
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_referral_codes_org_id ON public.referral_codes(org_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_uses_code_id ON public.referral_uses(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_uses_referee_org ON public.referral_uses(referee_org_id);
CREATE INDEX IF NOT EXISTS idx_referral_discount_windows_referrer ON public.referral_discount_windows(referrer_org_id);
CREATE INDEX IF NOT EXISTS idx_referral_refunds_referrer ON public.referral_refunds(referrer_org_id);

-- ROW LEVEL SECURITY

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_discount_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_refunds ENABLE ROW LEVEL SECURITY;


-- referral_codes: Everyone can select (needed to resolve code -> org_id on signup)
--   Owners can manage their own org's code
CREATE POLICY "anyone_can_read_referral_codes"
  ON public.referral_codes FOR SELECT
  USING (true);

CREATE POLICY "owners_manage_own_referral_code"
  ON public.referral_codes
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- referral_uses: Owners can see uses where they are the referee or their code was used
CREATE POLICY "owners_see_own_referral_uses"
  ON public.referral_uses FOR SELECT
  USING (
    referee_org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner')
    OR
    referral_code_id IN (
      SELECT id FROM public.referral_codes 
      WHERE org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner')
    )
  );

-- referral_discount_windows: Owners see windows where they are the referrer
CREATE POLICY "owners_see_own_discount_windows"
  ON public.referral_discount_windows FOR SELECT
  USING (
    referrer_org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- referral_refunds: Owners see refunds where they are the referrer
CREATE POLICY "owners_see_own_refunds"
  ON public.referral_refunds FOR SELECT
  USING (
    referrer_org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid() AND role = 'owner')
  );
