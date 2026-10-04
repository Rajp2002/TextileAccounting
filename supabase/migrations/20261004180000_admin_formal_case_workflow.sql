-- Founder case work around the existing privacy / security registers.
-- No message delivery, erasure, disclosure, legal deadline decision or lockdown.
-- All private data remains server-only; every RPC checks the live founder session.
CREATE TABLE private.admin_formal_cases (
 id uuid PRIMARY KEY,
 kind text NOT NULL CHECK(kind IN ('privacy','security')),
 grievance_id uuid UNIQUE REFERENCES public.grievances(id),
 incident_id uuid UNIQUE REFERENCES public.security_incidents(id),
 requester_user_id uuid REFERENCES auth.users(id),
 category text NOT NULL,
 intake_source text NOT NULL,
 received_at timestamptz,
 source_reference text,
 next_action text NOT NULL CHECK(char_length(btrim(next_action)) BETWEEN 3 AND 500),
 follow_up_due_at timestamptz,
 identity_evidence_ref text,
 acknowledged_at timestamptz,
 acknowledgement_evidence_ref text,
 outcome_code text CHECK(outcome_code IN ('response_recorded','request_fulfilled','partially_fulfilled','declined_with_reason','withdrawn','duplicate','remediated','no_incident_found')),
 outcome_summary text,
 outcome_evidence_ref text,
 response_recorded_at timestamptz,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='privacy' AND grievance_id=id AND incident_id IS NULL) OR (kind='security' AND incident_id=id AND grievance_id IS NULL))
);
CREATE INDEX admin_formal_due ON private.admin_formal_cases(follow_up_due_at,id);
CREATE TABLE private.admin_formal_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES private.admin_formal_cases(id),
 author_user_id uuid REFERENCES auth.users(id),body text NOT NULL CHECK(char_length(btrim(body)) BETWEEN 1 AND 10000),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.admin_formal_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES private.admin_formal_cases(id),
 actor_user_id uuid REFERENCES auth.users(id),event_type text NOT NULL,
 before_safe jsonb NOT NULL DEFAULT '{}',after_safe jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),request_id uuid NOT NULL,
 CHECK(private.admin_safe_audit_values(before_safe) AND private.admin_safe_audit_values(after_safe))
);
CREATE INDEX admin_formal_notes_page ON private.admin_formal_notes(case_id,created_at DESC,id DESC);
CREATE INDEX admin_formal_events_page ON private.admin_formal_events(case_id,created_at DESC,id DESC);
-- Corrections preserve the former operational evidence privately. These
-- snapshots never enter the minimal global audit or customer DTOs.
CREATE TABLE private.admin_formal_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES private.admin_formal_cases(id),
 version integer NOT NULL,actor_user_id uuid REFERENCES auth.users(id),request_id uuid NOT NULL,
 before_values jsonb NOT NULL,after_values jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(case_id,version)
);
CREATE INDEX admin_formal_revisions_page ON private.admin_formal_revisions(case_id,created_at DESC,id DESC);
CREATE TABLE private.admin_formal_request_results (
 actor_id uuid NOT NULL,request_id uuid NOT NULL,scope text NOT NULL,payload_hash text NOT NULL,
 case_id uuid NOT NULL REFERENCES private.admin_formal_cases(id),result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,request_id,scope)
);
ALTER TABLE private.admin_formal_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_formal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_formal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_formal_request_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_formal_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.admin_formal_cases,private.admin_formal_notes,private.admin_formal_events,private.admin_formal_request_results FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON private.admin_formal_revisions FROM PUBLIC,anon,authenticated,service_role;
-- Existing customer unlock intake uses a separately guarded server service.
-- No direct client access is needed for operator communications.
ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.grievances FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.admin_formal_safe_ref(p_value text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT p_value IS NULL OR (char_length(btrim(p_value)) BETWEEN 3 AND 300 AND p_value!~'[<>[:cntrl:]]'
 AND (p_value!~*'^[a-z]+:' OR (p_value~'^https://[^/@[:space:]]+([/?#].*)?$' AND p_value!~'^https://[^/]*@')));
$$;
CREATE VIEW private.admin_formal_source AS
 SELECT g.id,'privacy'::text AS kind,g.org_id,g.subject AS title,g.status,NULL::text AS severity,
 g.identity_verification_status AS identity_state,g.created_at AS recorded_at,g.target_resolution_date::text AS internal_target_date,
 g.description AS body,g.requester_email AS contact_email,g.acknowledged_at,g.resolved_at AS closed_at,
 NULL::text AS existing_assessment,NULL::timestamptz AS existing_assessment_due_at,g.response_summary AS original_response_summary,
 CASE WHEN g.resolution_proof_url IS NOT NULL THEN encode(extensions.digest(g.resolution_proof_url,'sha256'),'hex') END AS original_proof_hash,g.identity_verified_at
 FROM public.grievances g WHERE g.target_entity='WEAVLY' AND g.grievance_type='DATA_PRIVACY'
 UNION ALL
 SELECT s.id,'security',s.org_id,s.title,s.status,s.severity,NULL,s.created_at,NULL,s.summary,s.reported_by_email,
 NULL,s.closed_at,s.cert_in_assessment,s.cert_in_assessment_due_at,NULL,NULL,NULL FROM public.security_incidents s;
REVOKE ALL ON private.admin_formal_source FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.admin_formal_item(p_id uuid,p_kind text) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',s.id,'kind',s.kind,'orgId',s.org_id,'title',s.title,'status',s.status,'severity',s.severity,
 'identityState',s.identity_state,'recordedAt',s.recorded_at,'sortAt',coalesce(s.recorded_at,'1970-01-01'::timestamptz),
 'internalTargetDate',s.internal_target_date,'managed',c.id IS NOT NULL,'version',coalesce(c.version,0),'nextAction',c.next_action,'followUpDueAt',c.follow_up_due_at)
 FROM private.admin_formal_source s LEFT JOIN private.admin_formal_cases c ON c.id=s.id AND c.kind=s.kind WHERE s.id=p_id AND s.kind=p_kind;
