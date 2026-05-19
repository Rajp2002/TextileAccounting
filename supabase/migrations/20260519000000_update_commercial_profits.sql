-- Recreate the commercial_profit_entries view with mathematically corrected dynamic selling cost calculations.
-- 1. Order Invoices: commission and landed cost are dynamically calculated from the actual invoice rate per meter.
-- 2. Expected Order Quotes: commission and landed cost are calculated from the quoted price per meter.
-- 3. Stock Sales: kept purely as Manufacturing Gross Profit without quote joins.

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

-- Realized order invoices, costed dynamically using actual invoice rates
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
  -- Dynamic landed cost per meter = P + T + commission (based on actual rate)
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

-- Expected order profit from accepted/converted quotes when no invoice exists yet
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
  -- Landed cost per meter = P + T + commission (based on quote price)
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
