-- Founder controls for the paid-plan pilot: extend trials before go-live, and go live once.
--
-- Spec: docs/superpowers/specs/2026-10-30-founder-metrics-and-activity-design.md, section C2.
-- An unpaid trial is a Lite trial row whose factory has never had a non-trial subscription
-- with a payment reference. Extending moves those trials' end date, including trials that
-- already ended (the factory gets Lite back, since it could not have paid). Going live
-- records the instant once and gives any unpaid trial ending within 30 days a full 30 days.
-- Each change and its audit record commit together. There is no undo here.

CREATE FUNCTION private.unpaid_trial_subscriptions() RETURNS SETOF public.org_subscriptions
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT s.* FROM public.org_subscriptions s
  WHERE s.is_trial IS TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.org_subscriptions p
      WHERE p.org_id = s.org_id AND p.is_trial IS NOT TRUE AND p.razorpay_payment_id IS NOT NULL
    )
$$;
REVOKE ALL ON FUNCTION private.unpaid_trial_subscriptions() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.admin_paid_plans_summary(p_actor_id uuid, p_session_id uuid) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_result jsonb;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'ADMIN_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  PERFORM private.admin_assert_founder_session(p_actor_id, p_session_id);
  SELECT jsonb_build_object(
    'goLiveAt', (SELECT s.go_live_at FROM private.paid_plans_state s WHERE s.id),
    'endingIn14Days', count(*) FILTER (WHERE t.current_end >= now() AND t.current_end < now() + interval '14 days'),
    'endingIn30Days', count(*) FILTER (WHERE t.current_end > now() AND t.current_end < now() + interval '30 days'),
    'alreadyEnded', count(*) FILTER (WHERE t.current_end < now())
  ) INTO v_result
  FROM private.unpaid_trial_subscriptions() t;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_paid_plans_summary(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_paid_plans_summary(uuid, uuid) TO service_role;
COMMENT ON FUNCTION public.admin_paid_plans_summary(uuid, uuid) IS 'Founder-only: go-live instant and counts of unpaid trials ending within 14 and 30 days or already ended.';

CREATE FUNCTION public.admin_extend_trials(
  p_actor_id uuid, p_session_id uuid, p_new_end timestamptz, p_dry_run boolean, p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_live timestamptz;
  v_total integer;
  v_ended integer;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'ADMIN_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  PERFORM private.admin_assert_founder_session(p_actor_id, p_session_id);
  -- Serialize with go-live: no extension may land after paid plans open.
  SELECT s.go_live_at INTO v_live FROM private.paid_plans_state s WHERE s.id FOR UPDATE;
  IF v_live IS NOT NULL THEN
    RAISE EXCEPTION 'PAID_PLANS_LIVE' USING ERRCODE = '55000';
  END IF;
  IF p_new_end IS NULL OR p_new_end <= now() OR p_new_end > now() + interval '1 year' THEN
    RAISE EXCEPTION 'INVALID_TRIAL_END' USING ERRCODE = '22023';
  END IF;
  IF p_dry_run IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE t.current_end < now()) INTO v_total, v_ended
  FROM private.unpaid_trial_subscriptions() t
  WHERE t.current_end < p_new_end;

  IF NOT p_dry_run THEN
    UPDATE public.org_subscriptions s SET current_end = p_new_end
    WHERE s.id IN (SELECT t.id FROM private.unpaid_trial_subscriptions() t WHERE t.current_end < p_new_end);
    PERFORM private.admin_append_audit(
      p_actor_id, p_session_id, 'paid_plans.trials.extend', 'paid_plans', 'trials', 'success', p_request_id,
      NULL, NULL, jsonb_build_object('total', v_total, 'alreadyEnded', v_ended, 'newEnd', p_new_end)
    );
  END IF;
  RETURN jsonb_build_object('total', v_total, 'alreadyEnded', v_ended, 'newEnd', p_new_end);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_extend_trials(uuid, uuid, timestamptz, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_extend_trials(uuid, uuid, timestamptz, boolean, uuid) TO service_role;
COMMENT ON FUNCTION public.admin_extend_trials(uuid, uuid, timestamptz, boolean, uuid) IS 'Founder-only, before go-live: moves every unpaid trial ending before p_new_end to p_new_end (at most a year ahead). A dry run only counts.';

CREATE FUNCTION public.admin_go_live(p_actor_id uuid, p_session_id uuid, p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_live timestamptz;
  v_now timestamptz := now();
  v_moved integer;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'ADMIN_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  PERFORM private.admin_assert_founder_session(p_actor_id, p_session_id);
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;
  SELECT s.go_live_at INTO v_live FROM private.paid_plans_state s WHERE s.id FOR UPDATE;
  IF v_live IS NOT NULL THEN
    RAISE EXCEPTION 'PAID_PLANS_LIVE' USING ERRCODE = '55000';
  END IF;

  -- Nobody is asked to pay with less than 30 days' notice.
  UPDATE public.org_subscriptions s SET current_end = v_now + interval '30 days'
  WHERE s.id IN (
    SELECT t.id FROM private.unpaid_trial_subscriptions() t
    WHERE t.current_end > v_now AND t.current_end < v_now + interval '30 days'
  );
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  UPDATE private.paid_plans_state SET go_live_at = v_now, go_live_by = p_actor_id WHERE id;
  PERFORM private.admin_append_audit(
    p_actor_id, p_session_id, 'paid_plans.go_live', 'paid_plans', 'go_live', 'success', p_request_id,
    NULL, NULL, jsonb_build_object('goLiveAt', v_now, 'movedTrials', v_moved)
  );
  RETURN jsonb_build_object('goLiveAt', v_now, 'movedTrials', v_moved);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_go_live(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_go_live(uuid, uuid, uuid) TO service_role;
COMMENT ON FUNCTION public.admin_go_live(uuid, uuid, uuid) IS 'Founder-only, once: opens real payments and moves unpaid trials ending within 30 days to 30 days from now. Undo needs a deliberate database change.';
