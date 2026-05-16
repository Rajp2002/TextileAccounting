-- Phase 1 refinement: party-first stock sale and optional dispatch.
-- Keeps the existing order-dispatch RPC intact while allowing market-run stock
-- to be sold to a named party without creating a fake order.

ALTER TABLE fabric_stock_sales
  ADD COLUMN IF NOT EXISTS party_name TEXT,
  ADD COLUMN IF NOT EXISTS party_phone TEXT,
  ADD COLUMN IF NOT EXISTS party_city TEXT,
  ADD COLUMN IF NOT EXISTS party_gstin TEXT,
  ADD COLUMN IF NOT EXISTS credit_days INTEGER NOT NULL DEFAULT 0 CHECK (credit_days >= 0),
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS dispatch_status TEXT NOT NULL DEFAULT 'not_dispatched'
    CHECK (dispatch_status IN ('not_dispatched','partially_dispatched','dispatched','received','discrepancy')),
  ADD COLUMN IF NOT EXISTS dispatched_meters NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (dispatched_meters >= 0),
  ADD COLUMN IF NOT EXISTS pending_dispatch_meters NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pending_dispatch_meters >= 0),
  ADD COLUMN IF NOT EXISTS dispatch_date DATE,
  ADD COLUMN IF NOT EXISTS transport_name TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_number TEXT,
  ADD COLUMN IF NOT EXISTS challan_number TEXT;

UPDATE fabric_stock_sales s
SET
  party_name = COALESCE(s.party_name, o.party_name, 'Legacy Stock Sale'),
  due_date = COALESCE(s.due_date, s.sale_date + COALESCE(s.credit_days, 0)),
  dispatched_meters = COALESCE(s.dispatched_meters, CASE WHEN s.dispatch_id IS NULL THEN 0 ELSE s.meters_sold END),
  pending_dispatch_meters = GREATEST(s.meters_sold - COALESCE(s.dispatched_meters, CASE WHEN s.dispatch_id IS NULL THEN 0 ELSE s.meters_sold END), 0),
  dispatch_status = CASE
    WHEN s.dispatch_status = 'received' THEN 'received'
    WHEN s.dispatch_id IS NOT NULL THEN 'dispatched'
    ELSE COALESCE(s.dispatch_status, 'not_dispatched')
  END
FROM fabric_stock_lots l
LEFT JOIN orders o ON o.id = l.order_id
WHERE l.id = s.stock_lot_id
  AND (s.party_name IS NULL OR s.due_date IS NULL);

ALTER TABLE commercial_receivables
  DROP CONSTRAINT IF EXISTS commercial_receivables_payment_status_check;

ALTER TABLE commercial_receivables
  ADD CONSTRAINT commercial_receivables_payment_status_check
  CHECK (payment_status IN ('unpaid','partial','paid','overdue'));

ALTER TABLE dispatches
  ALTER COLUMN order_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS stock_sale_id UUID REFERENCES fabric_stock_sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS party_name TEXT,
  ADD COLUMN IF NOT EXISTS party_phone TEXT,
  ADD COLUMN IF NOT EXISTS party_city TEXT,
  ADD COLUMN IF NOT EXISTS challan_number TEXT;

CREATE INDEX IF NOT EXISTS idx_dispatches_stock_sale
  ON dispatches(stock_sale_id)
  WHERE stock_sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fabric_stock_sales_party_dispatch
  ON fabric_stock_sales(org_id, party_name, dispatch_status, due_date);

CREATE OR REPLACE VIEW commercial_profit_entries
WITH (security_invoker = true)
AS
SELECT
  s.id AS source_id,
  s.org_id,
  'stock_sale'::TEXT AS source_kind,
  COALESCE(NULLIF(s.party_name, ''), 'Named Stock Sale') AS source_label,
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
  s.created_at
FROM fabric_stock_sales s
JOIN fabric_stock_lots l ON l.id = s.stock_lot_id

UNION ALL

SELECT
  s.id AS source_id,
  s.org_id,
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
  s.created_at
FROM market_run_sales s
JOIN market_runs mr ON mr.id = s.market_run_id

UNION ALL

SELECT
  i.id AS source_id,
  i.org_id,
  'order_invoice'::TEXT AS source_kind,
  'Order Sale'::TEXT AS source_label,
  'realized'::TEXT AS stage,
  i.invoice_date AS event_date,
  COALESCE(o.quality_label, q.quality_label, 'Order') AS quality_label,
  (i.total_meters::TEXT || ' m') AS quantity_label,
  NULL::NUMERIC AS taka_count,
  i.total_meters AS meters_sold,
  i.rate_per_m AS price_per_meter,
  COALESCE(q.landed_cost_per_meter, 0) AS cost_per_meter,
  ROUND(i.total_meters * i.rate_per_m, 2) AS revenue_amount,
  ROUND(i.total_meters * COALESCE(q.landed_cost_per_meter, 0), 2) AS cost_amount,
  ROUND(i.total_meters * (i.rate_per_m - COALESCE(q.landed_cost_per_meter, 0)), 2) AS gross_profit_amount,
  COALESCE(i.invoice_number, o.party_name) AS reference,
  i.created_at
FROM party_invoices i
JOIN orders o ON o.id = i.order_id
LEFT JOIN LATERAL (
  SELECT q.*
  FROM estimator_quotes q
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
  'order_quote'::TEXT AS source_kind,
  'Expected Order Profit'::TEXT AS source_label,
  'expected'::TEXT AS stage,
  o.start_date AS event_date,
  COALESCE(o.quality_label, q.quality_label, 'Order') AS quality_label,
  (o.total_target_meters::TEXT || ' m') AS quantity_label,
  NULL::NUMERIC AS taka_count,
  o.total_target_meters AS meters_sold,
  q.quote_price_per_meter AS price_per_meter,
  q.landed_cost_per_meter AS cost_per_meter,
  ROUND(o.total_target_meters * q.quote_price_per_meter, 2) AS revenue_amount,
  ROUND(o.total_target_meters * q.landed_cost_per_meter, 2) AS cost_amount,
  ROUND(o.total_target_meters * (q.quote_price_per_meter - q.landed_cost_per_meter), 2) AS gross_profit_amount,
  COALESCE(o.party_name, q.party_name) AS reference,
  q.created_at
FROM estimator_quotes q
JOIN orders o ON o.id = q.order_id
WHERE NOT EXISTS (
  SELECT 1
  FROM party_invoices i
  WHERE i.order_id = o.id
    AND i.org_id = q.org_id
    AND i.status <> 'cancelled'
);
