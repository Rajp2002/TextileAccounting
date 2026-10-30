-- Paid plans stay closed until the founder goes live; "Notify me" records who wanted to pay.
--
-- Spec: docs/superpowers/specs/2026-10-30-founder-metrics-and-activity-design.md, section C2.
-- Weavly takes no real money until the owner incorporates. private.paid_plans_state holds the
-- one go-live instant (NULL until then). public.paid_plans_state(org) tells the server whether
-- that org may check out: the app opens checkout for everyone after go-live, and before it
-- only for factories marked test, demo or internal (test keys only). Customers who tap
-- "Notify me" land in private.paid_plan_interest, one row per factory.

CREATE TABLE private.paid_plans_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  go_live_at timestamptz,
  go_live_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
INSERT INTO private.paid_plans_state (id) VALUES (true);
ALTER TABLE private.paid_plans_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.paid_plans_state FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE private.paid_plans_state IS 'Single row. go_live_at is NULL until the founder opens real payments (spec 2026-10-30 C2). Changed only by public.admin_go_live.';

CREATE FUNCTION public.paid_plans_state(p_org_id uuid) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'goLiveAt', (SELECT s.go_live_at FROM private.paid_plans_state s WHERE s.id),
    'testAccount', coalesce((
      SELECT private.resolve_reporting_cohort(r.cohort, u.email) IN ('test', 'demo', 'internal')
      FROM public.organizations o
      LEFT JOIN private.admin_org_reporting r ON r.org_id = o.id
      LEFT JOIN auth.users u ON u.id = o.owner_id
      WHERE o.id = p_org_id
    ), false)
  )
$$;
REVOKE ALL ON FUNCTION public.paid_plans_state(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paid_plans_state(uuid) TO service_role;
COMMENT ON FUNCTION public.paid_plans_state(uuid) IS 'Go-live instant and whether this org is a test/demo/internal account. Service role only; the org comes from the verified profile.';

CREATE TABLE private.paid_plan_interest (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  first_at timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz NOT NULL DEFAULT now(),
  taps integer NOT NULL DEFAULT 1 CHECK (taps >= 1),
  last_source text NOT NULL CHECK (last_source IN ('billing', 'plan_card', 'upgrade_preview'))
);
ALTER TABLE private.paid_plan_interest ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.paid_plan_interest FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE private.paid_plan_interest IS 'Factories whose owner tapped "Notify me when paid plans open" (spec 2026-10-30 C2). A willingness-to-pay signal for founder metrics.';

CREATE FUNCTION public.record_paid_plan_interest(p_org_id uuid, p_user_id uuid, p_source text) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_taps integer;
BEGIN
  INSERT INTO private.paid_plan_interest (org_id, user_id, last_source)
  VALUES (p_org_id, p_user_id, p_source)
  ON CONFLICT (org_id) DO UPDATE SET
    taps = private.paid_plan_interest.taps + 1,
    last_at = now(),
    user_id = EXCLUDED.user_id,
    last_source = EXCLUDED.last_source
  RETURNING taps INTO v_taps;
  RETURN v_taps;
END;
$$;
REVOKE ALL ON FUNCTION public.record_paid_plan_interest(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_paid_plan_interest(uuid, uuid, text) TO service_role;
COMMENT ON FUNCTION public.record_paid_plan_interest(uuid, uuid, text) IS 'Upserts one "Notify me" tap for a factory. Service role only; the route derives org and user from the verified session.';
