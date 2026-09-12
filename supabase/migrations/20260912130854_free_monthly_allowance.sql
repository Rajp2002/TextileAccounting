-- Change the Free allowance from two calculations per India-time week to two
-- calculations per India-time calendar month. Existing receipt rows remain
-- replayable, and any current-month usage is carried into the new bucket.

ALTER TABLE public.free_quota_policies
  ADD COLUMN period_unit text NOT NULL DEFAULT 'week'
  CHECK (period_unit IN ('week', 'month'));
ALTER TABLE public.free_quota_policies
  RENAME COLUMN weekly_limit TO monthly_limit;

ALTER TABLE public.free_weekly_usage
  RENAME TO free_monthly_usage;
ALTER TABLE public.free_monthly_usage
  RENAME CONSTRAINT free_weekly_usage_pkey TO free_monthly_usage_pkey;
ALTER TABLE public.free_monthly_usage
  RENAME CONSTRAINT free_weekly_usage_subject_id_fkey TO free_monthly_usage_subject_id_fkey;

-- Version 1 remains available as historical weekly policy metadata. New
-- periods use version 2, so active-window allowances stay frozen.
INSERT INTO public.free_quota_policies (
  version, monthly_limit, time_zone, reset_day, period_unit, receipt_retention_days
)
SELECT 2, monthly_limit, time_zone, reset_day, 'month', receipt_retention_days
FROM public.free_quota_policies
WHERE version = 1;

UPDATE public.free_rollout
SET policy_version = 2
WHERE singleton;

-- Carry usage from any old period overlapping the current India-time month.
-- The aggregate is capped at the new allowance; this is conservative when an
-- old weekly bucket crossed the calendar-month boundary and prevents a
-- rollout-time refill.
WITH bounds AS (
  SELECT date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')
    AT TIME ZONE 'Asia/Kolkata' AS period_start
), policy AS (
  SELECT version, monthly_limit
  FROM public.free_quota_policies
  WHERE version = 2
), current_usage AS (
  SELECT u.subject_id,
    bounds.period_start,
    bounds.period_start + interval '1 month' AS period_end,
    policy.version AS policy_version,
    policy.monthly_limit AS allowance,
    LEAST(policy.monthly_limit::bigint, SUM(u.used))::integer AS used
  FROM public.free_monthly_usage AS u
  CROSS JOIN bounds
  CROSS JOIN policy
  WHERE u.period_end > bounds.period_start
    AND u.period_start < bounds.period_start + interval '1 month'
  GROUP BY u.subject_id, bounds.period_start, policy.version, policy.monthly_limit
)
INSERT INTO public.free_monthly_usage AS target (
  subject_id, period_start, period_end, policy_version, allowance, used
)
SELECT subject_id, period_start, period_end, policy_version, allowance, used
FROM current_usage
ON CONFLICT (subject_id, period_start) DO UPDATE
SET period_end = EXCLUDED.period_end,
    policy_version = EXCLUDED.policy_version,
    allowance = EXCLUDED.allowance,
    used = LEAST(EXCLUDED.allowance, GREATEST(target.used, EXCLUDED.used));

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
      VALUES (v_subject.id, v_start, v_start + interval '1 month', v_policy.version, v_policy.monthly_limit)
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

COMMENT ON TABLE public.free_monthly_usage IS
  'Per-subject Free allowance periods. Historical rows may retain the prior weekly cadence; new rows are India-time calendar months.';
COMMENT ON COLUMN public.free_quota_policies.reset_day IS
  'Calendar reset day within the policy period. The current monthly policy resets on day 1 at local midnight.';

CREATE OR REPLACE FUNCTION public.prune_free_operational_metadata() RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  DELETE FROM public.free_calculation_receipts WHERE expires_at <= now();
  DELETE FROM public.free_funnel_events WHERE occurred_at < now()-interval '90 days';
  DELETE FROM public.free_monthly_usage u WHERE period_end < now()-interval '90 days'
    AND NOT EXISTS(SELECT 1 FROM public.free_calculation_receipts r WHERE r.subject_id=u.subject_id AND r.period_start=u.period_start);
$$;
COMMENT ON FUNCTION public.prune_free_operational_metadata() IS
  'Service-only scheduled retention: expired receipts, 90-day event/cohort and monthly allowance periods. Activate daily schedule only with reviewed retention policy.';

CREATE OR REPLACE VIEW public.free_support_status WITH (security_invoker=true) AS
 SELECT s.id AS subject_id,g.org_id,s.active,s.verified_at IS NOT NULL AS verified,s.beta_allowed,
  u.period_start,u.period_end,u.used,u.allowance,g.revoked_at
 FROM public.free_account_subjects s JOIN public.free_account_grants g ON g.subject_id=s.id
 LEFT JOIN public.free_monthly_usage u ON u.subject_id=s.id
  AND u.period_start=date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata';