$$;
CREATE FUNCTION private.admin_formal_snapshot(p_id uuid,p_kind text)RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('status',s.status,'severity',s.severity,'identityState',s.identity_state,'identityEvidenceRef',c.identity_evidence_ref,
 'acknowledgedAt',coalesce(s.acknowledged_at,c.acknowledged_at),'acknowledgementEvidenceRef',c.acknowledgement_evidence_ref,
 'outcomeCode',c.outcome_code,'outcomeSummary',coalesce(c.outcome_summary,s.original_response_summary),'outcomeEvidenceRef',c.outcome_evidence_ref,
 'responseRecordedAt',c.response_recorded_at,'closedAt',s.closed_at,'nextAction',c.next_action,'followUpDueAt',c.follow_up_due_at,'retainedProofHash',s.original_proof_hash,'identityVerifiedAt',s.identity_verified_at)
 FROM private.admin_formal_source s JOIN private.admin_formal_cases c ON c.id=s.id AND c.kind=s.kind WHERE s.id=p_id AND s.kind=p_kind;
$$;

CREATE FUNCTION public.admin_formal_read(p_actor_id uuid,p_session_id uuid,p_kind text,p_id uuid DEFAULT NULL,p_filters jsonb DEFAULT '{}',p_request_id uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_items jsonb;v_record jsonb;v_notes jsonb;v_events jsonb;v_revisions jsonb;v_history jsonb;v_as_of timestamptz:=now();v_limit integer;v_queue text;v_search text;v_cursor_at timestamptz;v_cursor_id uuid;v_history_at timestamptz;v_history_id uuid;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 PERFORM private.admin_assert_founder_session(p_actor_id,p_session_id);
 IF p_kind IS NULL OR p_kind NOT IN ('privacy','security') OR p_request_id IS NULL OR jsonb_typeof(p_filters)<>'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_filters)k WHERE k NOT IN ('limit','queue','search','cursorAt','cursorId','asOf','historyAt','historyId')) THEN RAISE EXCEPTION 'Invalid filter' USING ERRCODE='22023'; END IF;
 v_limit:=coalesce((p_filters->>'limit')::integer,25);v_queue:=coalesce(p_filters->>'queue','open');v_search:=coalesce(p_filters->>'search','');
 IF v_limit NOT BETWEEN 1 AND 100 OR v_queue NOT IN ('all','open','due','unmanaged') OR char_length(v_search)>160 THEN RAISE EXCEPTION 'Invalid list' USING ERRCODE='22023'; END IF;
 IF p_filters->>'asOf' IS NOT NULL THEN v_as_of:=(p_filters->>'asOf')::timestamptz; END IF;
 IF NOT isfinite(v_as_of) OR v_as_of>now()+interval '5 minutes' OR v_as_of<now()-interval '24 hours' THEN RAISE EXCEPTION 'Invalid snapshot' USING ERRCODE='22023'; END IF;
 v_cursor_at:=(p_filters->>'cursorAt')::timestamptz;v_cursor_id:=(p_filters->>'cursorId')::uuid;
 v_history_at:=(p_filters->>'historyAt')::timestamptz;v_history_id:=(p_filters->>'historyId')::uuid;
 IF (v_cursor_at IS NULL)<>(v_cursor_id IS NULL) OR (v_history_at IS NULL)<>(v_history_id IS NULL) THEN RAISE EXCEPTION 'Invalid cursor' USING ERRCODE='22023'; END IF;
 IF p_id IS NULL THEN
  SELECT coalesce(jsonb_agg(private.admin_formal_item(q.id,p_kind) ORDER BY q.sort_at DESC,q.id DESC),'[]') INTO v_items FROM (
   SELECT s.id,coalesce(s.recorded_at,'1970-01-01'::timestamptz) sort_at FROM private.admin_formal_source s LEFT JOIN private.admin_formal_cases c ON c.id=s.id AND c.kind=s.kind
   WHERE s.kind=p_kind AND (s.recorded_at IS NULL OR s.recorded_at<=v_as_of) AND (v_cursor_at IS NULL OR (coalesce(s.recorded_at,'1970-01-01'::timestamptz),s.id)<(v_cursor_at,v_cursor_id))
   AND (v_search='' OR strpos(lower(s.title),lower(v_search))>0)
   AND (v_queue='all' OR (v_queue='unmanaged' AND c.id IS NULL) OR (v_queue='open' AND s.status NOT IN ('resolved','closed')) OR (v_queue='due' AND s.status NOT IN ('resolved','closed') AND c.follow_up_due_at<v_as_of))
   ORDER BY sort_at DESC,s.id DESC LIMIT v_limit+1
  )q;
  PERFORM private.admin_append_audit(p_actor_id,p_session_id,'formal.list.read','formal_register',p_kind,'success',p_request_id,NULL,NULL,jsonb_build_object('count',jsonb_array_length(v_items),'kind',p_kind));
  RETURN jsonb_build_object('items',v_items,'asOf',v_as_of);
 END IF;
 SELECT private.admin_formal_item(s.id,s.kind)||jsonb_build_object('body',s.body,'contactEmail',s.contact_email,'category',coalesce(c.category,'other'),
 'source',c.intake_source,'receivedAt',c.received_at,'requesterBound',c.requester_user_id IS NOT NULL,'acknowledgedAt',coalesce(s.acknowledged_at,c.acknowledged_at),
 'acknowledgementEvidenceRef',c.acknowledgement_evidence_ref,'identityEvidenceRef',c.identity_evidence_ref,'outcomeCode',c.outcome_code,
 'outcomeSummary',coalesce(c.outcome_summary,s.original_response_summary),'outcomeEvidenceRef',c.outcome_evidence_ref,'responseRecordedAt',c.response_recorded_at,'closedAt',s.closed_at,
 'sourceReference',c.source_reference,'existingAssessment',s.existing_assessment,'existingAssessmentDueAt',s.existing_assessment_due_at)
 INTO v_record FROM private.admin_formal_source s LEFT JOIN private.admin_formal_cases c ON c.id=s.id AND c.kind=s.kind WHERE s.id=p_id AND s.kind=p_kind;
 IF v_record IS NULL THEN RAISE EXCEPTION 'Not found' USING ERRCODE='P0002'; END IF;
 -- One combined, bounded history window; separate DTO arrays do not lose entries.
 WITH history AS (
 SELECT n.id,n.created_at,'note'::text type,jsonb_build_object('id',n.id,'body',n.body,'createdAt',n.created_at) value FROM private.admin_formal_notes n WHERE n.case_id=p_id
 UNION ALL SELECT e.id,e.created_at,'event',jsonb_build_object('id',e.id,'eventType',e.event_type,'before',e.before_safe,'after',e.after_safe,'createdAt',e.created_at) FROM private.admin_formal_events e WHERE e.case_id=p_id
 UNION ALL SELECT r.id,r.created_at,'revision',jsonb_build_object('id',r.id,'version',r.version,'before',r.before_values,'after',r.after_values,'createdAt',r.created_at) FROM private.admin_formal_revisions r WHERE r.case_id=p_id
 ), selected AS(SELECT * FROM history WHERE v_history_at IS NULL OR(created_at,id)<(v_history_at,v_history_id) ORDER BY created_at DESC,id DESC LIMIT 101)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'at',created_at,'type',type,'value',value) ORDER BY created_at DESC,id DESC),'[]') INTO v_history FROM selected;
 SELECT coalesce(jsonb_agg(e->'value' ORDER BY ord),'[]') INTO v_notes FROM jsonb_array_elements(v_history)WITH ORDINALITY t(e,ord) WHERE e->>'type'='note' AND ord<=100;
 SELECT coalesce(jsonb_agg(e->'value' ORDER BY ord),'[]') INTO v_events FROM jsonb_array_elements(v_history)WITH ORDINALITY t(e,ord) WHERE e->>'type'='event' AND ord<=100;
 SELECT coalesce(jsonb_agg(e->'value' ORDER BY ord),'[]') INTO v_revisions FROM jsonb_array_elements(v_history)WITH ORDINALITY t(e,ord) WHERE e->>'type'='revision' AND ord<=100;
 PERFORM private.admin_append_audit(p_actor_id,p_session_id,'formal.detail.read','formal_case',p_id::text,'success',p_request_id);
 RETURN jsonb_build_object('record',v_record,'notes',v_notes,'events',v_events,'revisions',v_revisions,'nextHistoryCursor',CASE WHEN jsonb_array_length(v_history)>100 THEN jsonb_build_object('id',v_history->99->>'id','createdAt',v_history->99->>'at') ELSE NULL END,'asOf',now());
