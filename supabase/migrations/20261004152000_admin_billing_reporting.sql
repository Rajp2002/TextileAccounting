-- Created via `supabase migration new admin_billing_reporting` as 20261004092813;
-- reordered after foundations/reporting metadata and existing Free migrations.
-- AD07: reporting evidence only. This migration never changes a payment,
-- subscription, gateway configuration or entitlement, and performs no backfill.
BEGIN;
CREATE TABLE private.admin_billing_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('capture', 'refund')),
  provider text NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 40),
  provider_account_id text NOT NULL CHECK (char_length(provider_account_id) BETWEEN 1 AND 160),
  provider_object_id text NOT NULL CHECK (char_length(provider_object_id) BETWEEN 1 AND 160),
  source_record_type text NOT NULL CHECK (char_length(source_record_type) BETWEEN 1 AND 80),
  source_record_id text NOT NULL CHECK (char_length(source_record_id) BETWEEN 1 AND 160),
  org_id uuid REFERENCES public.organizations(id),
  payment_reference text CHECK (char_length(payment_reference) <= 160),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  tax_minor bigint CHECK (tax_minor >= 0 AND tax_minor <= amount_minor),
  occurred_at timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  time_basis text NOT NULL CHECK (time_basis IN ('provider_verified', 'local_recorded', 'unknown')),
  mode text NOT NULL CHECK (mode IN ('live', 'test', 'unknown')),
  verification_state text NOT NULL CHECK (verification_state IN ('verified', 'unverified', 'conflict')),
  verified_at timestamptz,
  evidence_ref text CHECK (char_length(evidence_ref) <= 500),
  plan_at_sale text CHECK (plan_at_sale IN ('lite', 'base')),
  purchase_type text CHECK (purchase_type IN ('initial_purchase', 'renewal', 'offline_verified', 'adjustment')),
  UNIQUE (provider, provider_account_id, mode, kind, provider_object_id),
  CHECK (verification_state <> 'verified' OR (verified_at IS NOT NULL AND occurred_at IS NOT NULL
    AND time_basis = 'provider_verified' AND mode IN ('live', 'test') AND nullif(btrim(evidence_ref), '') IS NOT NULL))
);
COMMENT ON TABLE private.admin_billing_facts IS 'Rebuildable read-only reporting projection. A verified refund means evidenced provider processed refund, never a local issued/create acknowledgement. Each partial refund has its own provider object ID. Unknown mode/time/tax remain unknown.';
CREATE INDEX admin_billing_facts_period_idx ON private.admin_billing_facts(currency, occurred_at DESC, id DESC);
CREATE INDEX admin_billing_facts_org_idx ON private.admin_billing_facts(org_id, occurred_at DESC, id DESC);
CREATE INDEX admin_billing_facts_source_idx ON private.admin_billing_facts(source_record_type, source_record_id);

CREATE TABLE private.admin_billing_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 40),
  provider_account_id text NOT NULL CHECK (char_length(provider_account_id) BETWEEN 1 AND 160),
  mode text NOT NULL CHECK (mode IN ('live', 'test', 'unknown')),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL CHECK (period_end > period_start),
  capture_state text NOT NULL CHECK (capture_state IN ('complete', 'partial', 'unknown')),
  refund_state text NOT NULL CHECK (refund_state IN ('complete', 'partial', 'unknown')),
  checked_at timestamptz NOT NULL,
  evidence_ref text NOT NULL CHECK (char_length(btrim(evidence_ref)) BETWEEN 1 AND 500),
  conflicts_count integer NOT NULL DEFAULT 0 CHECK (conflicts_count >= 0),
  CHECK (conflicts_count = 0 OR (capture_state <> 'complete' AND refund_state <> 'complete'))
);
COMMENT ON TABLE private.admin_billing_coverage IS 'Independent reviewed provider feed coverage, including partial/out-of-band refunds. Missing or gapped coverage is unknown. These rows cannot cause capture, refund, activation or mark-paid actions.';
CREATE INDEX admin_billing_coverage_period_idx ON private.admin_billing_coverage(provider, provider_account_id, mode, currency, period_start, period_end);
ALTER TABLE private.admin_billing_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_billing_coverage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.admin_billing_facts, private.admin_billing_coverage FROM PUBLIC, anon, authenticated, service_role;
-- Projection population is a separate reviewed operator job, deliberately absent.

CREATE FUNCTION public.admin_billing_report_input(
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
  SELECT f.*, coalesce(r.cohort, 'unclassified') AS cohort,
      f.mode = 'live' AND f.verification_state = 'verified' AND f.time_basis = 'provider_verified'
        AND f.occurred_at IS NOT NULL AND r.cohort = 'production'
        AND NOT EXISTS (SELECT 1 FROM public.subscription_payments p WHERE f.source_record_type='subscription_payments' AND f.source_record_id=p.id::text
          AND (f.org_id IS DISTINCT FROM p.org_id OR f.amount_minor <> p.amount_paise OR f.provider_object_id IS DISTINCT FROM p.razorpay_payment_id))
        AND NOT EXISTS (SELECT 1 FROM public.billing_payment_refunds p WHERE f.source_record_type='billing_payment_refunds' AND f.source_record_id=p.id::text
          AND (f.org_id IS DISTINCT FROM p.org_id OR f.amount_minor <> p.amount_paise OR f.provider_object_id IS DISTINCT FROM p.provider_refund_id)) AS confirmed
    FROM private.admin_billing_facts f LEFT JOIN private.admin_org_reporting r ON r.org_id = f.org_id
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
      'cohort', coalesce(r.cohort,'unclassified'), 'planAtSale', f.plan_at_sale, 'purchaseType', f.purchase_type,
      'evidenceRef', f.evidence_ref) AS item
    FROM private.admin_billing_facts f LEFT JOIN private.admin_org_reporting r ON r.org_id = f.org_id
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

CREATE FUNCTION public.admin_audit_list(p_actor_id uuid,p_session_id uuid,p_limit integer DEFAULT 25,p_cursor_at timestamptz DEFAULT NULL,p_cursor_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_rows jsonb;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN RAISE EXCEPTION 'Server operation required' USING ERRCODE='42501'; END IF;
  PERFORM private.admin_assert_founder_session(p_actor_id,p_session_id);
  IF p_limit NOT BETWEEN 1 AND 100 OR (p_cursor_at IS NULL) <> (p_cursor_id IS NULL) THEN RAISE EXCEPTION 'INVALID_AUDIT_QUERY' USING ERRCODE='22023'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at DESC,e.id DESC),'[]'::jsonb) INTO v_rows FROM (
    SELECT id,occurred_at,actor_id,session_hash,action,target_type,target_id,outcome,reason_code,before_safe,after_safe,request_id
    FROM private.admin_audit_events WHERE p_cursor_at IS NULL OR (occurred_at,id)<(p_cursor_at,p_cursor_id)
    ORDER BY occurred_at DESC,id DESC LIMIT p_limit+1
  ) e;
  RETURN v_rows;
END $$;
REVOKE ALL ON FUNCTION public.admin_audit_list(uuid,uuid,integer,timestamptz,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_audit_list(uuid,uuid,integer,timestamptz,uuid) TO service_role;
COMMIT;
