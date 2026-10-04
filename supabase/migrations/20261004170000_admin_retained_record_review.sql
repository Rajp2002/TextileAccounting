-- CLI-generated migration, ordered after the first data-rights compatibility slice.
-- Review only: no provider actions, erasure approval bypass, retention period,
-- purge, financial correction or cascade. Existing foundation checks remain.
BEGIN;

-- Keep the original predicate's identity and replace its body below, so
-- previously prepared callers also receive the expanded review boundary.
-- This helper preserves each foundation check from 20261004153000.
CREATE FUNCTION private.admin_account_deletion_foundation_review(p_actor uuid,p_org uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_review boolean;
BEGIN
 SELECT EXISTS(SELECT 1 FROM public.support_tickets WHERE org_id=p_org)
 OR EXISTS(SELECT 1 FROM private.admin_org_reporting WHERE org_id=p_org)
 OR EXISTS(SELECT 1 FROM private.admin_billing_facts WHERE org_id=p_org)
 OR EXISTS(SELECT 1 FROM private.support_request_results WHERE actor_key IN(SELECT id::text FROM public.profiles WHERE org_id=p_org))
 OR EXISTS(SELECT 1 FROM private.platform_founder_grants WHERE user_id IN(SELECT id FROM public.profiles WHERE org_id=p_org)
   OR created_by IN(SELECT id FROM public.profiles WHERE org_id=p_org))
 OR EXISTS(SELECT 1 FROM private.platform_admin_sessions WHERE user_id IN(SELECT id FROM public.profiles WHERE org_id=p_org)) INTO v_review;
 IF v_review THEN RETURN true;END IF;
 IF pg_catalog.to_regclass('private.platform_founder_mfa_setup_intents') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM private.platform_founder_mfa_setup_intents WHERE user_id IN(SELECT id FROM public.profiles WHERE org_id=$1))'
   INTO v_review USING p_org;
 END IF;
 RETURN v_review;
