-- The founder marks a factory as test, demo, internal or a real customer.
--
-- Spec: docs/superpowers/specs/2026-10-30-founder-metrics-and-activity-design.md, section B.
-- The classification and its audit record commit in one transaction. "Count as customer"
-- writes an explicit 'production' row rather than deleting, so the history stays visible.
--
-- private.admin_safe_audit_values is restated from 20261004150000 with the keys the paid-plan
-- controls record (cohort, total, alreadyEnded, newEnd, goLiveAt, movedTrials). Every existing
-- key and limit is unchanged; widening the allowlist keeps existing audit rows valid.

CREATE OR REPLACE FUNCTION private.admin_safe_audit_values(p_values jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_values IS NULL OR (
    jsonb_typeof(p_values) = 'object' AND length(p_values::text) <= 2000
    AND NOT EXISTS (SELECT 1 FROM jsonb_each(p_values) e WHERE
      e.key NOT IN ('status','priority','category','version','needsFounderReply','nextUpdateDueAt','followUpDueAt','resolutionCode','source','requesterBound','kind','count','mode','verificationState','reasonCode',
        'cohort','total','alreadyEnded','newEnd','goLiveAt','movedTrials')
      OR jsonb_typeof(e.value) NOT IN ('string','number','boolean','null')
      OR length(e.value::text) > 200)
  );
$$;

CREATE FUNCTION public.admin_set_org_cohort(
  p_actor_id uuid, p_session_id uuid, p_org_id uuid, p_cohort text, p_reason text, p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner_email text;
  v_explicit text;
  v_before text;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'ADMIN_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  PERFORM private.admin_assert_founder_session(p_actor_id, p_session_id);
  IF p_cohort IS NULL OR p_cohort NOT IN ('production', 'test', 'demo', 'internal') THEN
    RAISE EXCEPTION 'INVALID_COHORT' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'INVALID_COHORT_REASON' USING ERRCODE = '22023';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'REQUEST_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT u.email INTO v_owner_email
  FROM public.organizations o LEFT JOIN auth.users u ON u.id = o.owner_id
  WHERE o.id = p_org_id
  FOR UPDATE OF o;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORG_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  SELECT r.cohort INTO v_explicit FROM private.admin_org_reporting r WHERE r.org_id = p_org_id;
  v_before := private.resolve_reporting_cohort(v_explicit, v_owner_email);

  INSERT INTO private.admin_org_reporting (org_id, cohort, classification_reason, classified_at, classified_by)
  VALUES (p_org_id, p_cohort, btrim(p_reason), now(), p_actor_id)
  ON CONFLICT (org_id) DO UPDATE SET
    cohort = EXCLUDED.cohort,
    classification_reason = EXCLUDED.classification_reason,
    classified_at = EXCLUDED.classified_at,
    classified_by = EXCLUDED.classified_by;

  PERFORM private.admin_append_audit(
    p_actor_id, p_session_id, 'factory.cohort.set', 'organization', p_org_id::text, 'success', p_request_id,
    NULL, jsonb_build_object('cohort', v_before), jsonb_build_object('cohort', p_cohort)
  );
  RETURN jsonb_build_object('orgId', p_org_id, 'cohort', p_cohort);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_org_cohort(uuid, uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_org_cohort(uuid, uuid, uuid, text, text, uuid) TO service_role;
COMMENT ON FUNCTION public.admin_set_org_cohort(uuid, uuid, uuid, text, text, uuid) IS
  'Founder-only reporting classification for one factory, audited in the same transaction. Never changes access, billing or customer data.';
