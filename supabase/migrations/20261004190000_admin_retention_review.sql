-- Created with Supabase CLI as 20261004123814_admin_retention_review; ordered
-- after the retained-record and formal-case foundations. Review metadata only:
-- no purge, erasure, customer change, schedule, seed policy or production setup.
BEGIN;

CREATE FUNCTION private.admin_retention_safe_reference(p_value text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_value IS NOT NULL AND char_length(p_value) BETWEEN 3 AND 240
    AND p_value=btrim(p_value) AND p_value ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]+$';
$$;

CREATE TABLE private.admin_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_class text NOT NULL CHECK(record_class IN ('ordinary_support','internal_notes','privacy_cases','security_incidents_audit','billing_evidence','reporting_data')),
  version integer NOT NULL CHECK(version>0),
  policy_mode text NOT NULL CHECK(policy_mode IN ('fixed_days','manual_review')),
  retention_days integer CHECK(retention_days BETWEEN 1 AND 36500),
  retention_anchor text NOT NULL CHECK(retention_anchor IN ('record_created','ticket_resolved','case_closed','provider_event','manual_review')),
  summary text NOT NULL CHECK(summary=btrim(summary) AND char_length(summary) BETWEEN 3 AND 500 AND summary!~'[[:cntrl:]]'),
  approval_reference text NOT NULL CHECK(private.admin_retention_safe_reference(approval_reference)),
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  approved_at timestamptz NOT NULL CHECK(isfinite(approved_at)),
  effective_from timestamptz NOT NULL CHECK(isfinite(effective_from) AND effective_from>=approved_at),
  review_due_at timestamptz CHECK(isfinite(review_due_at) AND review_due_at>effective_from),
  recorded_at timestamptz NOT NULL DEFAULT now() CHECK(isfinite(recorded_at) AND recorded_at>=approved_at),
  UNIQUE(record_class,version),
  CHECK((policy_mode='fixed_days' AND retention_days IS NOT NULL AND retention_anchor<>'manual_review')
    OR (policy_mode='manual_review' AND retention_days IS NULL AND retention_anchor='manual_review')),
  CHECK(retention_anchor IN ('record_created','manual_review')
    OR (retention_anchor='ticket_resolved' AND record_class IN ('ordinary_support','internal_notes'))
    OR (retention_anchor='case_closed' AND record_class IN ('privacy_cases','security_incidents_audit'))
    OR (retention_anchor='provider_event' AND record_class='billing_evidence'))
);
COMMENT ON TABLE private.admin_retention_policies IS 'Append-only reviewed metadata, installed only through a separately approved operator/DB setup. Missing rows mean unconfigured. Numeric validation limits are technical limits, not legal periods. No row enables automatic disposal.';
CREATE INDEX admin_retention_policies_current ON private.admin_retention_policies(record_class,effective_from DESC,version DESC);

CREATE FUNCTION private.admin_retention_policy_append_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_version integer;v_effective timestamptz;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Retention policies are append-only' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('weavly-retention:'||NEW.record_class,0));
  SELECT version,effective_from INTO v_version,v_effective FROM private.admin_retention_policies
    WHERE record_class=NEW.record_class ORDER BY version DESC LIMIT 1;
  IF NEW.version<>coalesce(v_version,0)+1 OR (v_effective IS NOT NULL AND NEW.effective_from<v_effective)
    OR NEW.approved_at>clock_timestamp() OR NEW.recorded_at>clock_timestamp() THEN
    RAISE EXCEPTION 'Invalid reviewed policy version' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER admin_retention_policy_append_only BEFORE INSERT OR UPDATE OR DELETE ON private.admin_retention_policies
  FOR EACH ROW EXECUTE FUNCTION private.admin_retention_policy_append_only();

