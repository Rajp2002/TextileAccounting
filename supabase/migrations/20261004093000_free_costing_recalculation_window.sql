-- One metered Free costing can be revised in place for 30 minutes from creation.
-- Only the authenticated server's service role can call these functions.
ALTER TABLE public.free_saved_costings
  ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  ADD COLUMN updated_at timestamptz;
UPDATE public.free_saved_costings SET updated_at = created_at;
ALTER TABLE public.free_saved_costings ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.free_saved_costings ALTER COLUMN updated_at SET DEFAULT now();

CREATE TABLE public.free_costing_recalculation_receipts (
  request_id uuid PRIMARY KEY,
  costing_id uuid NOT NULL REFERENCES public.free_saved_costings(id) ON DELETE CASCADE,
  input_binding text NOT NULL,
  engine_version text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  response jsonb NOT NULL
);
CREATE INDEX free_costing_recalculation_receipts_costing ON public.free_costing_recalculation_receipts(costing_id);
CREATE INDEX free_costing_recalculation_receipts_expiry ON public.free_costing_recalculation_receipts(expires_at);
ALTER TABLE public.free_costing_recalculation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.free_costing_recalculation_receipts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.free_costing_recalculation_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.complete_free_saved_costing(
 p_user_id uuid,p_org_id uuid,p_request_id uuid,p_input_binding text,
 p_engine_version text,p_issued_at timestamptz,p_label text,
 p_estimate jsonb,p_result jsonb,p_totals jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v_quota jsonb; v_created timestamptz;
BEGIN
 v_quota := public.commit_free_calculation(p_user_id,p_org_id,p_request_id,p_input_binding,p_engine_version,p_issued_at);
 IF EXISTS(SELECT 1 FROM public.free_costing_recalculation_receipts WHERE request_id=p_request_id) THEN
   RAISE EXCEPTION 'FREE_REQUEST_CONFLICT' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.free_saved_costings(id,subject_id,org_id,label,estimate,result,totals)
 VALUES(p_request_id,p_user_id,p_org_id,p_label,p_estimate,p_result,p_totals)
 ON CONFLICT(id) DO NOTHING;
 SELECT created_at INTO STRICT v_created FROM public.free_saved_costings WHERE id=p_request_id;
 -- A replay confirms the original revision, never grants a new edit window.
 RETURN v_quota || jsonb_build_object('savedCostingId',p_request_id,'costingsUsed',1,
   'editWindow',jsonb_build_object('createdAt',v_created,'updatedAt',v_created,'revision',1,
     'editExpiresAt',v_created+interval '30 minutes','serverTime',clock_timestamp()));
END; $$;

CREATE FUNCTION public.recalculate_free_saved_costing(
 p_user_id uuid,p_org_id uuid,p_request_id uuid,p_input_binding text,
 p_engine_version text,p_issued_at timestamptz,p_costing_id uuid,p_expected_revision integer,
 p_label text,p_estimate jsonb,p_result jsonb,p_totals jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public SET timezone='UTC' AS $$
DECLARE
 v_subject public.free_account_subjects%ROWTYPE;
 v_saved public.free_saved_costings%ROWTYPE;
 v_receipt public.free_costing_recalculation_receipts%ROWTYPE;
 v_policy public.free_quota_policies%ROWTYPE;
 v_usage public.free_monthly_usage%ROWTYPE;
 v_now timestamptz;
 v_response jsonb;
BEGIN
 IF p_request_id IS NULL OR p_input_binding IS NULL OR p_input_binding !~ '^[a-f0-9]{64}$'
   OR p_engine_version IS NULL OR length(p_engine_version) NOT BETWEEN 1 AND 80
   OR p_issued_at IS NULL OR p_issued_at > clock_timestamp()
   OR p_costing_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 1 THEN
   RAISE EXCEPTION 'FREE_INVALID_INPUT' USING ERRCODE='22023';
 END IF;
 SELECT policy.* INTO v_policy FROM public.free_rollout rollout
 JOIN public.free_quota_policies policy ON policy.version=rollout.policy_version
 WHERE rollout.singleton AND rollout.estimation_enabled;
 IF NOT FOUND THEN RAISE EXCEPTION 'FREE_PAUSED'; END IF;

 -- Same lock order as the original debit; expiry is checked AFTER acquiring locks.
 SELECT subject.* INTO v_subject FROM public.free_account_subjects subject
 JOIN public.free_account_grants grant_row ON grant_row.subject_id=subject.id
 JOIN public.organizations org ON org.id=grant_row.org_id AND org.owner_id=subject.id
 JOIN public.profiles profile ON profile.org_id=org.id AND profile.id=p_user_id
 WHERE org.id=p_org_id AND subject.id=p_user_id AND profile.role='owner'
   AND profile.access_revoked_at IS NULL AND NOT coalesce(org.is_locked_down,false)
   AND subject.verified_at IS NOT NULL AND grant_row.revoked_at IS NULL
   AND subject.active AND subject.beta_allowed
 FOR UPDATE OF subject;
 IF NOT FOUND THEN RAISE EXCEPTION 'FREE_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 -- Repeat the paid-plan exclusion at the database write boundary.
 IF EXISTS(SELECT 1 FROM public.org_subscriptions s WHERE s.org_id=p_org_id
   AND s.plan_tier IN ('lite','base') AND (s.current_start IS NULL OR s.current_start <= clock_timestamp())
   AND ((s.status IN ('active','authenticated','pending','paused','halted','cancelled','completed')
     AND ((s.current_end IS NULL AND s.status IN ('active','authenticated')) OR s.current_end+interval '24 hours'>=clock_timestamp()))
     OR (s.plan_tier='base' AND s.current_end+interval '24 hours'<clock_timestamp()
       AND (s.razorpay_payment_id IS NOT NULL OR s.status IN ('active','authenticated','paused','halted','cancelled','completed','expired'))))) THEN
   RAISE EXCEPTION 'FREE_ACCESS_DENIED' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_saved FROM public.free_saved_costings
 WHERE id=p_costing_id AND subject_id=p_user_id AND org_id=p_org_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FREE_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 v_now := clock_timestamp();
 SELECT * INTO v_receipt FROM public.free_costing_recalculation_receipts WHERE request_id=p_request_id;
 IF FOUND THEN
   IF v_receipt.costing_id<>p_costing_id OR v_receipt.input_binding<>p_input_binding
     OR v_receipt.engine_version<>p_engine_version OR v_receipt.issued_at<>p_issued_at THEN
     RAISE EXCEPTION 'FREE_REQUEST_CONFLICT' USING ERRCODE='22023';
   END IF;
   IF v_receipt.expires_at<=v_now THEN RAISE EXCEPTION 'FREE_REQUEST_EXPIRED'; END IF;
   RETURN jsonb_set(jsonb_set(v_receipt.response,'{quota,replayed}','true'),'{editWindow,serverTime}',to_jsonb(v_now));
 END IF;
 -- A token cannot be used both for a metered creation and a revision.
 IF EXISTS(SELECT 1 FROM public.free_calculation_receipts WHERE request_id=p_request_id) THEN
   RAISE EXCEPTION 'FREE_REQUEST_CONFLICT' USING ERRCODE='22023';
 END IF;
 IF p_issued_at<=v_now-make_interval(days=>v_policy.receipt_retention_days) THEN RAISE EXCEPTION 'FREE_REQUEST_EXPIRED'; END IF;
 IF v_now>=v_saved.created_at+interval '30 minutes' THEN RAISE EXCEPTION 'FREE_EDIT_WINDOW_EXPIRED'; END IF;
 IF v_saved.revision<>p_expected_revision THEN RAISE EXCEPTION 'FREE_COSTING_CONFLICT'; END IF;

 UPDATE public.free_saved_costings SET label=p_label,estimate=p_estimate,result=p_result,totals=p_totals,
   updated_at=v_now,revision=revision+1 WHERE id=p_costing_id RETURNING * INTO v_saved;
 -- Read the creation's allowance receipt; revisions never increment monthly usage.
 SELECT usage.* INTO STRICT v_usage FROM public.free_monthly_usage usage
 JOIN public.free_calculation_receipts receipt ON receipt.subject_id=usage.subject_id AND receipt.period_start=usage.period_start
 WHERE receipt.request_id=p_costing_id;
 v_response := jsonb_build_object('result',p_result,'totals',p_totals,'savedCostingId',p_costing_id,'costingsUsed',0,
   'quota',jsonb_build_object('used',v_usage.used,'limit',v_usage.allowance,'remaining',v_usage.allowance-v_usage.used,
     'periodStart',v_usage.period_start,'resetsAt',v_usage.period_end,'policyVersion',v_usage.policy_version,'replayed',false,'requestId',p_request_id),
   'editWindow',jsonb_build_object('createdAt',v_saved.created_at,'updatedAt',v_saved.updated_at,'revision',v_saved.revision,
     'editExpiresAt',v_saved.created_at+interval '30 minutes','serverTime',v_now));
 INSERT INTO public.free_costing_recalculation_receipts(request_id,costing_id,input_binding,engine_version,issued_at,expires_at,response)
 VALUES(p_request_id,p_costing_id,p_input_binding,p_engine_version,p_issued_at,p_issued_at+make_interval(days=>v_policy.receipt_retention_days),v_response);
 RETURN v_response;
END; $$;
REVOKE ALL ON FUNCTION public.recalculate_free_saved_costing(uuid,uuid,uuid,text,text,timestamptz,uuid,integer,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_free_saved_costing(uuid,uuid,uuid,text,text,timestamptz,uuid,integer,text,jsonb,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.prune_free_operational_metadata() RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 DELETE FROM public.free_costing_recalculation_receipts WHERE expires_at<=now();
 DELETE FROM public.free_calculation_receipts WHERE expires_at<=now();
 DELETE FROM public.free_funnel_events WHERE occurred_at<now()-interval '90 days';
 DELETE FROM public.free_monthly_usage u WHERE period_end<now()-interval '90 days'
   AND NOT EXISTS(SELECT 1 FROM public.free_calculation_receipts r WHERE r.subject_id=u.subject_id AND r.period_start=u.period_start);
$$;
COMMENT ON TABLE public.free_saved_costings IS 'Completed Free costings. Revisions within 30 minutes of original creation update the same entry without a debit. Final thereafter; readable/exportable until account deletion.';
