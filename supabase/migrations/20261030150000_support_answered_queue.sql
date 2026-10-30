-- Founder inbox: add the 'answered' queue (open tickets the founder has replied to and that
-- await the customer). Everything else in admin_support_read is unchanged from
-- 20261004150500_founder_support_workflow.sql.
CREATE OR REPLACE FUNCTION public.admin_support_read(p_actor_id uuid,p_session_id uuid,p_operation text,p_ticket_id uuid DEFAULT NULL,p_filters jsonb DEFAULT '{}')
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
  IF v_queue NOT IN('all','new','needs_reply','answered','unanswered','updates_due','followups_due','waiting_on_customer','waiting_on_fix','billing_access','reopened','critical') THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023'; END IF;
  WITH matched AS (SELECT t AS ticket,t.updated_at,t.id,CASE WHEN NOT v_founder THEN 0 WHEN t.status='resolved' THEN 7 WHEN t.priority='critical' THEN 0 WHEN t.next_update_due_at<v_as_of THEN 1 WHEN t.status='waiting_on_customer' AND t.follow_up_due_at<v_as_of THEN 2 WHEN t.needs_founder_reply THEN 3 WHEN t.status='waiting_on_fix' THEN 4 WHEN t.status='new' THEN 5 ELSE 6 END AS sort_rank FROM public.support_tickets t WHERE (v_founder OR(t.org_id=v_org AND t.requester_user_id=p_actor_id))
    AND (NOT(p_filters?'orgId') OR t.org_id=(p_filters->>'orgId')::uuid) AND(NOT(p_filters?'status') OR t.status=p_filters->>'status')
    AND CASE v_queue WHEN 'new' THEN t.status='new' WHEN 'needs_reply' THEN t.status<>'resolved' AND t.needs_founder_reply WHEN 'answered' THEN t.status<>'resolved' AND NOT t.needs_founder_reply WHEN 'unanswered' THEN t.status<>'resolved' AND t.first_public_founder_reply_at IS NULL AND t.requester_user_id IS NOT NULL
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
