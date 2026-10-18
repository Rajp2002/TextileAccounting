-- Lite trial length: three months (90 days) instead of one month.
-- Replaces only the trial end in public.start_lite_trial from 20261011120000_base_suppression_and_lite_trial.sql.
-- Trial rows that already exist keep the current_end they were given. Only trials started after this
-- migration runs get the longer period. The function body is otherwise unchanged; grants are restated
-- so the privilege set stays explicit in this file.

CREATE OR REPLACE FUNCTION public.start_lite_trial(p_org_id uuid)
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
  VALUES (p_org_id, 'lite', 'active', now(), now() + interval '90 days', true)
  RETURNING id INTO v_trial_id;

  UPDATE public.organizations
  SET lite_trial_eligible = false
  WHERE id = p_org_id;

  RETURN v_trial_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_lite_trial(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_lite_trial(uuid) TO service_role;
