-- Revised product contract: completed Free costings are retained and exportable.
-- Immutable snapshots do not create saved qualities or discover Rate Book yarns.
CREATE TABLE public.free_saved_costings (
 id uuid PRIMARY KEY,
 subject_id uuid NOT NULL REFERENCES public.free_account_subjects(id) ON DELETE CASCADE,
 org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 label text NOT NULL CHECK(char_length(label) BETWEEN 1 AND 120),
 estimate jsonb NOT NULL CHECK(jsonb_typeof(estimate)='object'),
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
 totals jsonb NOT NULL CHECK(jsonb_typeof(totals)='object'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX free_saved_costings_owner_created ON public.free_saved_costings(subject_id,created_at DESC);
ALTER TABLE public.free_saved_costings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.free_saved_costings FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.free_saved_costings TO service_role;
-- Read through the authenticated server endpoint; no public client write surface.
CREATE FUNCTION public.complete_free_saved_costing(
 p_user_id uuid,p_org_id uuid,p_request_id uuid,p_input_binding text,
 p_engine_version text,p_issued_at timestamptz,p_label text,
 p_estimate jsonb,p_result jsonb,p_totals jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v_quota jsonb;
BEGIN
 -- Nested function runs in this same transaction: saving failure rolls back debit.
 v_quota := public.commit_free_calculation(p_user_id,p_org_id,p_request_id,p_input_binding,p_engine_version,p_issued_at);
 INSERT INTO public.free_saved_costings(id,subject_id,org_id,label,estimate,result,totals)
 VALUES(p_request_id,p_user_id,p_org_id,p_label,p_estimate,p_result,p_totals)
 ON CONFLICT(id) DO NOTHING;
 RETURN v_quota || jsonb_build_object('savedCostingId',p_request_id);
END; $$;
REVOKE ALL ON FUNCTION public.complete_free_saved_costing(uuid,uuid,uuid,text,text,timestamptz,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_free_saved_costing(uuid,uuid,uuid,text,text,timestamptz,text,jsonb,jsonb,jsonb) TO service_role;
COMMENT ON TABLE public.free_saved_costings IS 'User-authorized immutable completed costings. Viewing/exporting costs no quota. Retained independently of 30-day operational receipts until account deletion.';
