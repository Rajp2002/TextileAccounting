-- FR05 (Free refinement sprint): store the India-time calendar month end.
--
-- commit_free_calculation runs with timezone = 'UTC' and stored
-- period_end = v_start + interval '1 month'. v_start is the IST month start
-- instant (the previous day at 18:30 UTC), so UTC month arithmetic clamps to
-- the previous month's length: March ended on 28 Mar, May on 30 May, July on
-- 30 Jul, October on 30 Oct and December on 30 Dec, a day or more early.
-- Bucket selection always used the correct start, and the status API derives
-- its reset date independently, so no early refill occurred. The wrong value
-- was returned as the receipt's resetsAt and would make a row eligible for
-- pruning early if retention were ever activated.
--
-- This migration changes metadata only. It does not change used, allowance,
-- period_start, policy_version, receipts, saved snapshots, grants, the
-- retention schedule or any entitlement. It is safe to run more than once.

-- One definition of the local month end, shared by the debit and the backfill.
-- Converting to local wall time first makes the result independent of the
-- session time zone.
CREATE OR REPLACE FUNCTION public.free_local_month_end(p_period_start timestamptz, p_time_zone text)
RETURNS timestamptz
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT (date_trunc('month', p_period_start AT TIME ZONE p_time_zone) + interval '1 month') AT TIME ZONE p_time_zone
$$;
REVOKE ALL ON FUNCTION public.free_local_month_end(timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.free_local_month_end(timestamptz, text) TO service_role;

-- Unchanged from 20260912130854_free_monthly_allowance.sql except the stored
-- period_end of a new monthly row.
CREATE OR REPLACE FUNCTION public.commit_free_calculation(
  p_user_id uuid, p_org_id uuid, p_request_id uuid,
  p_input_binding text, p_engine_version text, p_issued_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
SET timezone = 'UTC'
AS $$
DECLARE
  v_now timestamptz := now();
  v_subject public.free_account_subjects%ROWTYPE;
  v_policy public.free_quota_policies%ROWTYPE;
  v_receipt public.free_calculation_receipts%ROWTYPE;
  v_usage public.free_monthly_usage%ROWTYPE;
  v_start timestamptz;
  v_replay boolean := false;
BEGIN
  IF p_request_id IS NULL OR p_input_binding IS NULL OR p_input_binding !~ '^[a-f0-9]{64}$'
    OR p_engine_version IS NULL OR length(p_engine_version) NOT BETWEEN 1 AND 80
    OR p_issued_at IS NULL OR p_issued_at > v_now THEN
    RAISE EXCEPTION 'FREE_INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;
  SELECT policy.* INTO v_policy
    FROM public.free_rollout rollout
    JOIN public.free_quota_policies policy ON policy.version = rollout.policy_version
    WHERE rollout.singleton AND rollout.estimation_enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'FREE_PAUSED' USING ERRCODE = 'P0001'; END IF;

  -- Lock the persistent subject before checking receipts or creating the
  -- current month's first row. This serializes same-subject retries,
  -- cross-workspace requests, initial-row races and distinct requests with
  -- one remaining allowance.
  SELECT subject.* INTO v_subject
    FROM public.free_account_subjects subject
    JOIN public.free_account_grants grant_row ON grant_row.subject_id = subject.id
    JOIN public.organizations org ON org.id = grant_row.org_id AND org.owner_id = subject.id
    JOIN public.profiles profile ON profile.org_id = org.id AND profile.id = p_user_id
    WHERE org.id = p_org_id AND profile.role = 'owner'
      AND profile.access_revoked_at IS NULL AND NOT coalesce(org.is_locked_down, false)
      AND subject.verified_at IS NOT NULL
      AND grant_row.revoked_at IS NULL AND subject.active AND subject.beta_allowed
    FOR UPDATE OF subject;
  IF NOT FOUND THEN RAISE EXCEPTION 'FREE_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_receipt FROM public.free_calculation_receipts WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_receipt.subject_id <> v_subject.id OR v_receipt.input_binding <> p_input_binding
      OR v_receipt.engine_version <> p_engine_version OR v_receipt.issued_at <> p_issued_at THEN
      RAISE EXCEPTION 'FREE_REQUEST_CONFLICT' USING ERRCODE = '22023';
    END IF;
    IF v_receipt.expires_at <= v_now THEN
      RAISE EXCEPTION 'FREE_REQUEST_EXPIRED' USING ERRCODE = '22023';
    END IF;
    v_replay := true;
    SELECT * INTO STRICT v_usage FROM public.free_monthly_usage
      WHERE subject_id = v_subject.id AND period_start = v_receipt.period_start;
  ELSE
    -- Signed issuance time prevents an expired, purged request being accepted
    -- again. Tokens have a fixed retry lifetime of at most 30 days.
    IF p_issued_at <= v_now - make_interval(days => v_policy.receipt_retention_days) THEN
      RAISE EXCEPTION 'FREE_REQUEST_EXPIRED' USING ERRCODE = '22023';
    END IF;
    v_start := date_trunc('month', v_now AT TIME ZONE v_policy.time_zone)
      AT TIME ZONE v_policy.time_zone;
    INSERT INTO public.free_monthly_usage(subject_id, period_start, period_end, policy_version, allowance)
      VALUES (v_subject.id, v_start, public.free_local_month_end(v_start, v_policy.time_zone), v_policy.version, v_policy.monthly_limit)
      ON CONFLICT (subject_id, period_start) DO NOTHING;
    SELECT * INTO STRICT v_usage FROM public.free_monthly_usage
      WHERE subject_id = v_subject.id AND period_start = v_start FOR UPDATE;
    IF v_usage.used >= v_usage.allowance THEN
      RAISE EXCEPTION 'FREE_QUOTA_EXHAUSTED' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.free_monthly_usage SET used = used + 1
      WHERE subject_id = v_subject.id AND period_start = v_start RETURNING * INTO v_usage;
    INSERT INTO public.free_calculation_receipts(request_id, subject_id, period_start,
      input_binding, engine_version, issued_at, completed_at, expires_at)
      VALUES (p_request_id, v_subject.id, v_start, p_input_binding, p_engine_version,
        p_issued_at, v_now, p_issued_at + make_interval(days => v_policy.receipt_retention_days));
  END IF;
  RETURN jsonb_build_object('used', v_usage.used, 'limit', v_usage.allowance,
    'remaining', v_usage.allowance - v_usage.used, 'periodStart', v_usage.period_start,
    'resetsAt', v_usage.period_end, 'policyVersion', v_usage.policy_version,
    'replayed', v_replay, 'requestId', p_request_id);
END;
$$;


REVOKE ALL ON FUNCTION public.commit_free_calculation(uuid, uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_free_calculation(uuid, uuid, uuid, text, text, timestamptz) TO service_role;

-- Backfill period_end on rows whose captured policy is monthly and whose start
-- is a local month start in that policy's zone. Historical weekly rows and
-- any other anomaly are left for review. Only rows that differ are written.
UPDATE public.free_monthly_usage AS usage
SET period_end = public.free_local_month_end(usage.period_start, policy.time_zone)
FROM public.free_quota_policies AS policy
WHERE policy.version = usage.policy_version
  AND policy.period_unit = 'month'
  AND usage.period_start = date_trunc('month', usage.period_start AT TIME ZONE policy.time_zone) AT TIME ZONE policy.time_zone
  AND usage.period_end IS DISTINCT FROM public.free_local_month_end(usage.period_start, policy.time_zone);
