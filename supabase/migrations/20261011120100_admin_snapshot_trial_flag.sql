-- Founder reporting: admin_factory_snapshot exposes is_trial on each
-- subscription row (docs/superpowers/specs/2026-10-11-base-suppression-and-lite-trial-design.md, section B).
-- Without it the TypeScript resolvers read a lapsed Lite trial as established
-- paid history, so the console showed none instead of free. The body is the
-- 20261004151000 definition unchanged apart from the is_trial key; the signature,
-- return type, grants, search_path and comment are identical.

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
      coalesce(r.cohort,'unclassified') AS cohort,
      p.access_revoked_at IS NOT NULL AS revoked,
      CASE WHEN u.email_confirmed_at IS NOT NULL THEN u.email ELSE NULL END AS verified_email
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
    'verified_email',o.verified_email,'subscriptions',coalesce(s.rows,'[]'::jsonb),'has_free_grant',g.org_id IS NOT NULL,
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