-- One fixed primary-key lookup per allowlisted source; no arbitrary table,
-- predicate, record enumeration or exposed source-ID lookup function.
CREATE FUNCTION private.admin_retention_source_link(p_source_type text,p_source_id uuid)
RETURNS TABLE(record_class text,org_id uuid) LANGUAGE plpgsql STABLE SET search_path='' AS $$
BEGIN
  CASE p_source_type
    WHEN 'support_ticket' THEN RETURN QUERY SELECT 'ordinary_support'::text,t.org_id FROM public.support_tickets t WHERE t.id=p_source_id;
    WHEN 'support_internal_note' THEN RETURN QUERY SELECT 'internal_notes'::text,t.org_id FROM private.support_internal_notes n JOIN public.support_tickets t ON t.id=n.ticket_id WHERE n.id=p_source_id;
    WHEN 'grievance' THEN RETURN QUERY SELECT 'privacy_cases'::text,g.org_id FROM public.grievances g WHERE g.id=p_source_id AND g.target_entity='WEAVLY' AND g.grievance_type='DATA_PRIVACY';
    WHEN 'security_incident' THEN RETURN QUERY SELECT 'security_incidents_audit'::text,s.org_id FROM public.security_incidents s WHERE s.id=p_source_id;
    WHEN 'admin_audit_event' THEN RETURN QUERY SELECT 'security_incidents_audit'::text,NULL::uuid FROM private.admin_audit_events a WHERE a.id=p_source_id;
    WHEN 'billing_fact' THEN RETURN QUERY SELECT 'billing_evidence'::text,b.org_id FROM private.admin_billing_facts b WHERE b.id=p_source_id;
    WHEN 'billing_coverage' THEN RETURN QUERY SELECT 'billing_evidence'::text,NULL::uuid FROM private.admin_billing_coverage b WHERE b.id=p_source_id;
    WHEN 'reporting_classification' THEN RETURN QUERY SELECT 'reporting_data'::text,r.org_id FROM private.admin_org_reporting r WHERE r.org_id=p_source_id;
    ELSE RAISE EXCEPTION 'Invalid retained source' USING ERRCODE='22023';
  END CASE;
END;
$$;

CREATE TABLE private.admin_retention_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_class text NOT NULL CHECK(record_class IN ('ordinary_support','internal_notes','privacy_cases','security_incidents_audit','billing_evidence','reporting_data')),
  source_type text NOT NULL CHECK(source_type IN ('support_ticket','support_internal_note','grievance','security_incident','admin_audit_event','billing_fact','billing_coverage','reporting_classification')),
  source_id uuid NOT NULL,
  org_id uuid REFERENCES public.organizations(id),
  reason text NOT NULL CHECK(reason=btrim(reason) AND char_length(reason) BETWEEN 3 AND 500 AND reason!~'[[:cntrl:]]'),
  reference text NOT NULL CHECK(private.admin_retention_safe_reference(reference)),
  placed_by uuid NOT NULL REFERENCES auth.users(id),
  placed_at timestamptz NOT NULL DEFAULT now() CHECK(isfinite(placed_at)),
  released_at timestamptz CHECK(isfinite(released_at)),
  released_by uuid REFERENCES auth.users(id),
  release_reason text CHECK(release_reason=btrim(release_reason) AND char_length(release_reason) BETWEEN 3 AND 500 AND release_reason!~'[[:cntrl:]]'),
  CHECK((released_at IS NULL AND released_by IS NULL AND release_reason IS NULL)
    OR (released_at IS NOT NULL AND released_by IS NOT NULL AND release_reason IS NOT NULL AND released_at>=placed_at))
);
COMMENT ON TABLE private.admin_retention_holds IS 'Reviewed operator holds with current fixed source linkage; no app write privilege or purge executor. Sources are deliberately not cascading foreign keys. Missing/changed current linkage remains visible for review rather than silently dropping evidence.';
CREATE UNIQUE INDEX admin_retention_one_active_hold ON private.admin_retention_holds(source_type,source_id) WHERE released_at IS NULL;
CREATE INDEX admin_retention_holds_page ON private.admin_retention_holds(placed_at DESC,id DESC) WHERE released_at IS NULL;
CREATE INDEX admin_retention_holds_org ON private.admin_retention_holds(org_id);

