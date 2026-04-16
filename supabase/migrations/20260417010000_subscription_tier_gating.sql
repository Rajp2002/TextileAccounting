-- ============================================================
-- MIGRATION: Subscription Tier Gating
-- ============================================================
-- 1. Adds `tier` column to subscription_plans
-- 2. Adds `plan_tier` column to org_subscriptions
-- 3. Seeds the free 'trial' plan into subscription_plans
-- 4. Updates existing plan rows with their tiers
-- 5. Seeds all existing organizations with a 1-hour Premium
--    subscription (for test accounts that already exist)
-- ============================================================

-- ── 1. Add tier to subscription_plans ────────────────────────────────────────

ALTER TABLE public.subscription_plans
    ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'premium';

-- ── 2. Add plan_tier to org_subscriptions ────────────────────────────────────

ALTER TABLE public.org_subscriptions
    ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'premium';

-- ── 3. Seed the trial plan ────────────────────────────────────────────────────

INSERT INTO public.subscription_plans (id, name, amount_paise, interval, tier)
VALUES ('trial', '7-Day Free Trial', 0, 'monthly', 'trial')
ON CONFLICT (id) DO UPDATE SET
    name         = EXCLUDED.name,
    amount_paise = EXCLUDED.amount_paise,
    tier         = EXCLUDED.tier;

-- ── 4. Update existing paid plans with correct tiers ─────────────────────────

UPDATE public.subscription_plans
SET tier = 'base'
WHERE id = 'plan_SeGvwQdsTlRbZd';  -- Base Tier ₹2,360

UPDATE public.subscription_plans
SET tier = 'premium'
WHERE id = 'plan_SeGwtIQO8LE25h';  -- Premium Tier ₹5,900

-- ── 5. Seed existing orgs with 1-hour premium (all test accounts) ─────────────
-- This inserts a new 'active' premium row for every org that has no
-- subscription yet. If an org already has a row, we still insert a new
-- premium row (latest row wins in getOrgTier, giving them premium access).

INSERT INTO public.org_subscriptions (org_id, plan_id, plan_tier, status, current_end, total_count)
SELECT
    id           AS org_id,
    'plan_SeGwtIQO8LE25h' AS plan_id,
    'premium'    AS plan_tier,
    'active'     AS status,
    now() + interval '1 hour' AS current_end,
    12           AS total_count
FROM public.organizations;