END $$;
REVOKE ALL ON FUNCTION private.admin_account_deletion_foundation_review(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;

-- The source mappings below are fixed and schema-qualified. Count at most
-- 1,001 references per group so a founder preview stays bounded. Categories
-- describe review evidence, not confirmed live collections or legal deadlines.
CREATE FUNCTION private.admin_retained_record_review(p_actor uuid,p_org uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_legacy integer;v_billing integer;v_formal integer;v_legal integer;
 v_optional integer:=0;v_count integer;v_foundation boolean;
BEGIN
 v_foundation:=private.admin_account_deletion_foundation_review(p_actor,p_org);
 SELECT count(*) INTO v_legacy FROM(SELECT 1 FROM public.org_subscriptions
  WHERE org_id=p_org AND razorpay_subscription_id IS NOT NULL LIMIT 1001)records;

 SELECT count(*) INTO v_billing FROM(
  SELECT 1 FROM public.subscription_payments WHERE org_id=p_org
   AND(razorpay_payment_id IS NOT NULL OR razorpay_order_id IS NOT NULL OR captured_at IS NOT NULL
    OR(amount_paise>0 AND status IN('captured','refunded')))
  UNION ALL SELECT 1 FROM public.billing_payment_refunds WHERE org_id=p_org
  UNION ALL SELECT 1 FROM public.billing_invoices WHERE org_id=p_org
  UNION ALL SELECT 1 FROM public.billing_checkout_attempts WHERE org_id=p_org
   AND(provider_order_id IS NOT NULL OR provider_payment_id IS NOT NULL
    OR status IN('creating','processing','unknown','authorized','captured','activation_pending','activated','duplicate','reconciliation_required','refunded'))
  UNION ALL SELECT 1 FROM public.org_subscriptions WHERE org_id=p_org
   AND(razorpay_payment_id IS NOT NULL OR razorpay_order_id IS NOT NULL OR COALESCE(paid_count,0)>0
    OR(checkout_amount_paise>0 AND status IN('active','authenticated','paused','halted','cancelled','completed','expired')))
  UNION ALL SELECT 1 FROM public.referral_refunds WHERE referrer_org_id=p_org
  UNION ALL SELECT 1 FROM public.referral_year_credits c WHERE c.referrer_org_id=p_org
   OR EXISTS(SELECT 1 FROM public.referral_uses r WHERE r.id=c.referral_use_id AND r.referee_org_id=p_org)
  UNION ALL SELECT 1 FROM public.referral_discount_windows d WHERE d.referrer_org_id=p_org
   OR EXISTS(SELECT 1 FROM public.referral_uses r WHERE r.id=d.referral_use_id AND r.referee_org_id=p_org)
  LIMIT 1001
 )records;

 SELECT count(*) INTO v_formal FROM(
  SELECT 1 FROM public.grievances WHERE org_id=p_org
  UNION ALL SELECT 1 FROM public.security_incidents WHERE org_id=p_org
   OR created_by IN(SELECT id FROM public.profiles WHERE org_id=p_org)
   OR updated_by IN(SELECT id FROM public.profiles WHERE org_id=p_org)
  UNION ALL SELECT 1 FROM public.breach_reports WHERE org_id=p_org
   OR filed_by IN(SELECT id FROM public.profiles WHERE org_id=p_org)
  UNION ALL SELECT 1 FROM public.platform_security WHERE locked_by IN(SELECT id FROM public.profiles WHERE org_id=p_org)
  UNION ALL SELECT 1 FROM public.organizations WHERE id=p_org
   AND(is_locked_down OR locked_at IS NOT NULL OR locked_by IS NOT NULL OR lockdown_reason IS NOT NULL)
  LIMIT 1001
 )records;

 SELECT count(*) INTO v_legal FROM(
  SELECT 1 FROM public.legal_document_acceptances WHERE org_id=p_org
   OR actor_user_id IN(SELECT id FROM public.profiles WHERE org_id=p_org)
  UNION ALL SELECT 1 FROM public.worker_consent_artifacts WHERE org_id=p_org
  UNION ALL SELECT 1 FROM public.organization_dpas WHERE(org_id=p_org
   OR signed_by IN(SELECT id FROM public.profiles WHERE org_id=p_org))
   AND(status='signed' OR signed_at IS NOT NULL OR signed_by IS NOT NULL OR proof_url IS NOT NULL)
  LIMIT 1001
 )records;

 -- Later formal sidecars never supply an arbitrary query/table. Unbound
 -- cases and actors still retain the immutable identity linkage for review.
 IF pg_catalog.to_regclass('private.admin_formal_cases') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM(SELECT 1 FROM private.admin_formal_cases c WHERE c.requester_user_id IN(SELECT id FROM public.profiles WHERE org_id=$1)
   OR EXISTS(SELECT 1 FROM public.grievances g WHERE g.id=c.grievance_id AND g.org_id=$1)
   OR EXISTS(SELECT 1 FROM public.security_incidents i WHERE i.id=c.incident_id AND i.org_id=$1) LIMIT 1001)records'
   INTO v_count USING p_org;v_optional:=v_optional+v_count;
 END IF;
 IF pg_catalog.to_regclass('private.admin_formal_notes') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM(SELECT 1 FROM private.admin_formal_notes WHERE author_user_id IN(SELECT id FROM public.profiles WHERE org_id=$1) LIMIT 1001)records'
   INTO v_count USING p_org;v_optional:=v_optional+v_count;
 END IF;
 IF pg_catalog.to_regclass('private.admin_formal_events') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM(SELECT 1 FROM private.admin_formal_events WHERE actor_user_id IN(SELECT id FROM public.profiles WHERE org_id=$1) LIMIT 1001)records'
   INTO v_count USING p_org;v_optional:=v_optional+v_count;
 END IF;
 IF pg_catalog.to_regclass('private.admin_formal_revisions') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM(SELECT 1 FROM private.admin_formal_revisions r WHERE r.actor_user_id IN(SELECT id FROM public.profiles WHERE org_id=$1)
   OR EXISTS(SELECT 1 FROM private.admin_formal_cases c LEFT JOIN public.grievances g ON g.id=c.grievance_id LEFT JOIN public.security_incidents i ON i.id=c.incident_id
    WHERE c.id=r.case_id AND(g.org_id=$1 OR i.org_id=$1 OR c.requester_user_id IN(SELECT id FROM public.profiles WHERE org_id=$1))) LIMIT 1001)records'
   INTO v_count USING p_org;v_optional:=v_optional+v_count;
 END IF;
 IF pg_catalog.to_regclass('private.admin_formal_request_results') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM(SELECT 1 FROM private.admin_formal_request_results WHERE actor_id IN(SELECT id FROM public.profiles WHERE org_id=$1) LIMIT 1001)records'
   INTO v_count USING p_org;v_optional:=v_optional+v_count;
 END IF;
 IF pg_catalog.to_regclass('private.admin_retention_policies') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM(SELECT 1 FROM private.admin_retention_policies WHERE approved_by IN(SELECT id FROM public.profiles WHERE org_id=$1) LIMIT 1001)records'
   INTO v_count USING p_org;v_optional:=v_optional+v_count;
 END IF;
 IF pg_catalog.to_regclass('private.admin_retention_holds') IS NOT NULL THEN
  EXECUTE 'SELECT count(*) FROM(SELECT 1 FROM private.admin_retention_holds h WHERE h.org_id=$1
   OR h.placed_by IN(SELECT id FROM public.profiles WHERE org_id=$1)
   OR h.released_by IN(SELECT id FROM public.profiles WHERE org_id=$1)
   OR(h.source_type=''support_ticket'' AND EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id=h.source_id AND t.org_id=$1))
   OR(h.source_type=''support_internal_note'' AND EXISTS(SELECT 1 FROM private.support_internal_notes n JOIN public.support_tickets t ON t.id=n.ticket_id WHERE n.id=h.source_id AND t.org_id=$1))
   OR(h.source_type=''grievance'' AND EXISTS(SELECT 1 FROM public.grievances g WHERE g.id=h.source_id AND g.org_id=$1))
   OR(h.source_type=''security_incident'' AND EXISTS(SELECT 1 FROM public.security_incidents i WHERE i.id=h.source_id AND(i.org_id=$1 OR i.created_by IN(SELECT id FROM public.profiles WHERE org_id=$1) OR i.updated_by IN(SELECT id FROM public.profiles WHERE org_id=$1))))
   OR(h.source_type=''admin_audit_event'' AND EXISTS(SELECT 1 FROM private.admin_audit_events a WHERE a.id=h.source_id AND a.actor_id IN(SELECT id FROM public.profiles WHERE org_id=$1)))
   OR(h.source_type=''billing_fact'' AND EXISTS(SELECT 1 FROM private.admin_billing_facts b WHERE b.id=h.source_id AND b.org_id=$1))
   OR(h.source_type=''reporting_classification'' AND h.source_id=$1)
   LIMIT 1001)records' INTO v_count USING p_org;v_optional:=v_optional+v_count;
 END IF;
 RETURN jsonb_build_object('foundationReviewRequired',v_foundation,'reviewRequired',
  v_foundation OR v_legacy+v_billing+v_formal+v_legal+v_optional>0,'countLimit',1000,
  'groups',jsonb_build_array(
   jsonb_build_object('key','legacy_recurring_references','count',LEAST(v_legacy,1000),'more',v_legacy>1000),
   jsonb_build_object('key','billing_evidence','count',LEAST(v_billing,1000),'more',v_billing>1000),
   jsonb_build_object('key','formal_register_records','count',LEAST(v_formal,1000),'more',v_formal>1000),
   jsonb_build_object('key','legal_evidence','count',LEAST(v_legal,1000),'more',v_legal>1000),
   jsonb_build_object('key','formal_sidecars_and_retention','count',LEAST(v_optional,1000),'more',v_optional>1000)));