CREATE FUNCTION private.admin_retention_validate_hold()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_class text;v_org uuid;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retained hold evidence cannot be deleted' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' THEN
    SELECT l.record_class,l.org_id INTO v_class,v_org FROM private.admin_retention_source_link(NEW.source_type,NEW.source_id) l;
    IF NOT FOUND OR NEW.record_class IS DISTINCT FROM v_class OR (NEW.org_id IS NOT NULL AND NEW.org_id IS DISTINCT FROM v_org)
      THEN RAISE EXCEPTION 'Invalid retained source linkage' USING ERRCODE='22023'; END IF;
    NEW.org_id:=v_org;
    IF NEW.placed_at>clock_timestamp() THEN RAISE EXCEPTION 'Invalid hold time' USING ERRCODE='22023'; END IF;
  ELSE
    IF OLD.released_at IS NOT NULL OR ROW(NEW.id,NEW.record_class,NEW.source_type,NEW.source_id,NEW.org_id,NEW.reason,NEW.reference,NEW.placed_by,NEW.placed_at)
      IS DISTINCT FROM ROW(OLD.id,OLD.record_class,OLD.source_type,OLD.source_id,OLD.org_id,OLD.reason,OLD.reference,OLD.placed_by,OLD.placed_at)
      OR NEW.released_at IS NULL THEN RAISE EXCEPTION 'Hold changes require a recorded release' USING ERRCODE='22023'; END IF;
  END IF;
  IF NEW.released_at>clock_timestamp() THEN RAISE EXCEPTION 'Invalid release time' USING ERRCODE='22023'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER admin_retention_validate_hold BEFORE INSERT OR UPDATE OR DELETE ON private.admin_retention_holds
  FOR EACH ROW EXECUTE FUNCTION private.admin_retention_validate_hold();
