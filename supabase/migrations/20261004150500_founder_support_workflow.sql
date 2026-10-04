-- AD05: additive requester-only text support. No financial/business write access.
-- CLI created 20261004092731; ordered150500 after baseline+AD01 per AD00.
CREATE TABLE public.support_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES public.organizations(id),
 requester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 source text NOT NULL CHECK(source IN ('in_app','manual_email','manual_phone','manual_whatsapp')),
 subject text NOT NULL CHECK(length(subject) BETWEEN 3 AND 160 AND subject=btrim(subject)),
 category text NOT NULL CHECK(category IN ('onboarding','costing','production','inventory','payroll','billing_access','bug','other')),
 priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('critical','high','normal','low')),
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','waiting_on_customer','waiting_on_fix','resolved')),
 next_action text NOT NULL DEFAULT 'Founder to triage and reply' CHECK(length(next_action) BETWEEN 1 AND 500),
 follow_up_due_at timestamptz, next_update_due_at timestamptz, external_reference text CHECK(length(external_reference)<=500),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 last_customer_message_at timestamptz, last_public_founder_reply_at timestamptz, first_public_founder_reply_at timestamptz,
 last_customer_message_seq bigint, last_public_founder_reply_seq bigint, next_message_seq bigint NOT NULL DEFAULT 0,
 needs_founder_reply boolean NOT NULL DEFAULT true, update_promise_set_at timestamptz, update_promise_fulfilled_at timestamptz,
 resolved_at timestamptz, resolution_code text CHECK(resolution_code IN ('explained_behavior','setup_corrected','bug_fixed','billing_access_corrected','duplicate','cannot_reproduce','feature_request_recorded')),
 resolution_summary text CHECK(length(resolution_summary)<=10000), version integer NOT NULL DEFAULT 1, reopened_count integer NOT NULL DEFAULT 0,
 client_request_id uuid NOT NULL, idempotency_actor_key text NOT NULL, request_payload_hash text NOT NULL,
 UNIQUE(idempotency_actor_key,client_request_id),
 CHECK(status <> 'waiting_on_customer' OR follow_up_due_at IS NOT NULL),
 CHECK(status <> 'waiting_on_fix' OR (next_update_due_at IS NOT NULL AND external_reference IS NOT NULL)),
 CHECK(status <> 'resolved' OR (resolved_at IS NOT NULL AND resolution_code IS NOT NULL AND length(resolution_summary)>0))
);
CREATE TABLE public.support_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES public.support_tickets(id),
 author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, author_kind text NOT NULL CHECK(author_kind IN ('customer','founder')),
 message_kind text NOT NULL CHECK(message_kind IN ('initial_intake','public_reply')), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 10000 AND body=btrim(body)),
 created_at timestamptz NOT NULL DEFAULT now(),message_seq bigint NOT NULL, client_request_id uuid NOT NULL,idempotency_actor_key text NOT NULL,request_payload_hash text NOT NULL,
 UNIQUE(ticket_id,message_seq),UNIQUE(ticket_id,idempotency_actor_key,client_request_id)
);
CREATE TABLE private.support_internal_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES public.support_tickets(id),author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 10000 AND body=btrim(body)),created_at timestamptz NOT NULL DEFAULT now(),
 client_request_id uuid NOT NULL,idempotency_actor_key text NOT NULL,request_payload_hash text NOT NULL, UNIQUE(ticket_id,idempotency_actor_key,client_request_id)
);
CREATE TABLE public.support_ticket_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES public.support_tickets(id), actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 event_type text NOT NULL, before_safe jsonb NOT NULL DEFAULT '{}',after_safe jsonb NOT NULL DEFAULT '{}', public_visible boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),request_id uuid NOT NULL
);
CREATE TABLE private.support_request_results (
 actor_key text NOT NULL,request_id uuid NOT NULL,scope text NOT NULL,payload_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_key,request_id,scope)
);
CREATE INDEX support_requester_list ON public.support_tickets(org_id,requester_user_id,updated_at DESC,id DESC);
CREATE INDEX support_attention_list ON public.support_tickets(status,priority,next_update_due_at,updated_at DESC,id DESC);
CREATE INDEX support_reply_queue ON public.support_tickets(needs_founder_reply,updated_at DESC,id DESC);
CREATE INDEX support_message_timeline ON public.support_messages(ticket_id,created_at,id);
CREATE INDEX support_event_timeline ON public.support_ticket_events(ticket_id,created_at,id);
CREATE INDEX support_note_timeline ON private.support_internal_notes(ticket_id,created_at,id);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.support_internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.support_request_results ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION private.support_owner_org(p_actor uuid) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_org uuid;
BEGIN
 SELECT p.org_id INTO v_org FROM public.profiles p JOIN public.organizations o ON o.id=p.org_id JOIN auth.users u ON u.id=p.id
 WHERE p.id=p_actor AND p.role='owner' AND p.access_revoked_at IS NULL;
 IF v_org IS NULL THEN RAISE EXCEPTION 'SUPPORT_FORBIDDEN' USING ERRCODE='42501'; END IF;
 RETURN v_org;
