-- Every factory counts as a real customer unless the founder marks it.
--
-- Spec: docs/superpowers/specs/2026-10-30-founder-metrics-and-activity-design.md, section B.
-- Until now a missing private.admin_org_reporting row meant 'unclassified', which every
-- founder total excluded, and nothing in the app wrote that table, so the console counted
-- no customers. A missing row now resolves to 'production', except owners whose email is
-- the founder's login email or a + alias of it (same local part before +, same domain),
-- which resolve to 'internal'. Explicit rows still win; 'unclassified' stays valid.
--
-- admin_factory_snapshot (latest: 20261011120100) and admin_billing_report_input
-- (20261004152000) are restated verbatim apart from the cohort expression, the owner join
-- the billing report needs for it, and the snapshot's new owner_name/owner_phone keys.
-- Billing facts with no organization stay 'unclassified'.

CREATE FUNCTION private.is_founder_alias(p_email text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT p_email IS NOT NULL AND position('@' IN p_email) > 1 AND EXISTS (
    SELECT 1 FROM private.platform_founder_grants g
    WHERE g.enabled AND g.revoked_at IS NULL AND g.login_email IS NOT NULL
      AND split_part(lower(btrim(p_email)), '@', 2) = split_part(lower(btrim(g.login_email)), '@', 2)
      AND split_part(split_part(lower(btrim(p_email)), '@', 1), '+', 1) = split_part(lower(btrim(g.login_email)), '@', 1)
  )
$$;
REVOKE ALL ON FUNCTION private.is_founder_alias(text) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION private.is_founder_alias(text) IS 'True for the active founder login email and its + aliases. Reporting classification only; never an access check.';

CREATE FUNCTION private.resolve_reporting_cohort(p_explicit text, p_owner_email text) RETURNS text
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce(p_explicit, CASE WHEN private.is_founder_alias(p_owner_email) THEN 'internal' ELSE 'production' END)
$$;
REVOKE ALL ON FUNCTION private.resolve_reporting_cohort(text, text) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION private.resolve_reporting_cohort(text, text) IS 'Founder reporting cohort: the explicit classification, else internal for founder aliases, else production.';

CREATE OR REPLACE FUNCTION public.admin_factory_snapshot(
  p_actor_id uuid, p_session_id uuid, p_as_of timestamptz,
  p_org_id uuid DEFAULT NULL, p_search text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,private,public SET timezone='UTC' AS $$
DECLARE v_result jsonb; v_count bigint; v_pattern text;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'ADMIN_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  PERFORM private.admin_assert_founder_session(p_actor_id,p_session_id);
  IF p_as_of IS NULL OR p_as_of > clock_timestamp()+interval '1 second'
    OR p_as_of < clock_timestamp()-interval '1 day'
    OR p_search IS NULL OR length(p_search)>120 THEN
    RAISE EXCEPTION 'ADMIN_INVALID_FILTER' USING ERRCODE='22023';
  END IF;
  -- Literal substring search, no dynamic SQL or caller-provided column/sort.
  v_pattern := '%' || replace(replace(replace(btrim(p_search),'\','\\'),'%','\%'),'_','\_') || '%';
  SELECT count(*) INTO v_count FROM public.organizations o
  LEFT JOIN auth.users u ON u.id=o.owner_id
  WHERE o.created_at<=p_as_of AND (p_org_id IS NULL OR o.id=p_org_id)
    AND (p_search='' OR o.name ILIKE v_pattern OR o.id::text=btrim(p_search)
      OR (u.email_confirmed_at IS NOT NULL AND u.email ILIKE v_pattern)
      OR EXISTS (SELECT 1 FROM public.subscription_payments payment WHERE payment.org_id=o.id
        AND payment.created_at<=p_as_of AND (payment.razorpay_payment_id=btrim(p_search) OR payment.razorpay_order_id=btrim(p_search))));
  -- Deliberate server aggregation bound. Overload is unavailable, never truncated
  -- counts. The 1,000-organization fixture is comfortably inside this boundary.
  IF v_count>10000 THEN RAISE EXCEPTION 'ADMIN_POPULATION_BOUND' USING ERRCODE='54000'; END IF;
  -- Keep nested entitlement inputs bounded too. No silent truncation may hide
  -- an earlier qualifying term or change the customer resolver's answer.
  IF EXISTS(SELECT 1 FROM public.org_subscriptions s
    WHERE (p_org_id IS NULL OR s.org_id=p_org_id) AND s.created_at<=p_as_of
    GROUP BY s.org_id HAVING count(*)>1000)
    OR (SELECT count(*) FROM public.org_subscriptions s WHERE (p_org_id IS NULL OR s.org_id=p_org_id) AND s.created_at<=p_as_of)>50000 THEN
    RAISE EXCEPTION 'ADMIN_ENTITLEMENT_BOUND' USING ERRCODE='54000';
  END IF;
  WITH population AS MATERIALIZED (
    SELECT o.id,o.name,o.created_at,o.owner_id,coalesce(o.is_locked_down,false) AS locked,
      private.resolve_reporting_cohort(r.cohort,u.email) AS cohort,
      p.access_revoked_at IS NOT NULL AS revoked,
      CASE WHEN u.email_confirmed_at IS NOT NULL THEN u.email ELSE NULL END AS verified_email,
      p.full_name AS owner_name, p.phone AS owner_phone
    FROM public.organizations o LEFT JOIN private.admin_org_reporting r ON r.org_id=o.id
    LEFT JOIN public.profiles p ON p.id=o.owner_id
    LEFT JOIN auth.users u ON u.id=o.owner_id
    WHERE o.created_at<=p_as_of AND (p_org_id IS NULL OR o.id=p_org_id)
      AND (p_search='' OR o.name ILIKE v_pattern OR o.id::text=btrim(p_search)
        OR (u.email_confirmed_at IS NOT NULL AND u.email ILIKE v_pattern)
        OR EXISTS (SELECT 1 FROM public.subscription_payments payment WHERE payment.org_id=o.id
          AND payment.created_at<=p_as_of AND (payment.razorpay_payment_id=btrim(p_search) OR payment.razorpay_order_id=btrim(p_search))))
  ), subscriptions AS (
    SELECT s.org_id,jsonb_agg(jsonb_build_object('id',s.id,'status',s.status,'plan_tier',s.plan_tier,
      'current_start',s.current_start,'current_end',s.current_end,'razorpay_payment_id',s.razorpay_payment_id,'created_at',s.created_at,'is_trial',s.is_trial,
      'payment_evidenced',EXISTS(SELECT 1 FROM public.subscription_payments payment
        JOIN private.admin_billing_facts fact ON fact.source_record_type='subscription_payments'
          AND fact.source_record_id::text=payment.id::text
          AND fact.org_id=payment.org_id AND fact.provider='razorpay'
          AND fact.provider_object_id=payment.razorpay_payment_id AND fact.kind='capture'
          AND fact.mode='live' AND fact.verification_state='verified' AND fact.time_basis='provider_verified'
          AND fact.currency='INR' AND fact.amount_minor=payment.amount_paise
          AND fact.occurred_at IS NOT NULL AND fact.occurred_at<=p_as_of AND fact.plan_at_sale=s.plan_tier
        WHERE payment.org_id=s.org_id AND payment.razorpay_payment_id=s.razorpay_payment_id
        -- Verified provider capture remains evidence even if a later local
        -- status label is failed/refunded; captures are never erased by labels.
        AND payment.amount_paise>0 AND payment.created_at<=p_as_of)) ORDER BY s.created_at,s.id) AS rows
    FROM public.org_subscriptions s JOIN population o ON o.id=s.org_id WHERE s.created_at<=p_as_of GROUP BY s.org_id
  ), original_costings AS (
    SELECT q.org_id,min(q.created_at) FILTER (WHERE q.version_number=1) AS first_at,max(q.created_at) AS last_at
    FROM public.estimator_quotes q JOIN population o ON o.id=q.org_id
    WHERE q.record_kind='costing' AND q.template_id IS NULL AND q.created_at<p_as_of GROUP BY q.org_id
  ), free_costings AS (
    -- Saved originals genuinely identify one organization. Raw subject funnel
    -- events are deliberately absent: they must not fan out through grants.
    SELECT f.org_id,min(f.created_at) AS first_at,
      greatest(max(f.created_at),max(f.updated_at) FILTER (WHERE f.revision>1 AND f.updated_at<p_as_of)) AS last_at
    FROM public.free_saved_costings f JOIN population o ON o.id=f.org_id WHERE f.created_at<p_as_of GROUP BY f.org_id
  ), production AS (
    -- The reviewed writer commits a retained receipt after each successful
    -- save. Batch creation is not an outcome timestamp: a saved zero/blank
    -- sheet may be corrected to positive production much later. Read only
    -- allowlisted aggregate response fields, never the request/worker payload.
    -- Legacy batches without a successful receipt remain unobserved.
    SELECT r.org_id,min(r.created_at) AS first_at,max(r.created_at) AS last_at
    FROM public.base_production_save_receipts r JOIN population o ON o.id=r.org_id
    WHERE r.created_at<p_as_of
      AND r.response->'success'='true'::jsonb AND r.response->'idempotent'='false'::jsonb
      AND r.response->>'batch_id'=r.batch_id::text
      AND CASE WHEN jsonb_typeof(r.response->'total_meters')='number'
        THEN (r.response->>'total_meters')::numeric>0 ELSE false END
      AND CASE WHEN jsonb_typeof(r.response->'entered_count')='number'
        THEN (r.response->>'entered_count')::numeric>0 ELSE false END
    GROUP BY r.org_id
  ), support AS (
    SELECT t.org_id,count(*) FILTER(WHERE t.status<>'resolved') AS unresolved
    FROM public.support_tickets t JOIN population o ON o.id=t.org_id WHERE t.created_at<=p_as_of GROUP BY t.org_id
  ) SELECT jsonb_build_object('asOf',p_as_of,'rows',coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'name',o.name,'created_at',o.created_at,'cohort',o.cohort,'is_locked_down',o.locked,'owner_revoked',o.revoked,
    'verified_email',o.verified_email,'owner_name',o.owner_name,'owner_phone',o.owner_phone,'subscriptions',coalesce(s.rows,'[]'::jsonb),'has_free_grant',g.org_id IS NOT NULL,
    'free_subject_id',g.subject_id,'estimator_at',least(c.first_at,f.first_at),'production_at',p.first_at,
    'last_outcome_at',greatest(c.last_at,f.last_at,p.last_at),'open_tickets',coalesce(t.unresolved,0)
  ) ORDER BY o.created_at DESC,o.id),'[]'::jsonb)) INTO v_result
  FROM population o LEFT JOIN subscriptions s ON s.org_id=o.id
  LEFT JOIN public.free_account_grants g ON g.org_id=o.id
  LEFT JOIN original_costings c ON c.org_id=o.id LEFT JOIN free_costings f ON f.org_id=o.id
  LEFT JOIN production p ON p.org_id=o.id LEFT JOIN support t ON t.org_id=o.id;
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.admin_factory_snapshot(uuid,uuid,timestamptz,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_factory_snapshot(uuid,uuid,timestamptz,uuid,text) TO service_role;
COMMENT ON FUNCTION public.admin_factory_snapshot IS 'Guarded service-only bounded read model. Canonical TypeScript entitlement resolution stays authoritative. No private business inputs, worker identities, salaries, balances, subject event fanout or economic writes.';

CREATE OR REPLACE FUNCTION public.admin_billing_report_input(
  p_actor_id uuid, p_session_id uuid, p_from timestamptz, p_to timestamptz,
  p_currency text DEFAULT 'INR', p_limit integer DEFAULT 25,
  p_cursor_at timestamptz DEFAULT NULL, p_cursor_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_summary jsonb; v_coverage jsonb; v_accounts jsonb; v_ledger jsonb; v_diagnostics jsonb; v_exceptions jsonb;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN RAISE EXCEPTION 'Server operation required' USING ERRCODE='42501'; END IF;
  PERFORM private.admin_assert_founder_session(p_actor_id, p_session_id);
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to OR p_to > clock_timestamp()
    OR p_to - p_from > interval '366 days' OR p_currency <> 'INR' OR p_limit NOT BETWEEN 1 AND 100
    OR (p_cursor_at IS NULL) <> (p_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'INVALID_REPORT_QUERY' USING ERRCODE = '22023';
  END IF;
  -- Refuse overloaded evidence populations rather than silently truncate coverage.
  IF (SELECT count(*) FROM private.admin_billing_coverage WHERE currency=p_currency AND period_start<p_to AND period_end>p_from)>5000
    OR (SELECT count(*) FROM (SELECT DISTINCT provider,provider_account_id FROM private.admin_billing_facts WHERE mode<>'test' AND currency=p_currency
      UNION SELECT DISTINCT provider,provider_account_id FROM private.admin_billing_coverage WHERE mode='live' AND currency=p_currency) a)>1000
  THEN RAISE EXCEPTION 'REPORT_EVIDENCE_BOUND' USING ERRCODE='54000'; END IF;
  WITH scoped AS (
  SELECT f.*, CASE WHEN f.org_id IS NULL THEN 'unclassified' ELSE private.resolve_reporting_cohort(r.cohort, ou.email) END AS cohort,
      f.mode = 'live' AND f.verification_state = 'verified' AND f.time_basis = 'provider_verified'
        AND f.occurred_at IS NOT NULL AND CASE WHEN f.org_id IS NULL THEN 'unclassified' ELSE private.resolve_reporting_cohort(r.cohort, ou.email) END = 'production'
        AND NOT EXISTS (SELECT 1 FROM public.subscription_payments p WHERE f.source_record_type='subscription_payments' AND f.source_record_id=p.id::text
          AND (f.org_id IS DISTINCT FROM p.org_id OR f.amount_minor <> p.amount_paise OR f.provider_object_id IS DISTINCT FROM p.razorpay_payment_id))
        AND NOT EXISTS (SELECT 1 FROM public.billing_payment_refunds p WHERE f.source_record_type='billing_payment_refunds' AND f.source_record_id=p.id::text
          AND (f.org_id IS DISTINCT FROM p.org_id OR f.amount_minor <> p.amount_paise OR f.provider_object_id IS DISTINCT FROM p.provider_refund_id)) AS confirmed
    FROM private.admin_billing_facts f LEFT JOIN private.admin_org_reporting r ON r.org_id = f.org_id
      LEFT JOIN public.organizations oo ON oo.id = f.org_id LEFT JOIN auth.users ou ON ou.id = oo.owner_id
    WHERE f.currency = p_currency AND (f.occurred_at IS NULL OR (f.occurred_at >= p_from AND f.occurred_at < p_to))
  ) SELECT jsonb_build_object(
    'knownGrossMinor', coalesce(sum(amount_minor) FILTER (WHERE confirmed AND kind = 'capture'), 0)::text,
    'knownRefundMinor', coalesce(sum(amount_minor) FILTER (WHERE confirmed AND kind = 'refund'), 0)::text,
    'captureCount', count(*) FILTER (WHERE confirmed AND kind = 'capture'),
    'refundCount', count(*) FILTER (WHERE confirmed AND kind = 'refund'),
    'unverifiedMinor', coalesce(sum(amount_minor) FILTER (WHERE NOT coalesce(confirmed,false) AND mode <> 'test' AND cohort NOT IN ('test','demo','internal')), 0)::text,
    'unverifiedCount', count(*) FILTER (WHERE NOT coalesce(confirmed,false) AND mode <> 'test' AND cohort NOT IN ('test','demo','internal')),
    'excludedCount', count(*) FILTER (WHERE mode = 'test' OR cohort IN ('test','demo','internal')),
    'taxExclusiveKnownMinor', coalesce(sum((amount_minor-tax_minor) * CASE kind WHEN 'capture' THEN 1 ELSE -1 END) FILTER (WHERE confirmed AND tax_minor IS NOT NULL), 0)::text,
    'taxExcludedMinor', coalesce(sum(amount_minor) FILTER (WHERE confirmed AND tax_minor IS NULL), 0)::text
  ) INTO v_summary FROM scoped;

  SELECT coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'providerAccountId', provider_account_id,
    'mode', mode, 'currency', currency, 'periodStart', period_start, 'periodEnd', period_end,
    'captureState', capture_state, 'refundState', refund_state, 'checkedAt', checked_at, 'conflictsCount', conflicts_count)
    ORDER BY period_start), '[]'::jsonb) INTO v_coverage
  FROM private.admin_billing_coverage WHERE currency = p_currency AND period_start < p_to AND period_end > p_from;
  SELECT coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'providerAccountId', provider_account_id)), '[]'::jsonb)
    INTO v_accounts FROM (
    SELECT DISTINCT provider, provider_account_id FROM private.admin_billing_facts WHERE mode <> 'test' AND currency = p_currency
    UNION SELECT DISTINCT provider, provider_account_id FROM private.admin_billing_coverage WHERE mode = 'live' AND currency = p_currency
  ) a;

  SELECT coalesce(jsonb_agg(item ORDER BY recorded_at DESC, id DESC), '[]'::jsonb) INTO v_ledger FROM (
    SELECT f.id, f.recorded_at, jsonb_build_object('id', f.id, 'kind', f.kind, 'provider', f.provider,
      'providerAccountId', f.provider_account_id, 'providerObjectId', f.provider_object_id, 'orgId', f.org_id,
      'paymentReference', f.payment_reference, 'currency', f.currency, 'amountMinor', f.amount_minor::text,
      'taxMinor', f.tax_minor::text, 'occurredAt', f.occurred_at, 'recordedAt', f.recorded_at,
      'timeBasis', f.time_basis, 'mode', f.mode, 'verificationState', f.verification_state,
      'cohort', CASE WHEN f.org_id IS NULL THEN 'unclassified' ELSE private.resolve_reporting_cohort(r.cohort, ou.email) END, 'planAtSale', f.plan_at_sale, 'purchaseType', f.purchase_type,
      'evidenceRef', f.evidence_ref) AS item
    FROM private.admin_billing_facts f LEFT JOIN private.admin_org_reporting r ON r.org_id = f.org_id
      LEFT JOIN public.organizations oo ON oo.id = f.org_id LEFT JOIN auth.users ou ON ou.id = oo.owner_id
    WHERE f.currency = p_currency AND (f.occurred_at IS NULL OR (f.occurred_at >= p_from AND f.occurred_at < p_to))
      AND (p_cursor_at IS NULL OR (f.recorded_at,f.id) < (p_cursor_at,p_cursor_id))
    ORDER BY f.recorded_at DESC,f.id DESC LIMIT p_limit + 1
  ) rows;

  SELECT jsonb_build_object(
    'sourcePayments', (SELECT count(*) FROM public.subscription_payments),
    'sourceAttempts', (SELECT count(*) FROM public.billing_checkout_attempts),
    'sourceRefunds', (SELECT count(*) FROM public.billing_payment_refunds),
    'unmappedPayments', (SELECT count(*) FROM public.subscription_payments p WHERE p.status IN ('captured','refunded') AND NOT EXISTS (
      SELECT 1 FROM private.admin_billing_facts f WHERE f.kind='capture' AND f.source_record_type='subscription_payments' AND f.source_record_id=p.id::text)),
    'unmappedRefunds', (SELECT count(*) FROM public.billing_payment_refunds p WHERE NOT EXISTS (
      SELECT 1 FROM private.admin_billing_facts f WHERE f.kind='refund' AND f.source_record_type='billing_payment_refunds' AND f.source_record_id=p.id::text)),
    'unmappedPaymentAmountMinor', (SELECT coalesce(sum(p.amount_paise),0)::text FROM public.subscription_payments p WHERE p.status IN ('captured','refunded') AND NOT EXISTS (
      SELECT 1 FROM private.admin_billing_facts f WHERE f.kind='capture' AND f.source_record_type='subscription_payments' AND f.source_record_id=p.id::text)),
    'unmappedRefundAmountMinor', (SELECT coalesce(sum(p.amount_paise),0)::text FROM public.billing_payment_refunds p WHERE NOT EXISTS (
      SELECT 1 FROM private.admin_billing_facts f WHERE f.kind='refund' AND f.source_record_type='billing_payment_refunds' AND f.source_record_id=p.id::text)),
    'pendingRefunds', (SELECT count(*) FROM public.billing_payment_refunds WHERE status='pending'),
    'issuedUnconfirmedRefunds', (SELECT count(*) FROM public.billing_payment_refunds WHERE status='issued'),
    'failedRefunds', (SELECT count(*) FROM public.billing_payment_refunds WHERE status='failed'),
    'unknownMode', (SELECT count(*) FROM private.admin_billing_facts WHERE mode='unknown'),
    'unknownTime', (SELECT count(*) FROM private.admin_billing_facts WHERE time_basis<>'provider_verified' OR occurred_at IS NULL),
    'conflictingFacts', (SELECT count(*) FROM private.admin_billing_facts WHERE verification_state='conflict'),
    'sourceConflicts', (SELECT count(*) FROM private.admin_billing_facts f WHERE
      EXISTS (SELECT 1 FROM public.subscription_payments p WHERE f.source_record_type='subscription_payments' AND f.source_record_id=p.id::text
        AND (f.org_id IS DISTINCT FROM p.org_id OR f.amount_minor<>p.amount_paise OR f.provider_object_id IS DISTINCT FROM p.razorpay_payment_id))
      OR EXISTS (SELECT 1 FROM public.billing_payment_refunds p WHERE f.source_record_type='billing_payment_refunds' AND f.source_record_id=p.id::text
        AND (f.org_id IS DISTINCT FROM p.org_id OR f.amount_minor<>p.amount_paise OR f.provider_object_id IS DISTINCT FROM p.provider_refund_id))),
    'orphanedPayments', (SELECT count(*) FROM public.subscription_payments WHERE subscription_id IS NULL),
    'duplicateProviderIds', (SELECT count(*) FROM (SELECT razorpay_payment_id FROM public.subscription_payments WHERE razorpay_payment_id IS NOT NULL GROUP BY razorpay_payment_id HAVING count(*)>1) d),
    'unknownTax', (SELECT count(*) FROM private.admin_billing_facts WHERE tax_minor IS NULL)
  ) INTO v_diagnostics;
  SELECT coalesce(jsonb_agg(item ORDER BY occurred_at, id), '[]'::jsonb) INTO v_exceptions FROM (
    SELECT id, updated_at AS occurred_at, jsonb_build_object('id','attempt:'||id,'orgId',org_id,'reference',coalesce(provider_payment_id,provider_order_id,id::text),
      'reasonCode',status,'reason',CASE status WHEN 'activation_pending' THEN 'Payment activation needs review.' WHEN 'reconciliation_required' THEN 'Payment evidence needs reconciliation.' ELSE 'Payment processing outcome is unknown.' END,
      'severity','high','observedAt',updated_at,'href','/admin/factories/'||org_id::text) AS item
    FROM public.billing_checkout_attempts WHERE status IN ('activation_pending','reconciliation_required','unknown')
    UNION ALL
    SELECT id, updated_at, jsonb_build_object('id','refund:'||id,'orgId',org_id,'reference',coalesce(provider_refund_id,razorpay_payment_id),
      'reasonCode','refund_'||status,'reason',CASE status WHEN 'issued' THEN 'Refund created; processed outcome and access consequence are unconfirmed.' WHEN 'failed' THEN 'Refund request failed and needs review.' ELSE 'Refund pending; no completed refund is established.' END,
      'severity','high','observedAt',updated_at,'href','/admin/factories/'||org_id::text)
    FROM public.billing_payment_refunds
    UNION ALL
    SELECT f.id, coalesce(f.occurred_at,f.recorded_at), jsonb_build_object('id','capture:'||f.id,'orgId',f.org_id,'reference',f.provider_object_id,
      'reasonCode','capture_entitlement_link_missing','reason','Verified capture has no matching entitlement link; review access evidence.',
      'severity','high','observedAt',coalesce(f.occurred_at,f.recorded_at),'href','/admin/factories/'||f.org_id::text)
    FROM private.admin_billing_facts f WHERE f.kind='capture' AND f.mode='live' AND f.verification_state='verified' AND f.org_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.org_subscriptions s WHERE s.org_id=f.org_id AND s.razorpay_payment_id=f.payment_reference)
    UNION ALL
    SELECT f.id, f.recorded_at, jsonb_build_object('id','conflict:'||f.id,'orgId',f.org_id,'reference',f.provider_object_id,
      'reasonCode','capture_source_conflict','reason','Reporting evidence conflicts with the source amount or factory; preserve both and review.',
      'severity','high','observedAt',f.recorded_at,'href',CASE WHEN f.org_id IS NULL THEN '/admin/payments' ELSE '/admin/factories/'||f.org_id::text END)
    FROM private.admin_billing_facts f JOIN public.subscription_payments p ON f.source_record_type='subscription_payments' AND f.source_record_id=p.id::text
    WHERE f.kind='capture' AND (f.org_id IS DISTINCT FROM p.org_id OR f.amount_minor <> p.amount_paise OR f.provider_object_id IS DISTINCT FROM p.razorpay_payment_id)
    ORDER BY occurred_at,id LIMIT 100
  ) e;
  RETURN jsonb_build_object('summary',v_summary,'coverage',v_coverage,'accounts',v_accounts,'ledger',v_ledger,'diagnostics',v_diagnostics,'exceptions',v_exceptions,'asOf',clock_timestamp());
END $$;
REVOKE ALL ON FUNCTION public.admin_billing_report_input(uuid,uuid,timestamptz,timestamptz,text,integer,timestamptz,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_billing_report_input(uuid,uuid,timestamptz,timestamptz,text,integer,timestamptz,uuid) TO service_role;
