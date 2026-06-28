-- Batch 4 commercials / receivables / payment correctness.
-- Forward-only hardening:
-- - Block the legacy direct market-run sale RPC that bypasses safe receivables.
-- - Require idempotency keys for commercial payment recording.
-- - Preserve commercial payment arithmetic and cheque metadata capture.
-- - Expose authoritative stock-sale origin fields to the commercial profit view.

ALTER TABLE public.commercial_payment_receipts
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_payment_receipts_org_idempotency_key
  ON public.commercial_payment_receipts(org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_market_run_sale(
    p_market_run_id     UUID,
    p_party_id          UUID,
    p_meters_sold       NUMERIC,
    p_price_per_meter   NUMERIC,
    p_sale_date         DATE,
    p_notes             TEXT,
    p_invoice_number    TEXT,
    p_due_date          DATE
)
RETURNS TABLE (
    sale_id          UUID,
    invoice_id       UUID,
    profit_per_meter NUMERIC,
    total_profit     NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id      UUID;
    v_caller_role TEXT;
BEGIN
    v_org_id := (auth.jwt() ->> 'org_id')::uuid;
    PERFORM public.assert_org_not_locked(v_org_id);

    v_caller_role := auth.jwt() ->> 'user_role';
    IF v_caller_role <> 'owner' THEN
        RAISE EXCEPTION 'Only owners can record market run sales';
    END IF;

    RAISE EXCEPTION 'Direct market-run sale is disabled. Sell from Godown Stock so the sale creates exactly one commercial receivable.';
END;
$$;

REVOKE ALL ON FUNCTION public.create_market_run_sale(UUID, UUID, NUMERIC, NUMERIC, DATE, TEXT, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_market_run_sale(UUID, UUID, NUMERIC, NUMERIC, DATE, TEXT, TEXT, DATE) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.record_commercial_payment_v1(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, DATE, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.record_commercial_payment_v1(
  p_receivable_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE,
  p_payment_mode TEXT,
  p_reference_number TEXT,
  p_cheque_number TEXT,
  p_cheque_date DATE,
  p_bank_name TEXT,
  p_notes TEXT,
  p_idempotency_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_role TEXT;
  v_current_received NUMERIC;
  v_total NUMERIC;
  v_idempotency_key TEXT;
  v_reference_number TEXT;
  v_cheque_number TEXT;
  v_bank_name TEXT;
  v_notes TEXT;
  v_existing_payment RECORD;
  v_inserted_receipt_id UUID;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  PERFORM public.assert_org_not_locked(v_org_id);

  v_role := auth.jwt() ->> 'user_role';
  v_idempotency_key := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_reference_number := NULLIF(btrim(COALESCE(p_reference_number, '')), '');
  v_cheque_number := NULLIF(btrim(COALESCE(p_cheque_number, '')), '');
  v_bank_name := NULLIF(btrim(COALESCE(p_bank_name, '')), '');
  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  IF v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can record payments';
  END IF;

  IF p_receivable_id IS NULL THEN
    RAISE EXCEPTION 'Receivable ID is required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'Payment date is required';
  END IF;

  IF p_payment_mode IS NULL OR p_payment_mode NOT IN ('cash','bank','upi','cheque','other') THEN
    RAISE EXCEPTION 'Invalid payment mode';
  END IF;

  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Payment idempotency key is required';
  END IF;

  IF p_payment_mode = 'cheque' AND (
    COALESCE(btrim(COALESCE(p_cheque_number, '')), '') = ''
    OR p_cheque_date IS NULL
    OR COALESCE(btrim(COALESCE(p_bank_name, '')), '') = ''
  ) THEN
    RAISE EXCEPTION 'Cheque number, cheque date, and bank name are required';
  END IF;

  SELECT received_amount, total_amount
    INTO v_current_received, v_total
  FROM public.commercial_receivables
  WHERE id = p_receivable_id AND org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receivable not found';
  END IF;

  SELECT *
    INTO v_existing_payment
  FROM public.commercial_payment_receipts
  WHERE org_id = v_org_id
    AND idempotency_key = v_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_payment.receivable_id <> p_receivable_id
      OR v_existing_payment.amount <> p_amount
      OR v_existing_payment.payment_date <> p_payment_date
      OR COALESCE(v_existing_payment.payment_mode, '') <> COALESCE(p_payment_mode, '')
      OR COALESCE(v_existing_payment.reference_number, '') <> COALESCE(v_reference_number, '')
      OR COALESCE(v_existing_payment.cheque_number, '') <> COALESCE(v_cheque_number, '')
      OR COALESCE(v_existing_payment.cheque_date, DATE '0001-01-01') <> COALESCE(p_cheque_date, DATE '0001-01-01')
      OR COALESCE(v_existing_payment.bank_name, '') <> COALESCE(v_bank_name, '')
      OR COALESCE(v_existing_payment.notes, '') <> COALESCE(v_notes, '')
    THEN
      RAISE EXCEPTION 'Payment idempotency key was already used for a different payment';
    END IF;
    RETURN;
  END IF;

  IF v_current_received + p_amount > v_total THEN
    RAISE EXCEPTION 'Payment amount exceeds remaining balance';
  END IF;

  INSERT INTO public.commercial_payment_receipts (
    org_id,
    receivable_id,
    amount,
    payment_date,
    payment_mode,
    reference_number,
    cheque_number,
    cheque_date,
    bank_name,
    notes,
    idempotency_key,
    created_by
  ) VALUES (
    v_org_id,
    p_receivable_id,
    p_amount,
    p_payment_date,
    p_payment_mode,
    v_reference_number,
    v_cheque_number,
    p_cheque_date,
    v_bank_name,
    v_notes,
    v_idempotency_key,
    auth.uid()
  )
  ON CONFLICT (org_id, idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_inserted_receipt_id;

  IF v_inserted_receipt_id IS NULL THEN
    SELECT *
      INTO v_existing_payment
    FROM public.commercial_payment_receipts
    WHERE org_id = v_org_id
      AND idempotency_key = v_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      IF v_existing_payment.receivable_id <> p_receivable_id
        OR v_existing_payment.amount <> p_amount
        OR v_existing_payment.payment_date <> p_payment_date
        OR COALESCE(v_existing_payment.payment_mode, '') <> COALESCE(p_payment_mode, '')
        OR COALESCE(v_existing_payment.reference_number, '') <> COALESCE(v_reference_number, '')
        OR COALESCE(v_existing_payment.cheque_number, '') <> COALESCE(v_cheque_number, '')
        OR COALESCE(v_existing_payment.cheque_date, DATE '0001-01-01') <> COALESCE(p_cheque_date, DATE '0001-01-01')
        OR COALESCE(v_existing_payment.bank_name, '') <> COALESCE(v_bank_name, '')
        OR COALESCE(v_existing_payment.notes, '') <> COALESCE(v_notes, '')
      THEN
        RAISE EXCEPTION 'Payment idempotency key was already used for a different payment';
      END IF;
      RETURN;
    END IF;

    RAISE EXCEPTION 'Payment could not be recorded idempotently';
  END IF;

  UPDATE public.commercial_receivables
  SET
    received_amount = received_amount + p_amount,
    payment_status = CASE
      WHEN received_amount + p_amount = total_amount THEN 'paid'
      ELSE 'partial'
    END,
    updated_by = auth.uid()
  WHERE id = p_receivable_id
    AND org_id = v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_commercial_payment_v1(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_commercial_payment_v1(UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.commercial_profit_entries
WITH (security_invoker = true)
AS
SELECT
  s.id AS source_id,
  s.org_id,
  s.party_id,
  COALESCE(p.name, NULLIF(s.party_name, ''), 'Named Stock Sale') AS party_name,
  'stock_sale'::TEXT AS source_kind,
  COALESCE(NULLIF(s.party_name, ''), p.name, 'Named Stock Sale') AS source_label,
  'realized'::TEXT AS stage,
  s.sale_date AS event_date,
  l.quality_label,
  (s.meters_sold::TEXT || ' m') AS quantity_label,
  s.taka_sold AS taka_count,
  s.meters_sold,
  s.price_per_meter,
  s.cost_per_meter,
  s.revenue_amount,
  s.cost_amount,
  s.gross_profit_amount,
  l.godown AS reference,
  s.created_at,
  l.source_type AS stock_source_type,
  l.market_run_id AS stock_market_run_id,
  l.order_id AS stock_order_id
FROM public.fabric_stock_sales s
JOIN public.fabric_stock_lots l ON l.id = s.stock_lot_id
LEFT JOIN public.parties p ON p.id = s.party_id

UNION ALL

SELECT
  s.id AS source_id,
  s.org_id,
  s.party_id,
  p.name AS party_name,
  'market_run_sale'::TEXT AS source_kind,
  'Market Run Sale'::TEXT AS source_label,
  'realized'::TEXT AS stage,
  s.sale_date AS event_date,
  COALESCE(mr.quality_label, mr.fabric_label) AS quality_label,
  (s.meters_sold::TEXT || ' m') AS quantity_label,
  NULL::NUMERIC AS taka_count,
  s.meters_sold,
  s.price_per_meter,
  s.cost_per_meter,
  ROUND(s.meters_sold * s.price_per_meter, 2) AS revenue_amount,
  ROUND(s.meters_sold * s.cost_per_meter, 2) AS cost_amount,
  ROUND(s.meters_sold * (s.price_per_meter - s.cost_per_meter), 2) AS gross_profit_amount,
  mr.fabric_label AS reference,
  s.created_at,
  NULL::TEXT AS stock_source_type,
  NULL::UUID AS stock_market_run_id,
  NULL::UUID AS stock_order_id
FROM public.market_run_sales s
JOIN public.market_runs mr ON mr.id = s.market_run_id
LEFT JOIN public.parties p ON p.id = s.party_id

UNION ALL

SELECT
  i.id AS source_id,
  i.org_id,
  COALESCE(i.party_id, o.party_id) AS party_id,
  COALESCE(p.name, o.party_name) AS party_name,
  'order_invoice'::TEXT AS source_kind,
  'Order Sale'::TEXT AS source_label,
  'realized'::TEXT AS stage,
  i.invoice_date AS event_date,
  COALESCE(o.quality_label, q.quality_label, 'Order') AS quality_label,
  (i.total_meters::TEXT || ' m') AS quantity_label,
  NULL::NUMERIC AS taka_count,
  i.total_meters AS meters_sold,
  i.rate_per_m AS price_per_meter,
  (
    COALESCE(q.landed_cost_per_meter, 0) +
    COALESCE(q.transport_per_m, 0) +
    (i.rate_per_m * COALESCE(q.commission_pct, 0) / 100)
  ) AS cost_per_meter,
  ROUND(i.total_meters * i.rate_per_m, 2) AS revenue_amount,
  ROUND(
    i.total_meters * (
      COALESCE(q.landed_cost_per_meter, 0) +
      COALESCE(q.transport_per_m, 0) +
      (i.rate_per_m * COALESCE(q.commission_pct, 0) / 100)
    ),
    2
  ) AS cost_amount,
  ROUND(
    i.total_meters * (
      i.rate_per_m - (
        COALESCE(q.landed_cost_per_meter, 0) +
        COALESCE(q.transport_per_m, 0) +
        (i.rate_per_m * COALESCE(q.commission_pct, 0) / 100)
      )
    ),
    2
  ) AS gross_profit_amount,
  COALESCE(i.invoice_number, o.party_name) AS reference,
  i.created_at,
  NULL::TEXT AS stock_source_type,
  NULL::UUID AS stock_market_run_id,
  NULL::UUID AS stock_order_id
FROM public.party_invoices i
JOIN public.orders o ON o.id = i.order_id
LEFT JOIN public.parties p ON p.id = COALESCE(i.party_id, o.party_id)
LEFT JOIN LATERAL (
  SELECT q.*
  FROM public.estimator_quotes q
  WHERE q.order_id = i.order_id
    AND q.org_id = i.org_id
  ORDER BY q.created_at DESC
  LIMIT 1
) q ON TRUE
WHERE i.status <> 'cancelled'
  AND i.order_id IS NOT NULL

UNION ALL

SELECT
  q.id AS source_id,
  q.org_id,
  o.party_id,
  COALESCE(p.name, o.party_name, q.party_name) AS party_name,
  'order_quote'::TEXT AS source_kind,
  'Expected Order Profit'::TEXT AS source_label,
  'expected'::TEXT AS stage,
  o.start_date AS event_date,
  COALESCE(o.quality_label, q.quality_label, 'Order') AS quality_label,
  (o.total_target_meters::TEXT || ' m') AS quantity_label,
  NULL::NUMERIC AS taka_count,
  o.total_target_meters AS meters_sold,
  q.quote_price_per_meter AS price_per_meter,
  (
    q.landed_cost_per_meter +
    q.transport_per_m +
    (q.quote_price_per_meter * q.commission_pct / 100)
  ) AS cost_per_meter,
  ROUND(o.total_target_meters * q.quote_price_per_meter, 2) AS revenue_amount,
  ROUND(
    o.total_target_meters * (
      q.landed_cost_per_meter +
      q.transport_per_m +
      (q.quote_price_per_meter * q.commission_pct / 100)
    ),
    2
  ) AS cost_amount,
  ROUND(
    o.total_target_meters * (
      q.quote_price_per_meter - (
        q.landed_cost_per_meter +
        q.transport_per_m +
        (q.quote_price_per_meter * q.commission_pct / 100)
      )
    ),
    2
  ) AS gross_profit_amount,
  COALESCE(o.party_name, q.party_name) AS reference,
  q.created_at,
  NULL::TEXT AS stock_source_type,
  NULL::UUID AS stock_market_run_id,
  NULL::UUID AS stock_order_id
FROM public.estimator_quotes q
JOIN public.orders o ON o.id = q.order_id
LEFT JOIN public.parties p ON p.id = o.party_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.party_invoices i
  WHERE i.order_id = o.id
    AND i.org_id = q.org_id
    AND i.status <> 'cancelled'
);

GRANT SELECT ON public.commercial_profit_entries TO authenticated;