END $$;
REVOKE ALL ON FUNCTION private.support_owner_org(uuid) FROM PUBLIC,anon,authenticated;
-- Policy checks use current profile, requester and membership, never JWT role/org hints.
CREATE FUNCTION public.support_is_requester(p_ticket uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.support_tickets t JOIN public.profiles p ON p.id=t.requester_user_id JOIN public.organizations o ON o.id=t.org_id
 WHERE t.id=p_ticket AND t.requester_user_id=auth.uid() AND p.role='owner' AND p.org_id=t.org_id AND p.access_revoked_at IS NULL)
$$;
REVOKE ALL ON FUNCTION public.support_is_requester(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_is_requester(uuid) TO authenticated;
CREATE POLICY support_requester_read ON public.support_tickets FOR SELECT TO authenticated USING(public.support_is_requester(id));
CREATE POLICY support_message_requester_read ON public.support_messages FOR SELECT TO authenticated USING(public.support_is_requester(ticket_id));
CREATE POLICY support_event_requester_read ON public.support_ticket_events FOR SELECT TO authenticated USING(public_visible AND public.support_is_requester(ticket_id));
-- Client table reads are also revoked: customer DTOs omit internal references/actions.
REVOKE ALL ON public.support_tickets,public.support_messages,public.support_ticket_events FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON private.support_internal_notes,private.support_request_results FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.support_tickets,public.support_messages,public.support_ticket_events TO service_role;

CREATE FUNCTION private.support_ticket_dto(t public.support_tickets,p_founder boolean) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',t.id,'orgId',t.org_id,'subject',t.subject,'category',t.category,'priority',t.priority,'status',t.status,
 'source',t.source,'requesterBound',t.requester_user_id IS NOT NULL,'createdAt',t.created_at,'updatedAt',t.updated_at,'version',t.version,
 'nextAction',CASE WHEN p_founder THEN t.next_action ELSE '' END,'followUpDueAt',CASE WHEN p_founder THEN t.follow_up_due_at ELSE NULL END,
 'nextUpdateDueAt',t.next_update_due_at,'needsFounderReply',t.needs_founder_reply,'resolvedAt',t.resolved_at,'resolutionCode',t.resolution_code,
 'resolutionSummary',t.resolution_summary,'firstPublicFounderReplyAt',t.first_public_founder_reply_at,'reopenedCount',t.reopened_count)
 || CASE WHEN p_founder THEN jsonb_build_object('externalReference',t.external_reference) ELSE '{}'::jsonb END