END $$;
REVOKE ALL ON FUNCTION private.admin_retained_record_review(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.admin_account_deletion_needs_review(p_actor uuid,p_org uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT (private.admin_retained_record_review(p_actor,p_org)->>'reviewRequired')::boolean
$$;
REVOKE ALL ON FUNCTION private.admin_account_deletion_needs_review(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Counts only, no approval token or deletion operation. A live server/founder
-- grant and AAL2 provider-bound session are checked before privileged reads.
CREATE FUNCTION public.admin_retained_record_review_preview(p_actor_id uuid,p_session_id uuid,p_org_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_owner uuid;v_result jsonb;v_count integer;
BEGIN
 IF COALESCE(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Server operation required' USING ERRCODE='42501';END IF;
 PERFORM private.admin_assert_founder_session(p_actor_id,p_session_id);
 IF p_org_id IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'INVALID_REVIEW_QUERY' USING ERRCODE='22023';END IF;
 SELECT owner_id INTO v_owner FROM public.organizations WHERE id=p_org_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_ORGANIZATION_NOT_FOUND' USING ERRCODE='P0002';END IF;
 v_result:=private.admin_retained_record_review(v_owner,p_org_id);
 SELECT SUM((item->>'count')::integer) INTO v_count FROM jsonb_array_elements(v_result->'groups')item;
 PERFORM private.admin_append_audit(p_actor_id,p_session_id,'data_rights.review_preview','organization',p_org_id::text,'success',p_request_id,
  NULL,NULL,jsonb_build_object('count',v_count));
 RETURN v_result||jsonb_build_object('asOf',clock_timestamp(),'scope','retained_record_review','automaticDeletion',false);
END $$;
REVOKE ALL ON FUNCTION public.admin_retained_record_review_preview(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retained_record_review_preview(uuid,uuid,uuid,uuid) TO service_role;
COMMIT;