ALTER TABLE private.admin_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_retention_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.admin_retention_policies,private.admin_retention_holds FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.admin_retention_safe_reference(text),private.admin_retention_policy_append_only(),private.admin_retention_source_link(text,uuid),private.admin_retention_validate_hold() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.admin_retention_review(
  p_actor_id uuid,p_session_id uuid,p_limit integer DEFAULT 25,
  p_cursor_at timestamptz DEFAULT NULL,p_cursor_id uuid DEFAULT NULL,p_as_of timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_as_of timestamptz:=coalesce(p_as_of,now());v_classes jsonb;v_holds jsonb;v_total bigint;v_linkage_issues bigint;v_configured integer;
BEGIN
  IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Server operation required' USING ERRCODE='42501'; END IF;
  PERFORM private.admin_assert_founder_session(p_actor_id,p_session_id);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR (p_cursor_at IS NULL)<>(p_cursor_id IS NULL)
    OR (p_cursor_at IS NOT NULL AND p_as_of IS NULL) OR v_as_of>clock_timestamp() OR v_as_of<now()-interval '24 hours'
    OR NOT isfinite(p_cursor_at) OR p_cursor_at>v_as_of THEN RAISE EXCEPTION 'Invalid retention review page' USING ERRCODE='22023'; END IF;
  WITH classes(record_class,label,ordinal) AS (VALUES
    ('ordinary_support','Ordinary support',1),('internal_notes','Internal support notes',2),('privacy_cases','Privacy cases',3),
    ('security_incidents_audit','Security incidents and founder audit',4),('billing_evidence','Billing evidence',5),('reporting_data','Reporting data',6)
  ), active_holds AS (
    SELECT h.*,coalesce(l.record_class=h.record_class AND l.org_id IS NOT DISTINCT FROM h.org_id,false) linked
    FROM private.admin_retention_holds h LEFT JOIN LATERAL private.admin_retention_source_link(h.source_type,h.source_id) l ON true
    WHERE h.placed_at<=v_as_of AND (h.released_at IS NULL OR h.released_at>v_as_of)
  ) SELECT jsonb_agg(jsonb_build_object('recordClass',c.record_class,'label',c.label,
    'policyState',CASE WHEN p.id IS NULL THEN 'unconfigured' WHEN p.review_due_at<=v_as_of THEN 'review_due' ELSE 'configured' END,
    'policy',CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id',p.id,'version',p.version,'policyMode',p.policy_mode,
      'retentionDays',p.retention_days,'retentionAnchor',p.retention_anchor,'summary',p.summary,'approvalReference',p.approval_reference,
      'approvedBy',p.approved_by,'approvedAt',p.approved_at,'effectiveFrom',p.effective_from,'reviewDueAt',p.review_due_at) END,
    'activeHoldCount',(SELECT count(*) FROM active_holds h WHERE h.record_class=c.record_class),
    'sourceLinkageIssues',(SELECT count(*) FROM active_holds h WHERE h.record_class=c.record_class AND NOT h.linked),
    'pendingPolicyCount',(SELECT count(*) FROM private.admin_retention_policies future WHERE future.record_class=c.record_class AND future.effective_from>v_as_of)
  ) ORDER BY c.ordinal) INTO v_classes FROM classes c LEFT JOIN LATERAL (
    SELECT * FROM private.admin_retention_policies p WHERE p.record_class=c.record_class AND p.effective_from<=v_as_of
    ORDER BY p.effective_from DESC,p.version DESC LIMIT 1
  )p ON true;
  SELECT count(*),count(*) FILTER(WHERE NOT coalesce(l.record_class=h.record_class AND l.org_id IS NOT DISTINCT FROM h.org_id,false))
    INTO v_total,v_linkage_issues FROM private.admin_retention_holds h LEFT JOIN LATERAL private.admin_retention_source_link(h.source_type,h.source_id) l ON true
    WHERE h.placed_at<=v_as_of AND (h.released_at IS NULL OR h.released_at>v_as_of);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',h.id,'recordClass',h.record_class,'sourceType',h.source_type,'sourceId',h.source_id,'orgId',h.org_id,
      'reason',h.reason,'reference',h.reference,'placedBy',h.placed_by,'placedAt',h.placed_at,
      'sourceLinked',coalesce(l.record_class=h.record_class AND l.org_id IS NOT DISTINCT FROM h.org_id,false)) ORDER BY h.placed_at DESC,h.id DESC),'[]')
    INTO v_holds FROM (SELECT * FROM private.admin_retention_holds h WHERE h.placed_at<=v_as_of
      AND (h.released_at IS NULL OR h.released_at>v_as_of) AND (p_cursor_at IS NULL OR (h.placed_at,h.id)<(p_cursor_at,p_cursor_id))
      ORDER BY h.placed_at DESC,h.id DESC LIMIT p_limit+1)h LEFT JOIN LATERAL private.admin_retention_source_link(h.source_type,h.source_id) l ON true;
  SELECT count(*) INTO v_configured FROM jsonb_array_elements(v_classes)c
    WHERE c->>'policyState'='configured' AND c->'policy'->>'policyMode'='fixed_days';
  RETURN jsonb_build_object('definitionVersion','admin-retention-v1','asOf',v_as_of,'automaticPurgeEnabled',false,
    'releaseStatus',CASE WHEN v_configured=6 AND v_linkage_issues=0 THEN 'review_ready' ELSE 'incomplete' END,
    'classes',v_classes,'holds',jsonb_build_object('items',v_holds,'totalActive',v_total,'sourceLinkageIssues',v_linkage_issues));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_retention_review(uuid,uuid,integer,timestamptz,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retention_review(uuid,uuid,integer,timestamptz,uuid,timestamptz) TO service_role;
COMMIT;