$$;
REVOKE ALL ON FUNCTION private.support_ticket_dto(public.support_tickets,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.admin_support_read(p_actor_id uuid,p_session_id uuid,p_operation text,p_ticket_id uuid DEFAULT NULL,p_filters jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_founder boolean:=p_session_id IS NOT NULL;v_org uuid;v_ticket public.support_tickets;v_result jsonb;v_limit integer;v_queue text;v_cursor jsonb;v_count bigint;v_items jsonb;v_as_of timestamptz;v_messages jsonb;v_events jsonb;v_notes jsonb;
BEGIN
 IF COALESCE(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'SUPPORT_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF v_founder THEN PERFORM private.admin_assert_founder_session(p_actor_id,p_session_id);
 ELSE v_org:=private.support_owner_org(p_actor_id); END IF;
 IF p_operation='detail' THEN
  SELECT * INTO v_ticket FROM public.support_tickets t WHERE t.id=p_ticket_id AND (v_founder OR (t.org_id=v_org AND t.requester_user_id=p_actor_id));
  IF NOT FOUND THEN RAISE EXCEPTION 'SUPPORT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',m.id,'authorKind',m.author_kind,'messageKind',m.message_kind,'body',m.body,'createdAt',m.created_at,'messageSeq',m.message_seq) ORDER BY m.message_seq DESC),'[]') INTO v_messages
  FROM (SELECT * FROM public.support_messages WHERE ticket_id=p_ticket_id AND(NOT(p_filters?'messageBefore') OR message_seq<(p_filters->>'messageBefore')::bigint) ORDER BY message_seq DESC LIMIT 201)m;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',e.id,'eventType',e.event_type,'before',e.before_safe,'after',e.after_safe,'createdAt',e.created_at) ORDER BY e.created_at DESC,e.id DESC),'[]') INTO v_events
  FROM(SELECT * FROM public.support_ticket_events WHERE ticket_id=p_ticket_id AND(v_founder OR public_visible) AND(NOT(p_filters?'eventBeforeId') OR(created_at,id)<((p_filters->>'eventBeforeAt')::timestamptz,(p_filters->>'eventBeforeId')::uuid)) ORDER BY created_at DESC,id DESC LIMIT 201)e;
  v_result:=jsonb_build_object('ticket',private.support_ticket_dto(v_ticket,v_founder),'asOf',now(),
  'messages',COALESCE((SELECT jsonb_agg(value ORDER BY ord DESC) FROM jsonb_array_elements(v_messages) WITH ORDINALITY x(value,ord) WHERE ord<=200),'[]'),
  'events',COALESCE((SELECT jsonb_agg(value ORDER BY ord DESC) FROM jsonb_array_elements(v_events) WITH ORDINALITY x(value,ord) WHERE ord<=200),'[]'),
  'nextMessageBefore',CASE WHEN jsonb_array_length(v_messages)>200 THEN (v_messages->199->>'messageSeq')::bigint ELSE NULL END,
  'nextEventBefore',CASE WHEN jsonb_array_length(v_events)>200 THEN jsonb_build_object('id',v_events->199->>'id','createdAt',v_events->199->>'createdAt') ELSE NULL END);
  IF v_founder THEN
   SELECT COALESCE(jsonb_agg(jsonb_build_object('id',n.id,'body',n.body,'createdAt',n.created_at) ORDER BY n.created_at DESC,n.id DESC),'[]') INTO v_notes
   FROM(SELECT * FROM private.support_internal_notes WHERE ticket_id=p_ticket_id AND(NOT(p_filters?'noteBeforeId') OR(created_at,id)<((p_filters->>'noteBeforeAt')::timestamptz,(p_filters->>'noteBeforeId')::uuid)) ORDER BY created_at DESC,id DESC LIMIT 201)n;
   v_result:=v_result||jsonb_build_object('internalNotes',COALESCE((SELECT jsonb_agg(value ORDER BY ord DESC) FROM jsonb_array_elements(v_notes) WITH ORDINALITY x(value,ord) WHERE ord<=200),'[]'),
   'nextNoteBefore',CASE WHEN jsonb_array_length(v_notes)>200 THEN jsonb_build_object('id',v_notes->199->>'id','createdAt',v_notes->199->>'createdAt') ELSE NULL END);
  END IF;
 ELSIF p_operation='summary' AND v_founder THEN
  SELECT jsonb_build_object('asOf',now(),'unanswered',count(*)FILTER(WHERE status<>'resolved' AND first_public_founder_reply_at IS NULL AND requester_user_id IS NOT NULL),
  'needsReply',count(*)FILTER(WHERE status<>'resolved' AND needs_founder_reply),'overduePromises',count(*)FILTER(WHERE status<>'resolved' AND requester_user_id IS NOT NULL AND next_update_due_at<now()),
  'overdueFollowUps',count(*)FILTER(WHERE status='waiting_on_customer' AND follow_up_due_at<now()),'reopened',count(*)FILTER(WHERE status<>'resolved' AND reopened_count>0),'waitingOnFix',count(*)FILTER(WHERE status='waiting_on_fix'),'critical',count(*)FILTER(WHERE status<>'resolved' AND priority='critical')) INTO v_result FROM public.support_tickets;
  v_result:=v_result||jsonb_build_object('attention',COALESCE((SELECT jsonb_agg(jsonb_build_object('id','support:'||t.id,'ticketId',t.id,'orgId',t.org_id,'subject',t.subject,'status',t.status,'priority',t.priority,'observedAt',CASE WHEN t.priority='critical' THEN t.created_at WHEN t.next_update_due_at<now() THEN t.next_update_due_at WHEN t.status='waiting_on_customer' AND t.follow_up_due_at<now() THEN t.follow_up_due_at ELSE COALESCE(t.last_customer_message_at,t.updated_at) END,'nextUpdateDueAt',t.next_update_due_at,'followUpDueAt',t.follow_up_due_at,'sortRank',CASE WHEN t.priority='critical' THEN 0 WHEN t.next_update_due_at<now() THEN 1 WHEN t.status='waiting_on_customer' AND t.follow_up_due_at<now() THEN 2 ELSE 3 END,'nextAction',t.next_action,'reason',CASE WHEN t.priority='critical' THEN 'Critical issue: review incident escalation' WHEN t.next_update_due_at<now() THEN CASE WHEN t.requester_user_id IS NOT NULL THEN 'Promised customer update overdue' ELSE 'Internal review update overdue' END WHEN t.status='waiting_on_customer' AND t.follow_up_due_at<now() THEN 'Internal customer follow-up due' ELSE 'Customer needs our reply' END)) FROM (SELECT * FROM public.support_tickets WHERE status<>'resolved' AND (needs_founder_reply OR next_update_due_at<now() OR(status='waiting_on_customer' AND follow_up_due_at<now()) OR priority='critical') ORDER BY CASE WHEN priority='critical' THEN 0 WHEN next_update_due_at<now() THEN 1 WHEN status='waiting_on_customer' AND follow_up_due_at<now() THEN 2 ELSE 3 END,created_at LIMIT 100)t),'[]'));
 ELSIF p_operation='list' THEN
  v_limit:=LEAST(100,GREATEST(1,COALESCE((p_filters->>'limit')::integer,25)));v_queue:=COALESCE(p_filters->>'queue','all');v_cursor:=p_filters->'cursor';v_as_of:=LEAST(now(),COALESCE((v_cursor->>'asOf')::timestamptz,now()));
  IF v_queue NOT IN('all','new','needs_reply','unanswered','updates_due','followups_due','waiting_on_customer','waiting_on_fix','billing_access','reopened','critical') THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023'; END IF;
  WITH matched AS (SELECT t AS ticket,t.updated_at,t.id,CASE WHEN NOT v_founder THEN 0 WHEN t.status='resolved' THEN 7 WHEN t.priority='critical' THEN 0 WHEN t.next_update_due_at<v_as_of THEN 1 WHEN t.status='waiting_on_customer' AND t.follow_up_due_at<v_as_of THEN 2 WHEN t.needs_founder_reply THEN 3 WHEN t.status='waiting_on_fix' THEN 4 WHEN t.status='new' THEN 5 ELSE 6 END AS sort_rank FROM public.support_tickets t WHERE (v_founder OR(t.org_id=v_org AND t.requester_user_id=p_actor_id))
    AND (NOT(p_filters?'orgId') OR t.org_id=(p_filters->>'orgId')::uuid) AND(NOT(p_filters?'status') OR t.status=p_filters->>'status')
    AND CASE v_queue WHEN 'new' THEN t.status='new' WHEN 'needs_reply' THEN t.status<>'resolved' AND t.needs_founder_reply WHEN 'unanswered' THEN t.status<>'resolved' AND t.first_public_founder_reply_at IS NULL AND t.requester_user_id IS NOT NULL
    WHEN 'updates_due' THEN t.status<>'resolved' AND t.requester_user_id IS NOT NULL AND t.next_update_due_at<now() WHEN 'followups_due' THEN t.status='waiting_on_customer' AND t.follow_up_due_at<now() WHEN 'waiting_on_customer' THEN t.status='waiting_on_customer' WHEN 'waiting_on_fix' THEN t.status='waiting_on_fix' WHEN 'billing_access' THEN t.category='billing_access' WHEN 'reopened' THEN t.status<>'resolved' AND t.reopened_count>0 WHEN 'critical' THEN t.status<>'resolved' AND t.priority='critical' ELSE true END),
  page AS(SELECT * FROM matched WHERE v_cursor IS NULL OR sort_rank>(v_cursor->>'rank')::integer OR(sort_rank=(v_cursor->>'rank')::integer AND(updated_at,id)<((v_cursor->>'updatedAt')::timestamptz,(v_cursor->>'id')::uuid)) ORDER BY sort_rank,updated_at DESC,id DESC LIMIT v_limit+1)
  SELECT (SELECT count(*) FROM matched),COALESCE(jsonb_agg(private.support_ticket_dto(page.ticket,v_founder)||jsonb_build_object('sortRank',sort_rank) ORDER BY sort_rank,updated_at DESC,id DESC),'[]') INTO v_count,v_items FROM page;
  v_result:=jsonb_build_object('items',v_items,'totalMatching',v_count,'asOf',v_as_of);
 ELSE RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023'; END IF;
 IF v_founder THEN PERFORM private.admin_append_audit(p_actor_id,p_session_id,'support.'||p_operation,'support',COALESCE(p_ticket_id::text,'queue'),'success',gen_random_uuid()); END IF;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.admin_support_read(uuid,uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_support_read(uuid,uuid,text,uuid,jsonb) TO service_role;

CREATE FUNCTION public.admin_support_mutate(p_actor_id uuid,p_session_id uuid,p_operation text,p_ticket_id uuid,p_payload jsonb,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_founder boolean:=p_session_id IS NOT NULL;v_org uuid;v_requester uuid;v_actor text:=p_actor_id::text;v_hash text;v_scope text:=p_operation||':'||COALESCE(p_ticket_id::text,'create');v_prior private.support_request_results;
 t public.support_tickets;v_before jsonb;v_result jsonb;v_body text:=btrim(p_payload->>'body');v_status text;v_seq bigint;v_now timestamptz:=clock_timestamp();v_public boolean:=false;v_reference text;v_new_due timestamptz;v_follow_due timestamptz;v_resolution text;
BEGIN
 IF COALESCE(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'SUPPORT_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF v_founder THEN PERFORM private.admin_assert_founder_session(p_actor_id,p_session_id);ELSE v_org:=private.support_owner_org(p_actor_id); END IF;
 IF p_request_id IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
 v_hash:=encode(extensions.digest(p_payload::text,'sha256'),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor||':'||p_request_id::text||':'||v_scope,0));
 SELECT * INTO v_prior FROM private.support_request_results WHERE actor_key=v_actor AND request_id=p_request_id AND scope=v_scope;
 IF FOUND THEN IF v_prior.payload_hash<>v_hash THEN RAISE EXCEPTION 'SUPPORT_IDEMPOTENCY_MISMATCH' USING ERRCODE='40001';END IF; RETURN v_prior.result; END IF;
 IF p_operation='create' THEN
  IF length(v_body) NOT BETWEEN 1 AND 10000 OR length(btrim(p_payload->>'subject')) NOT BETWEEN 3 AND 160 THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023'; END IF;
  IF v_founder THEN
   v_org:=(p_payload->>'orgId')::uuid; v_requester:=(p_payload->>'requesterUserId')::uuid;
   IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=v_org) OR p_payload->>'source' NOT IN('manual_email','manual_phone','manual_whatsapp') THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
   IF v_requester IS NOT NULL AND private.support_owner_org(v_requester)<>v_org THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
  ELSE v_requester:=p_actor_id; END IF;
  INSERT INTO public.support_tickets(org_id,requester_user_id,created_by_user_id,source,subject,category,needs_founder_reply,client_request_id,idempotency_actor_key,request_payload_hash)
  VALUES(v_org,v_requester,p_actor_id,CASE WHEN v_founder THEN p_payload->>'source' ELSE 'in_app' END,btrim(p_payload->>'subject'),p_payload->>'category',v_requester IS NOT NULL,p_request_id,v_actor,v_hash) RETURNING * INTO t;
  IF v_requester IS NOT NULL THEN
   INSERT INTO public.support_messages(ticket_id,author_user_id,author_kind,message_kind,body,message_seq,client_request_id,idempotency_actor_key,request_payload_hash)
   VALUES(t.id,p_actor_id,CASE WHEN v_founder THEN 'founder' ELSE 'customer' END,'initial_intake',v_body,1,p_request_id,v_actor,v_hash);
   UPDATE public.support_tickets SET next_message_seq=1,last_customer_message_seq=CASE WHEN v_founder THEN NULL ELSE 1 END,last_customer_message_at=CASE WHEN v_founder THEN NULL ELSE v_now END WHERE id=t.id RETURNING * INTO t;
  ELSE INSERT INTO private.support_internal_notes(ticket_id,author_user_id,body,client_request_id,idempotency_actor_key,request_payload_hash) VALUES(t.id,p_actor_id,v_body,p_request_id,v_actor,v_hash); END IF;
 ELSE
  SELECT * INTO t FROM public.support_tickets WHERE id=p_ticket_id FOR UPDATE;
  IF NOT FOUND OR(NOT v_founder AND (t.org_id<>v_org OR t.requester_user_id IS DISTINCT FROM p_actor_id)) THEN RAISE EXCEPTION 'SUPPORT_NOT_FOUND' USING ERRCODE='P0002';END IF;
  v_before:=jsonb_build_object('status',t.status,'priority',t.priority,'category',t.category,'version',t.version,'needsFounderReply',t.needs_founder_reply,'nextUpdateDueAt',t.next_update_due_at,'followUpDueAt',t.follow_up_due_at);
  IF v_founder AND (p_payload->>'expectedVersion')::integer IS DISTINCT FROM t.version THEN RAISE EXCEPTION 'SUPPORT_STALE_VERSION' USING ERRCODE='40001';END IF;
  IF p_operation='note' AND v_founder THEN
   INSERT INTO private.support_internal_notes(ticket_id,author_user_id,body,client_request_id,idempotency_actor_key,request_payload_hash) VALUES(t.id,p_actor_id,v_body,p_request_id,v_actor,v_hash);
  ELSIF p_operation='reply' AND NOT v_founder THEN
   v_seq:=t.next_message_seq+1;
   INSERT INTO public.support_messages(ticket_id,author_user_id,author_kind,message_kind,body,message_seq,client_request_id,idempotency_actor_key,request_payload_hash) VALUES(t.id,p_actor_id,'customer','public_reply',v_body,v_seq,p_request_id,v_actor,v_hash);
   UPDATE public.support_tickets SET status=CASE WHEN status IN('waiting_on_customer','waiting_on_fix','resolved') THEN 'in_progress' ELSE status END,
   reopened_count=reopened_count+CASE WHEN status='resolved' THEN 1 ELSE 0 END,resolved_at=NULL,follow_up_due_at=NULL,last_customer_message_seq=v_seq,last_customer_message_at=v_now,next_message_seq=v_seq,needs_founder_reply=true WHERE id=t.id RETURNING * INTO t;v_public:=true;
  ELSIF v_founder AND p_operation IN('reply','patch') THEN
   v_status:=p_payload->>'status';v_reference:=NULLIF(btrim(p_payload->>'externalReference'),'');v_follow_due:=(p_payload->>'followUpDueAt')::timestamptz;v_new_due:=(p_payload->>'nextUpdateDueAt')::timestamptz;
   IF length(btrim(p_payload->>'nextAction')) NOT BETWEEN 1 AND 500 OR v_status NOT IN('new','in_progress','waiting_on_customer','waiting_on_fix','resolved') THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
   IF v_reference ~ '[<>[:cntrl:]]' THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
   IF v_reference ~* '^[a-z]+:' AND (v_reference !~ '^https://[^[:space:]<>]+$' OR v_reference ~ '^https://[^/]*@') THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
   IF v_status='waiting_on_customer' AND (p_operation<>'reply' OR t.requester_user_id IS NULL OR v_follow_due IS NULL) THEN RAISE EXCEPTION 'SUPPORT_PUBLIC_QUESTION_REQUIRED' USING ERRCODE='22023';END IF;
   IF v_status='waiting_on_fix' AND(v_reference IS NULL OR v_new_due IS NULL) THEN RAISE EXCEPTION 'SUPPORT_FIX_REFERENCE_REQUIRED' USING ERRCODE='22023';END IF;
   v_resolution:=NULLIF(btrim(p_payload->>'resolutionSummary'),'');
   IF v_status='resolved' AND(v_resolution IS NULL OR p_payload->>'resolutionCode' IS NULL OR(t.requester_user_id IS NOT NULL AND p_operation<>'reply')) THEN RAISE EXCEPTION 'SUPPORT_RESOLUTION_REQUIRED' USING ERRCODE='22023';END IF;
   -- Promise cannot disappear through a status/priority change. Fulfillment is explicit public update only.
   IF p_operation='patch' AND t.requester_user_id IS NOT NULL AND t.next_update_due_at IS NOT NULL AND v_new_due IS NULL THEN RAISE EXCEPTION 'SUPPORT_PROMISE_REQUIRES_PUBLIC_UPDATE' USING ERRCODE='22023';END IF;
   IF v_status='resolved' AND t.requester_user_id IS NOT NULL AND (v_new_due IS NOT NULL OR(t.next_update_due_at IS NOT NULL AND NOT COALESCE((p_payload->>'promiseFulfilled')::boolean,false))) THEN RAISE EXCEPTION 'SUPPORT_PROMISE_REQUIRES_PUBLIC_UPDATE' USING ERRCODE='22023';END IF;
   IF p_operation='reply' THEN
    IF t.requester_user_id IS NULL THEN RAISE EXCEPTION 'SUPPORT_INTERNAL_ONLY' USING ERRCODE='22023';END IF;
    IF t.next_update_due_at IS NOT NULL AND v_new_due IS NULL AND NOT COALESCE((p_payload->>'promiseFulfilled')::boolean,false) THEN RAISE EXCEPTION 'SUPPORT_PROMISE_REQUIRES_PUBLIC_UPDATE' USING ERRCODE='22023';END IF;
    IF v_status='resolved' AND v_body IS DISTINCT FROM v_resolution THEN RAISE EXCEPTION 'SUPPORT_RESOLUTION_MUST_BE_PUBLIC' USING ERRCODE='22023';END IF;
    v_seq:=t.next_message_seq+1;
    INSERT INTO public.support_messages(ticket_id,author_user_id,author_kind,message_kind,body,message_seq,client_request_id,idempotency_actor_key,request_payload_hash) VALUES(t.id,p_actor_id,'founder','public_reply',v_body,v_seq,p_request_id,v_actor,v_hash);
    UPDATE public.support_tickets SET last_public_founder_reply_at=v_now,first_public_founder_reply_at=COALESCE(first_public_founder_reply_at,v_now),last_public_founder_reply_seq=v_seq,next_message_seq=v_seq,needs_founder_reply=false WHERE id=t.id;v_public:=true;
   END IF;
   IF p_operation='patch' AND (p_payload->>'priority') IS DISTINCT FROM t.priority THEN
    IF length(btrim(COALESCE(p_payload->>'reason',''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'SUPPORT_PRIORITY_REASON_REQUIRED' USING ERRCODE='22023';END IF;
    INSERT INTO private.support_internal_notes(ticket_id,author_user_id,body,client_request_id,idempotency_actor_key,request_payload_hash)
    VALUES(t.id,p_actor_id,'Priority changed from '||t.priority||' to '||(p_payload->>'priority')||': '||btrim(p_payload->>'reason'),p_request_id,v_actor,v_hash);
   END IF;
   UPDATE public.support_tickets SET status=v_status,next_action=btrim(p_payload->>'nextAction'),follow_up_due_at=v_follow_due,external_reference=v_reference,
   next_update_due_at=v_new_due, update_promise_set_at=CASE WHEN v_new_due IS DISTINCT FROM next_update_due_at THEN v_now ELSE update_promise_set_at END,
   update_promise_fulfilled_at=CASE WHEN p_operation='reply' AND COALESCE((p_payload->>'promiseFulfilled')::boolean,false) THEN v_now ELSE update_promise_fulfilled_at END,
   resolved_at=CASE WHEN v_status='resolved' THEN v_now ELSE NULL END,resolution_code=CASE WHEN v_status='resolved' THEN p_payload->>'resolutionCode' ELSE resolution_code END,
   resolution_summary=CASE WHEN v_status='resolved' THEN v_resolution ELSE resolution_summary END,
   priority=CASE WHEN p_operation='patch' THEN p_payload->>'priority' ELSE priority END,category=CASE WHEN p_operation='patch' THEN p_payload->>'category' ELSE category END WHERE id=t.id RETURNING * INTO t;
  ELSE RAISE EXCEPTION 'SUPPORT_FORBIDDEN' USING ERRCODE='42501'; END IF;
  UPDATE public.support_tickets SET version=version+1,updated_at=v_now WHERE id=t.id RETURNING * INTO t;
 END IF;
 INSERT INTO public.support_ticket_events(ticket_id,actor_user_id,event_type,before_safe,after_safe,public_visible,request_id)
 VALUES(t.id,p_actor_id,CASE WHEN p_operation='reply' AND NOT v_founder AND v_before->>'status'='resolved' THEN 'reopened' ELSE p_operation END,
 CASE WHEN v_public THEN jsonb_build_object('status',v_before->>'status') ELSE COALESCE(v_before,'{}') END,
 CASE WHEN v_public OR p_operation='create' THEN jsonb_build_object('status',t.status) ELSE jsonb_build_object('status',t.status,'priority',t.priority,'category',t.category,'nextUpdateDueAt',t.next_update_due_at,'followUpDueAt',t.follow_up_due_at,'version',t.version) END,
 v_public OR p_operation='create',p_request_id);
 IF p_operation='patch' AND t.requester_user_id IS NOT NULL AND v_before->>'status' IS DISTINCT FROM t.status THEN
  INSERT INTO public.support_ticket_events(ticket_id,actor_user_id,event_type,before_safe,after_safe,public_visible,request_id)
  VALUES(t.id,p_actor_id,'status_changed',jsonb_build_object('status',v_before->>'status'),jsonb_build_object('status',t.status),true,p_request_id);
 END IF;
 IF v_founder AND p_operation IN('reply','patch') AND(v_before->'nextUpdateDueAt' IS DISTINCT FROM COALESCE(to_jsonb(t.next_update_due_at),'null'::jsonb) OR COALESCE((p_payload->>'promiseFulfilled')::boolean,false)) THEN
  INSERT INTO public.support_ticket_events(ticket_id,actor_user_id,event_type,before_safe,after_safe,public_visible,request_id)
  VALUES(t.id,p_actor_id,CASE WHEN COALESCE((p_payload->>'promiseFulfilled')::boolean,false) THEN 'promise_fulfilled' ELSE 'promise_replaced' END,
  jsonb_build_object('nextUpdateDueAt',v_before->'nextUpdateDueAt'),jsonb_build_object('nextUpdateDueAt',t.next_update_due_at),false,p_request_id);
 END IF;
 IF v_founder THEN PERFORM private.admin_append_audit(p_actor_id,p_session_id,'support.'||p_operation,'support',t.id::text,'success',p_request_id,
 CASE WHEN p_operation='patch' AND p_payload->>'priority' IS DISTINCT FROM v_before->>'priority' THEN 'priority_changed' ELSE NULL END,
 v_before,jsonb_build_object('status',t.status,'priority',t.priority,'category',t.category,'version',t.version,'needsFounderReply',t.needs_founder_reply,'nextUpdateDueAt',t.next_update_due_at,'followUpDueAt',t.follow_up_due_at)); END IF;
 v_result:=jsonb_build_object('id',t.id,'version',t.version,'status',t.status,'requestId',p_request_id);
 INSERT INTO private.support_request_results(actor_key,request_id,scope,payload_hash,result) VALUES(v_actor,p_request_id,v_scope,v_hash,v_result);
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.admin_support_mutate(uuid,uuid,text,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_support_mutate(uuid,uuid,text,uuid,jsonb,uuid) TO service_role;
