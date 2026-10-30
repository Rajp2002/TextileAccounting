-- Founder growth input: raw per-factory facts for the Metrics page and Today's contact lists.
--
-- Spec: docs/superpowers/specs/2026-10-30-founder-metrics-and-activity-design.md, sections D and F.
-- Production factories only (private.resolve_reporting_cohort). Every definition (revenue,
-- conversions, activation, time spent, ghosts) is computed in TypeScript from these facts, so
-- this function decides nothing. Money comes from the real payment tables: live payments
-- (provider_mode 'live') that were captured or refunded, and refunds marked issued. Dates are
-- bucketed in India time. Refuses more than 5,000 factories rather than truncating.

CREATE FUNCTION public.admin_growth_input(p_actor_id uuid, p_session_id uuid, p_as_of timestamptz) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today date;
  v_count bigint;
  v_result jsonb;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'ADMIN_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  PERFORM private.admin_assert_founder_session(p_actor_id, p_session_id);
  IF p_as_of IS NULL OR p_as_of > clock_timestamp() + interval '1 minute' OR p_as_of < clock_timestamp() - interval '1 day' THEN
    RAISE EXCEPTION 'ADMIN_INVALID_FILTER' USING ERRCODE = '22023';
  END IF;
  v_today := (p_as_of AT TIME ZONE 'Asia/Kolkata')::date;

  SELECT count(*) INTO v_count
  FROM public.organizations o
  LEFT JOIN private.admin_org_reporting r ON r.org_id = o.id
  LEFT JOIN auth.users u ON u.id = o.owner_id
  WHERE o.created_at <= p_as_of AND private.resolve_reporting_cohort(r.cohort, u.email) = 'production';
  IF v_count > 5000 THEN
    RAISE EXCEPTION 'ADMIN_GROWTH_BOUND' USING ERRCODE = '54000';
  END IF;

  WITH population AS MATERIALIZED (
    SELECT o.id, o.name, o.created_at, p.full_name, p.phone, u.email, u.last_sign_in_at,
      (o.created_at AT TIME ZONE 'Asia/Kolkata')::date AS signup_day
    FROM public.organizations o
    LEFT JOIN private.admin_org_reporting r ON r.org_id = o.id
    LEFT JOIN public.profiles p ON p.id = o.owner_id
    LEFT JOIN auth.users u ON u.id = o.owner_id
    WHERE o.created_at <= p_as_of AND private.resolve_reporting_cohort(r.cohort, u.email) = 'production'
  ), subs AS MATERIALIZED (
    SELECT s.org_id, jsonb_agg(jsonb_build_object(
      'id', s.id, 'status', s.status, 'plan_tier', s.plan_tier, 'current_start', s.current_start,
      'current_end', s.current_end, 'razorpay_payment_id', s.razorpay_payment_id, 'created_at', s.created_at,
      'is_trial', coalesce(s.is_trial, false)
    ) ORDER BY s.created_at, s.id) AS rows
    FROM public.org_subscriptions s JOIN population o ON o.id = s.org_id
    WHERE s.created_at <= p_as_of
    GROUP BY s.org_id
  ), saved AS MATERIALIZED (
    -- Original saved costings: Lite/Base first versions and Free saved costings.
    SELECT q.org_id, q.created_at FROM public.estimator_quotes q JOIN population o ON o.id = q.org_id
    WHERE q.record_kind = 'costing' AND q.template_id IS NULL AND q.version_number = 1 AND q.created_at <= p_as_of
    UNION ALL
    SELECT f.org_id, f.created_at FROM public.free_saved_costings f JOIN population o ON o.id = f.org_id
    WHERE f.created_at <= p_as_of
  ), costings AS MATERIALIZED (
    SELECT s.org_id, count(*) AS saved_count, min(s.created_at) AS first_at, max(s.created_at) AS latest_at,
      coalesce(jsonb_agg(DISTINCT to_char((s.created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD'))
        FILTER (WHERE (s.created_at AT TIME ZONE 'Asia/Kolkata')::date < o.signup_day + 30), '[]'::jsonb) AS early
    FROM saved s JOIN population o ON o.id = s.org_id
    GROUP BY s.org_id
  ), activity_months AS MATERIALIZED (
    SELECT a.org_id, to_char(a.day, 'YYYY-MM') AS month, sum(a.active_minutes) AS minutes,
      sum(a.phone_minutes) AS phone, sum(a.tablet_minutes) AS tablet, sum(a.desktop_minutes) AS desktop,
      sum(a.installed_minutes) AS installed
    FROM private.account_activity_days a JOIN population o ON o.id = a.org_id
    WHERE a.day >= v_today - 730 AND a.day <= v_today
    GROUP BY a.org_id, to_char(a.day, 'YYYY-MM')
  ), activity_areas AS MATERIALIZED (
    SELECT a.org_id, to_char(a.day, 'YYYY-MM') AS month, e.key, sum(e.value::integer) AS minutes
    FROM private.account_activity_days a
    JOIN population o ON o.id = a.org_id
    CROSS JOIN LATERAL jsonb_each_text(a.area_minutes) e
    WHERE a.day >= v_today - 730 AND a.day <= v_today
    GROUP BY a.org_id, to_char(a.day, 'YYYY-MM'), e.key
  ), activity AS MATERIALIZED (
    SELECT m.org_id, jsonb_agg(jsonb_build_object(
      'month', m.month, 'minutes', m.minutes,
      'areas', coalesce((SELECT jsonb_object_agg(x.key, x.minutes) FROM activity_areas x WHERE x.org_id = m.org_id AND x.month = m.month), '{}'::jsonb),
      'phone', m.phone, 'tablet', m.tablet, 'desktop', m.desktop, 'installed', m.installed
    ) ORDER BY m.month) AS months
    FROM activity_months m
    GROUP BY m.org_id
  ), activity_summary AS MATERIALIZED (
    SELECT a.org_id,
      coalesce(sum(a.active_minutes) FILTER (WHERE a.day > v_today - 30 AND a.day <= v_today), 0) AS last30,
      max(a.last_seen_at) FILTER (WHERE a.last_seen_at <= p_as_of) AS last_seen,
      coalesce(jsonb_agg(to_char(a.day, 'YYYY-MM-DD') ORDER BY a.day)
        FILTER (WHERE a.day < o.signup_day + 30 AND a.active_minutes > 0), '[]'::jsonb) AS early
    FROM private.account_activity_days a JOIN population o ON o.id = a.org_id
    GROUP BY a.org_id, o.signup_day
  ), payments AS MATERIALIZED (
    SELECT p.org_id, jsonb_agg(jsonb_build_object(
      'id', p.id, 'subscriptionId', p.subscription_id, 'amountPaise', p.amount_paise, 'status', p.status,
      'capturedAt', coalesce(p.captured_at, p.created_at),
      'planTier', CASE WHEN s.plan_tier IN ('lite', 'base') THEN s.plan_tier END,
      'purchaseType', CASE WHEN s.checkout_purchase_type IN ('initial_purchase', 'renewal') THEN s.checkout_purchase_type END
    ) ORDER BY coalesce(p.captured_at, p.created_at), p.id) AS rows
    FROM public.subscription_payments p
    JOIN population o ON o.id = p.org_id
    LEFT JOIN public.org_subscriptions s ON s.id = p.subscription_id
    WHERE p.provider_mode = 'live' AND p.status IN ('captured', 'refunded') AND coalesce(p.captured_at, p.created_at) <= p_as_of
    GROUP BY p.org_id
  ), refunds AS MATERIALIZED (
    SELECT p.org_id, jsonb_agg(jsonb_build_object('paymentId', p.id, 'amountPaise', r.amount_paise, 'at', r.updated_at) ORDER BY r.updated_at, r.id) AS rows
    FROM public.billing_payment_refunds r
    JOIN public.subscription_payments p ON p.razorpay_payment_id = r.razorpay_payment_id
    JOIN population o ON o.id = p.org_id
    WHERE r.status = 'issued' AND p.provider_mode = 'live' AND r.updated_at <= p_as_of
    GROUP BY p.org_id
  ), attempts AS MATERIALIZED (
    SELECT a.org_id, jsonb_agg(jsonb_build_object('at', a.created_at, 'status', a.status) ORDER BY a.created_at, a.id) AS rows
    FROM public.billing_checkout_attempts a JOIN population o ON o.id = a.org_id
    WHERE a.created_at > p_as_of - interval '14 days' AND a.created_at <= p_as_of
    GROUP BY a.org_id
  ), signals AS MATERIALIZED (
    -- Free funnel events belong to the owner subject; map them to each granted factory.
    SELECT g.org_id, jsonb_agg(jsonb_build_object('event', e.event_name, 'at', e.occurred_at) ORDER BY e.occurred_at) AS rows
    FROM public.free_funnel_events e
    JOIN public.free_account_grants g ON g.subject_id = e.subject_id
    JOIN population o ON o.id = g.org_id
    WHERE e.event_name IN ('quota_reached', 'upgrade_started') AND e.occurred_at > p_as_of - interval '14 days' AND e.occurred_at <= p_as_of
    GROUP BY g.org_id
  )
  SELECT jsonb_build_object(
    'asOf', p_as_of,
    'goLiveAt', (SELECT st.go_live_at FROM private.paid_plans_state st WHERE st.id),
    'trackingSince', (SELECT to_char(min(d.day), 'YYYY-MM-DD') FROM private.account_activity_days d),
    'factories', coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'name', o.name, 'createdAt', o.created_at,
      'owner', jsonb_build_object('name', o.full_name, 'phone', o.phone, 'email', o.email, 'lastSignInAt', o.last_sign_in_at),
      'subscriptions', coalesce(sb.rows, '[]'::jsonb),
      'hasFreeGrant', EXISTS (SELECT 1 FROM public.free_account_grants g WHERE g.org_id = o.id),
      'costings', jsonb_build_object('count', coalesce(c.saved_count, 0), 'first', c.first_at, 'latest', c.latest_at, 'earlyDays', coalesce(c.early, '[]'::jsonb)),
      'activity', jsonb_build_object('months', coalesce(ac.months, '[]'::jsonb), 'earlyDays', coalesce(sm.early, '[]'::jsonb),
        'minutesLast30', coalesce(sm.last30, 0), 'lastSeenAt', sm.last_seen),
      'payments', coalesce(pm.rows, '[]'::jsonb),
      'refunds', coalesce(rf.rows, '[]'::jsonb),
      'checkoutAttempts', coalesce(ca.rows, '[]'::jsonb),
      'freeSignals', coalesce(sg.rows, '[]'::jsonb),
      'interest', (SELECT jsonb_build_object('firstAt', i.first_at, 'lastAt', i.last_at, 'taps', i.taps, 'lastSource', i.last_source)
        FROM private.paid_plan_interest i WHERE i.org_id = o.id)
    ) ORDER BY o.created_at, o.id), '[]'::jsonb)
  ) INTO v_result
  FROM population o
  LEFT JOIN subs sb ON sb.org_id = o.id
  LEFT JOIN costings c ON c.org_id = o.id
  LEFT JOIN activity ac ON ac.org_id = o.id
  LEFT JOIN activity_summary sm ON sm.org_id = o.id
  LEFT JOIN payments pm ON pm.org_id = o.id
  LEFT JOIN refunds rf ON rf.org_id = o.id
  LEFT JOIN attempts ca ON ca.org_id = o.id
  LEFT JOIN signals sg ON sg.org_id = o.id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_growth_input(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_growth_input(uuid, uuid, timestamptz) TO service_role;
COMMENT ON FUNCTION public.admin_growth_input(uuid, uuid, timestamptz) IS
  'Founder-only raw facts for growth metrics (spec 2026-10-30 F): production factories, owner contact, subscriptions, saved costings, activity, live payments and issued refunds, recent checkout attempts, Free signals and Notify-me interest.';