END;
$$;

CREATE FUNCTION public.admin_formal_mutate(p_actor_id uuid,p_session_id uuid,p_operation text,p_kind text,p_id uuid,p_payload jsonb,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid:=p_id;v_scope text;v_hash text;v_prior private.admin_formal_request_results;v_case private.admin_formal_cases;
 v_source private.admin_formal_source;v_result jsonb;v_before jsonb;v_after jsonb;v_expected integer;
 v_org uuid;v_requester uuid;v_received timestamptz;v_due timestamptz;v_status text;v_identity text;v_identity_ref text;
 v_ack timestamptz;v_ack_ref text;v_outcome text;v_summary text;v_outcome_ref text;v_response_at timestamptz;v_severity text;v_snapshot jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 PERFORM private.admin_assert_founder_session(p_actor_id,p_session_id);
 IF p_kind IS NULL OR p_kind NOT IN ('privacy','security') OR p_operation IS NULL OR p_operation NOT IN ('create','adopt','update','note')
 OR p_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR length(p_payload::text)>25000
 OR (p_operation='create' AND p_id IS NOT NULL) OR(p_operation<>'create' AND p_id IS NULL) THEN RAISE EXCEPTION 'Invalid operation' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload)k WHERE k NOT IN (
 'title','body','orgId','requesterUserId','contactEmail','receivedAt','nextAction','followUpDueAt','sourceReference','category','source',
 'expectedVersion','status','severity','identityState','identityEvidenceRef','acknowledgedAt','acknowledgementEvidenceRef',
 'outcomeCode','outcomeSummary','outcomeEvidenceRef','responseRecordedAt','reason')) THEN RAISE EXCEPTION 'Unexpected fields' USING ERRCODE='22023'; END IF;
 v_scope:=p_kind||':'||p_operation||':'||coalesce(p_id::text,'create');
 v_hash:=encode(extensions.digest(p_payload::text,'sha256'),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_id::text||':'||p_request_id::text||':'||v_scope,0));
 SELECT * INTO v_prior FROM private.admin_formal_request_results WHERE actor_id=p_actor_id AND request_id=p_request_id AND scope=v_scope;
 IF FOUND THEN
  IF v_prior.payload_hash<>v_hash THEN RAISE EXCEPTION 'Request key conflict' USING ERRCODE='40001'; END IF;
  RETURN v_prior.result;
 END IF;
 IF p_operation='create' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload)k WHERE k NOT IN('title','body','orgId','requesterUserId','contactEmail','receivedAt','nextAction','followUpDueAt','sourceReference','category','source')) THEN RAISE EXCEPTION 'Invalid create fields' USING ERRCODE='22023'; END IF;
  IF coalesce(char_length(btrim(p_payload->>'title')),0) NOT BETWEEN 3 AND 160 OR coalesce(char_length(btrim(p_payload->>'body')),0) NOT BETWEEN 10 AND 5000
  OR coalesce(char_length(btrim(p_payload->>'nextAction')),0) NOT BETWEEN 3 AND 500 OR p_payload->>'sourceReference' IS NULL OR NOT private.admin_formal_safe_ref(p_payload->>'sourceReference')
  OR (p_payload->>'contactEmail' IS NOT NULL AND (char_length(p_payload->>'contactEmail')>254 OR p_payload->>'contactEmail'!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) THEN RAISE EXCEPTION 'Invalid intake' USING ERRCODE='22023'; END IF;
  v_org:=(p_payload->>'orgId')::uuid;v_requester:=(p_payload->>'requesterUserId')::uuid;v_received:=(p_payload->>'receivedAt')::timestamptz;v_due:=(p_payload->>'followUpDueAt')::timestamptz;
  IF v_received IS NULL OR NOT isfinite(v_received) OR v_received>now() OR v_due IS NULL OR NOT isfinite(v_due) THEN RAISE EXCEPTION 'Receipt and follow-up required' USING ERRCODE='22023'; END IF;
  IF v_org IS NOT NULL THEN PERFORM 1 FROM public.organizations WHERE id=v_org FOR KEY SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Organization not found' USING ERRCODE='P0002'; END IF;END IF;
  IF v_requester IS NOT NULL THEN
   IF v_org IS NULL THEN RAISE EXCEPTION 'Requester mismatch' USING ERRCODE='22023'; END IF;
   PERFORM private.admin_data_rights_owner(v_requester,v_org);
  END IF;
  v_id:=gen_random_uuid();
  IF p_kind='privacy' THEN
   IF coalesce(p_payload->>'category','') NOT IN('access','correction','deletion','consent','security','grievance','other') OR coalesce(p_payload->>'source','') NOT IN('manual_email','manual_phone','manual_whatsapp','other') THEN RAISE EXCEPTION 'Invalid intake category' USING ERRCODE='22023'; END IF;
   INSERT INTO public.grievances(id,org_id,subject,description,status,target_entity,grievance_type,filed_by_role,requester_email,created_at,updated_at)
   VALUES(v_id,v_org,btrim(p_payload->>'title'),btrim(p_payload->>'body'),'pending','WEAVLY','DATA_PRIVACY','admin',p_payload->>'contactEmail',v_received,now());
  ELSE
   IF coalesce(p_payload->>'category','') NOT IN('account_compromise','unauthorized_access','billing_security','suspicious_message','service_vulnerability','availability','other') OR coalesce(p_payload->>'source','') NOT IN('customer','provider','monitoring','internal','other') THEN RAISE EXCEPTION 'Invalid incident category' USING ERRCODE='22023'; END IF;
   INSERT INTO public.security_incidents(id,org_id,title,summary,source,incident_type,aware_at,reported_by_email,created_by,updated_by,dpdp_board_assessment)
   VALUES(v_id,v_org,btrim(p_payload->>'title'),btrim(p_payload->>'body'),p_payload->>'source',p_payload->>'category',v_received,p_payload->>'contactEmail',p_actor_id,p_actor_id,'pending');
  END IF;
  INSERT INTO private.admin_formal_cases(id,kind,grievance_id,incident_id,requester_user_id,category,intake_source,received_at,source_reference,next_action,follow_up_due_at)
  VALUES(v_id,p_kind,CASE WHEN p_kind='privacy' THEN v_id END,CASE WHEN p_kind='security' THEN v_id END,v_requester,p_payload->>'category',p_payload->>'source',v_received,p_payload->>'sourceReference',btrim(p_payload->>'nextAction'),v_due) RETURNING * INTO v_case;
 ELSE
  IF p_kind='privacy' THEN PERFORM 1 FROM public.grievances WHERE id=v_id AND target_entity='WEAVLY' AND grievance_type='DATA_PRIVACY' FOR UPDATE;
  ELSE PERFORM 1 FROM public.security_incidents WHERE id=v_id FOR UPDATE;END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_source FROM private.admin_formal_source WHERE id=v_id AND kind=p_kind;
  v_snapshot:=private.admin_formal_snapshot(v_id,p_kind);
  SELECT * INTO v_case FROM private.admin_formal_cases WHERE id=v_id AND kind=p_kind FOR UPDATE;
  v_expected:=(p_payload->>'expectedVersion')::integer;
  IF v_expected IS NULL OR v_expected<>coalesce(v_case.version,0) THEN RAISE EXCEPTION 'Stale version' USING ERRCODE='40001'; END IF;
  IF p_operation='adopt' THEN
   IF v_case.id IS NOT NULL OR v_expected<>0 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload)k WHERE k NOT IN('expectedVersion','nextAction','followUpDueAt')) OR coalesce(char_length(btrim(p_payload->>'nextAction')),0) NOT BETWEEN 3 AND 500 OR p_payload->>'followUpDueAt' IS NULL THEN RAISE EXCEPTION 'Invalid adoption' USING ERRCODE='22023'; END IF;
   INSERT INTO private.admin_formal_cases(id,kind,grievance_id,incident_id,category,intake_source,received_at,next_action,follow_up_due_at)
   VALUES(v_id,p_kind,CASE WHEN p_kind='privacy' THEN v_id END,CASE WHEN p_kind='security' THEN v_id END,'other','retained_register',v_source.recorded_at,btrim(p_payload->>'nextAction'),(p_payload->>'followUpDueAt')::timestamptz) RETURNING * INTO v_case;
  ELSE
   IF v_case.id IS NULL THEN RAISE EXCEPTION 'Start case handling first' USING ERRCODE='22023'; END IF;
   v_before:=jsonb_build_object('status',v_source.status,'version',v_case.version,'kind',p_kind,'priority',v_source.severity);
   IF p_operation='note' THEN
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload)k WHERE k NOT IN('expectedVersion','body')) OR coalesce(char_length(btrim(p_payload->>'body')),0) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Invalid note' USING ERRCODE='22023'; END IF;
    INSERT INTO private.admin_formal_notes(case_id,author_user_id,body)VALUES(v_id,p_actor_id,btrim(p_payload->>'body'));
   ELSE
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload)k WHERE k NOT IN('expectedVersion','status','nextAction','followUpDueAt','severity','identityState','identityEvidenceRef','acknowledgedAt','acknowledgementEvidenceRef','outcomeCode','outcomeSummary','outcomeEvidenceRef','responseRecordedAt','reason')) THEN RAISE EXCEPTION 'Invalid update fields' USING ERRCODE='22023'; END IF;
    v_status:=p_payload->>'status';v_due:=(p_payload->>'followUpDueAt')::timestamptz;
    IF (v_due IS NOT NULL AND NOT isfinite(v_due)) THEN RAISE EXCEPTION 'Invalid follow-up' USING ERRCODE='22023'; END IF;
    IF coalesce(char_length(btrim(p_payload->>'reason')),0) NOT BETWEEN 3 AND 500 OR coalesce(char_length(btrim(p_payload->>'nextAction')),0) NOT BETWEEN 3 AND 500 OR v_status IS NULL OR (v_status NOT IN('resolved','closed') AND v_due IS NULL) THEN RAISE EXCEPTION 'Action and due date required' USING ERRCODE='22023'; END IF;
    v_outcome:=CASE WHEN p_payload?'outcomeCode' THEN p_payload->>'outcomeCode' ELSE v_case.outcome_code END;
    v_summary:=CASE WHEN p_payload?'outcomeSummary' THEN btrim(p_payload->>'outcomeSummary') ELSE coalesce(v_case.outcome_summary,v_source.original_response_summary) END;
    v_outcome_ref:=CASE WHEN p_payload?'outcomeEvidenceRef' THEN p_payload->>'outcomeEvidenceRef' ELSE v_case.outcome_evidence_ref END;
    v_response_at:=CASE WHEN p_payload?'responseRecordedAt' THEN(p_payload->>'responseRecordedAt')::timestamptz ELSE v_case.response_recorded_at END;
    IF NOT private.admin_formal_safe_ref(v_outcome_ref) OR (v_summary IS NOT NULL AND char_length(v_summary) NOT BETWEEN 3 AND 2000)
    OR (v_response_at IS NOT NULL AND(v_response_at>now() OR(v_case.received_at IS NOT NULL AND v_response_at<v_case.received_at))) THEN RAISE EXCEPTION 'Invalid outcome evidence' USING ERRCODE='22023'; END IF;
    IF v_status IN('resolved','closed') AND(v_outcome IS NULL OR v_summary IS NULL OR v_outcome_ref IS NULL) THEN RAISE EXCEPTION 'Closure evidence required' USING ERRCODE='22023'; END IF;
    v_ack:=CASE WHEN p_payload?'acknowledgedAt' THEN(p_payload->>'acknowledgedAt')::timestamptz ELSE coalesce(v_source.acknowledged_at,v_case.acknowledged_at) END;
    v_ack_ref:=CASE WHEN p_payload?'acknowledgementEvidenceRef' THEN p_payload->>'acknowledgementEvidenceRef' ELSE v_case.acknowledgement_evidence_ref END;
    IF NOT private.admin_formal_safe_ref(v_ack_ref) OR(v_ack IS NOT NULL AND((v_ack_ref IS NULL AND v_ack IS DISTINCT FROM coalesce(v_source.acknowledged_at,v_case.acknowledged_at)) OR v_ack>now() OR(v_case.received_at IS NOT NULL AND v_ack<v_case.received_at))) THEN RAISE EXCEPTION 'Acknowledgement evidence required' USING ERRCODE='22023'; END IF;
    IF p_kind='privacy' THEN
     IF v_status NOT IN('pending','acknowledged','escalated','resolved') OR p_payload?'severity' THEN RAISE EXCEPTION 'Invalid privacy state' USING ERRCODE='22023'; END IF;
     v_identity:=CASE WHEN p_payload?'identityState' THEN p_payload->>'identityState' ELSE v_source.identity_state END;
     v_identity_ref:=CASE WHEN p_payload?'identityEvidenceRef' THEN p_payload->>'identityEvidenceRef' ELSE v_case.identity_evidence_ref END;
     v_ack:=CASE WHEN p_payload?'acknowledgedAt' THEN(p_payload->>'acknowledgedAt')::timestamptz ELSE v_source.acknowledged_at END;
     v_ack_ref:=CASE WHEN p_payload?'acknowledgementEvidenceRef' THEN p_payload->>'acknowledgementEvidenceRef' ELSE v_case.acknowledgement_evidence_ref END;
     IF coalesce(v_identity,'') NOT IN('pending','verified','not_required','failed') OR NOT private.admin_formal_safe_ref(v_identity_ref) OR NOT private.admin_formal_safe_ref(v_ack_ref)
     OR(v_identity IN('verified','not_required') AND v_identity_ref IS NULL)
     OR(v_status='acknowledged' AND(v_ack IS NULL OR(v_source.status<>'acknowledged' AND v_ack_ref IS NULL))) OR(v_status='resolved' AND v_response_at IS NULL)
     OR(v_status='resolved' AND v_outcome IN('request_fulfilled','partially_fulfilled') AND v_identity<>'verified') THEN RAISE EXCEPTION 'Verification or response evidence required' USING ERRCODE='22023'; END IF;
     UPDATE public.grievances SET status=v_status,identity_verification_status=v_identity,
     identity_verified_at=CASE WHEN v_identity='verified' THEN coalesce(identity_verified_at,now()) ELSE NULL END,
     acknowledged_at=v_ack,resolved_at=CASE WHEN v_status='resolved' THEN coalesce(v_source.closed_at,now()) ELSE NULL END,response_summary=CASE WHEN p_payload?'outcomeSummary' THEN v_summary ELSE response_summary END,updated_at=now() WHERE id=v_id;
     UPDATE private.admin_formal_cases SET identity_evidence_ref=v_identity_ref,acknowledgement_evidence_ref=v_ack_ref WHERE id=v_id;
    ELSE
     IF v_status NOT IN('reported','triaging','contained','investigating','monitoring','closed') OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload)k WHERE k IN('identityState','identityEvidenceRef')) THEN RAISE EXCEPTION 'Invalid security state' USING ERRCODE='22023'; END IF;
     v_severity:=coalesce(p_payload->>'severity',v_source.severity);
     IF v_severity NOT IN('unassessed','low','medium','high','critical') THEN RAISE EXCEPTION 'Invalid severity' USING ERRCODE='22023'; END IF;
     UPDATE public.security_incidents SET status=v_status,severity=v_severity,updated_by=p_actor_id,closed_at=CASE WHEN v_status='closed' THEN coalesce(v_source.closed_at,now()) ELSE NULL END WHERE id=v_id;
    END IF;
    UPDATE private.admin_formal_cases SET next_action=btrim(p_payload->>'nextAction'),follow_up_due_at=v_due,acknowledged_at=v_ack,acknowledgement_evidence_ref=v_ack_ref,outcome_code=v_outcome,outcome_summary=v_summary,outcome_evidence_ref=v_outcome_ref,response_recorded_at=v_response_at WHERE id=v_id;
    INSERT INTO private.admin_formal_notes(case_id,author_user_id,body)VALUES(v_id,p_actor_id,'Change reason: '||btrim(p_payload->>'reason'));
   END IF;
   UPDATE private.admin_formal_cases SET version=version+1,updated_at=now() WHERE id=v_id RETURNING * INTO v_case;
  END IF;
 END IF;
 SELECT * INTO v_source FROM private.admin_formal_source WHERE id=v_id AND kind=p_kind;
 v_after:=jsonb_build_object('status',v_source.status,'version',v_case.version,'kind',p_kind,'priority',v_source.severity);
 INSERT INTO private.admin_formal_events(case_id,actor_user_id,event_type,before_safe,after_safe,request_id)VALUES(v_id,p_actor_id,p_operation,coalesce(v_before,'{}'),v_after,p_request_id);
 INSERT INTO private.admin_formal_revisions(case_id,version,actor_user_id,request_id,before_values,after_values)
 VALUES(v_id,v_case.version,p_actor_id,p_request_id,coalesce(v_snapshot,'{}'),private.admin_formal_snapshot(v_id,p_kind));
 PERFORM private.admin_append_audit(p_actor_id,p_session_id,'formal.'||p_operation,'formal_case',v_id::text,'success',p_request_id,NULL,v_before,v_after);
 v_result:=jsonb_build_object('id',v_id,'kind',p_kind,'version',v_case.version,'requestId',p_request_id);
 INSERT INTO private.admin_formal_request_results(actor_id,request_id,scope,payload_hash,case_id,result)VALUES(p_actor_id,p_request_id,v_scope,v_hash,v_id,v_result);
 RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION private.admin_formal_safe_ref(text),private.admin_formal_item(uuid,text),private.admin_formal_snapshot(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.admin_formal_read(uuid,uuid,text,uuid,jsonb,uuid),public.admin_formal_mutate(uuid,uuid,text,text,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_formal_read(uuid,uuid,text,uuid,jsonb,uuid),public.admin_formal_mutate(uuid,uuid,text,text,uuid,jsonb,uuid) TO service_role;
COMMENT ON TABLE private.admin_formal_cases IS 'Founder-only workflow sidecar for current source registers. Retention/disclosure/erasure require separate case review; no automatic purge.';

-- Preserve the existing locked owner's intake without exposing operator cases
-- or granting arbitrary direct writes to the register.
CREATE FUNCTION public.admin_owner_unlock_request(p_actor_id uuid,p_org_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 PERFORM private.admin_data_rights_owner(p_actor_id,p_org_id);
 IF coalesce(char_length(btrim(p_reason)),0) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'Invalid reason' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM public.organizations o WHERE o.id=p_org_id AND(o.is_locked_down OR EXISTS(SELECT 1 FROM public.platform_security s WHERE s.is_locked_down)) FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Locked organization required' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('unlock-intake:'||p_actor_id::text,0));
 SELECT id INTO v_id FROM public.grievances WHERE org_id=p_org_id AND target_entity='WEAVLY' AND grievance_type='UNLOCK_REQUEST' AND status='pending' AND description='Owner requested unlock. Reason given: '||btrim(p_reason) LIMIT 1;
 IF v_id IS NOT NULL THEN RETURN;END IF;
 INSERT INTO public.grievances(org_id,subject,description,target_entity,grievance_type,filed_by_role,status)
 VALUES(p_org_id,'TENANT UNLOCK REQUEST','Owner requested unlock. Reason given: '||btrim(p_reason),'WEAVLY','UNLOCK_REQUEST','owner','pending')RETURNING id INTO v_id;
 INSERT INTO public.audit_log(org_id,table_name,record_id,action,new_data,changed_by)
 VALUES(p_org_id,'grievances',v_id::text,'INSERT',jsonb_build_object('status','pending','grievance_type','UNLOCK_REQUEST'),p_actor_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_unlock_request(uuid,uuid,text)FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_owner_unlock_request(uuid,uuid,text)TO service_role;
