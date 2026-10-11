-- Base suppression and the one-month Lite trial
-- (docs/superpowers/specs/2026-10-11-base-suppression-and-lite-trial-design.md).
-- Existing organizations keep Base visible and are not trial-eligible. New
-- organizations start with Base hidden and one Lite trial available.

ALTER TABLE public.organizations
  ADD COLUMN base_plan_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN lite_trial_eligible boolean NOT NULL DEFAULT true;

-- Runs before the guard trigger below exists, so this backfill is a migration
-- write rather than a plan-flag change made by a client session.
UPDATE public.organizations
SET base_plan_visible = true, lite_trial_eligible = false;

ALTER TABLE public.org_subscriptions
  ADD COLUMN is_trial boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT org_subscriptions_trial_shape_check CHECK (
    NOT is_trial
    OR (
      plan_tier = 'lite'
      AND razorpay_subscription_id IS NULL
      AND razorpay_payment_id IS NULL
    )
  );

CREATE UNIQUE INDEX org_subscriptions_one_trial_per_org
  ON public.org_subscriptions (org_id)
  WHERE is_trial;

-- Plan visibility and trial eligibility are decided by the server. Browser
-- sessions (authenticated or anon JWTs) cannot change them. Service-role
-- actions, migrations and direct database sessions without JWT claims can.
CREATE FUNCTION public.guard_organization_plan_flags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_changed := NEW.base_plan_visible IS DISTINCT FROM false
      OR NEW.lite_trial_eligible IS DISTINCT FROM true;
  ELSE
    v_changed := NEW.base_plan_visible IS DISTINCT FROM OLD.base_plan_visible
      OR NEW.lite_trial_eligible IS DISTINCT FROM OLD.lite_trial_eligible;
  END IF;

  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  IF coalesce((SELECT auth.jwt()) ->> 'role', '') IN ('', 'service_role')
    OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles AS r
      WHERE r.rolname = current_user AND r.rolsuper
    )
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Plan visibility and trial eligibility are managed by Weavly.'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_organization_plan_flags() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_organization_plan_flags
BEFORE INSERT OR UPDATE OF base_plan_visible, lite_trial_eligible ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.guard_organization_plan_flags();

-- The one database definition of established paid history. It mirrors
-- hasEstablishedPaidHistory in lib/subscription-access.ts exactly: a payment
-- id, an active/authenticated/completed/expired status, or a paused/halted/
-- cancelled status with a period date. Dismissed or failed checkouts without
-- those are not paid history, and a Lite trial row never is. Invoker rights:
-- callers need only the table privilege they already hold.
CREATE FUNCTION public.org_has_established_paid_history(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_subscriptions AS s
    WHERE s.org_id = p_org_id
      AND s.is_trial IS NOT TRUE
      AND (
        NULLIF(s.razorpay_payment_id, '') IS NOT NULL
        OR s.status IN ('active', 'authenticated', 'completed', 'expired')
        OR (
          s.status IN ('paused', 'halted', 'cancelled')
          AND (s.current_start IS NOT NULL OR s.current_end IS NOT NULL)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.org_has_established_paid_history(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_has_established_paid_history(uuid) TO service_role;

-- Starts the single 30-day Lite trial for an organization that holds a Free
-- grant and has no established paid history. The trial row carries no
-- Razorpay ids, so the payment webhook and the paid-activation trigger never
-- see it. Refusals raise P0001 with a fixed message the server action maps.
CREATE FUNCTION public.start_lite_trial(p_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_eligible boolean;
  v_trial_id uuid;
BEGIN
  SELECT o.lite_trial_eligible INTO v_eligible
  FROM public.organizations AS o
  WHERE o.id = p_org_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_eligible THEN
    RAISE EXCEPTION 'LITE_TRIAL_INELIGIBLE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.free_account_grants AS g
    WHERE g.org_id = p_org_id AND g.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LITE_TRIAL_FREE_GRANT_REQUIRED';
  END IF;

  IF public.org_has_established_paid_history(p_org_id) THEN
    RAISE EXCEPTION 'LITE_TRIAL_INELIGIBLE';
  END IF;

  INSERT INTO public.org_subscriptions (org_id, plan_tier, status, current_start, current_end, is_trial)
  VALUES (p_org_id, 'lite', 'active', now(), now() + interval '30 days', true)
  RETURNING id INTO v_trial_id;

  UPDATE public.organizations
  SET lite_trial_eligible = false
  WHERE id = p_org_id;

  RETURN v_trial_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_lite_trial(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_lite_trial(uuid) TO service_role;
