-- Disabled foundation only. No existing account is enrolled or reclassified.
-- Business content must never be added to these operational tables.
CREATE TABLE public.free_quota_policies (
  version integer PRIMARY KEY CHECK (version > 0),
  weekly_limit integer NOT NULL CHECK (weekly_limit BETWEEN 1 AND 100),
  time_zone text NOT NULL CHECK (time_zone = 'Asia/Kolkata'),
  reset_day integer NOT NULL CHECK (reset_day = 1),
  receipt_retention_days integer NOT NULL CHECK (receipt_retention_days BETWEEN 1 AND 30)
);
INSERT INTO public.free_quota_policies VALUES (1, 2, 'Asia/Kolkata', 1, 30);

CREATE TABLE public.free_rollout (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  policy_version integer NOT NULL REFERENCES public.free_quota_policies(version),
  enrollment_enabled boolean NOT NULL DEFAULT false,
  estimation_enabled boolean NOT NULL DEFAULT false,
  tour_enabled boolean NOT NULL DEFAULT false
);
INSERT INTO public.free_rollout(singleton, policy_version) VALUES (true, 1);

-- A subject is anchored to the commercial owner's auth identity. Multiple
-- organization bindings share it; membership/workspace switching adds no quota.
CREATE TABLE public.free_account_subjects (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  verified_at timestamptz,
  beta_allowed boolean NOT NULL DEFAULT false
);
CREATE TABLE public.free_account_grants (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id),
  subject_id uuid NOT NULL REFERENCES public.free_account_subjects(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE TABLE public.free_weekly_usage (
  subject_id uuid NOT NULL REFERENCES public.free_account_subjects(id),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL CHECK (period_end > period_start),
  policy_version integer NOT NULL REFERENCES public.free_quota_policies(version),
  allowance integer NOT NULL CHECK (allowance > 0),
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0 AND used <= allowance),
  PRIMARY KEY (subject_id, period_start)
);
CREATE TABLE public.free_calculation_receipts (
  request_id uuid PRIMARY KEY,
  subject_id uuid NOT NULL,
  period_start timestamptz NOT NULL,
  input_binding text NOT NULL CHECK (input_binding ~ '^[a-f0-9]{64}$'),
  engine_version text NOT NULL CHECK (length(engine_version) BETWEEN 1 AND 80),
  issued_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > completed_at),
  FOREIGN KEY (subject_id, period_start) REFERENCES public.free_weekly_usage(subject_id, period_start)
);
CREATE INDEX free_calculation_receipts_expiry ON public.free_calculation_receipts(expires_at);

ALTER TABLE public.free_quota_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_rollout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_account_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_account_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_weekly_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_calculation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.free_quota_policies, public.free_rollout, public.free_account_subjects,
  public.free_account_grants, public.free_weekly_usage, public.free_calculation_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_quota_policies, public.free_rollout,
  public.free_account_subjects, public.free_account_grants, public.free_weekly_usage,
  public.free_calculation_receipts TO service_role;

-- Only the trusted calculation service may call this AFTER successfully
-- validating and calculating with the authoritative engine. p_issued_at must
-- come from a server-signed in-memory request token, never a browser claim.
-- The service must not return the computed result until this RPC commits.
CREATE FUNCTION public.commit_free_calculation(
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
  v_usage public.free_weekly_usage%ROWTYPE;
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

  -- Lock the persistent subject before checking receipts or creating the week's
  -- first row. This serializes same-subject retries, cross-workspace requests,
  -- initial-row races and distinct requests with one remaining allowance.
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
    SELECT * INTO STRICT v_usage FROM public.free_weekly_usage
      WHERE subject_id = v_subject.id AND period_start = v_receipt.period_start;
  ELSE
    -- Signed issuance time prevents an expired, purged request being accepted
    -- again. Tokens have a fixed retry lifetime of at most 30 days.
    IF p_issued_at <= v_now - make_interval(days => v_policy.receipt_retention_days) THEN
      RAISE EXCEPTION 'FREE_REQUEST_EXPIRED' USING ERRCODE = '22023';
    END IF;
    v_start := date_trunc('week', v_now AT TIME ZONE v_policy.time_zone) AT TIME ZONE v_policy.time_zone;
    INSERT INTO public.free_weekly_usage(subject_id, period_start, period_end, policy_version, allowance)
      VALUES (v_subject.id, v_start, v_start + interval '7 days', v_policy.version, v_policy.weekly_limit)
      ON CONFLICT (subject_id, period_start) DO NOTHING;
    SELECT * INTO STRICT v_usage FROM public.free_weekly_usage
      WHERE subject_id = v_subject.id AND period_start = v_start FOR UPDATE;
    IF v_usage.used >= v_usage.allowance THEN
      RAISE EXCEPTION 'FREE_QUOTA_EXHAUSTED' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.free_weekly_usage SET used = used + 1
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
COMMENT ON TABLE public.free_calculation_receipts IS
  'Operational receipts only: keyed input binding, never raw costing inputs or results. Maximum retry lifetime 30 days. Production retention scheduling requires launch review.';
