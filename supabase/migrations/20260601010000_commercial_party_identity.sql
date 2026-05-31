-- Lightweight party identity for active Commercials workflows.
-- Keeps /owner/ledger deferred while letting stock sales and Commercials
-- aggregate repeat business by a persistent party record.

ALTER TABLE fabric_stock_sales
  ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id) ON DELETE SET NULL;

ALTER TABLE commercial_receivables
  ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS idx_parties_org_name_active;

CREATE INDEX IF NOT EXISTS idx_parties_org_active_name_search
  ON parties(org_id, LOWER(BTRIM(name)))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_parties_org_active_gstin_search
  ON parties(org_id, UPPER(BTRIM(gstin)))
  WHERE is_active = true
    AND NULLIF(BTRIM(gstin), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parties_org_active_phone_search
  ON parties(org_id, BTRIM(phone))
  WHERE is_active = true
    AND NULLIF(BTRIM(phone), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fabric_stock_sales_org_party_date
  ON fabric_stock_sales(org_id, party_id, sale_date DESC)
  WHERE party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commercial_receivables_org_party_id
  ON commercial_receivables(org_id, party_id)
  WHERE party_id IS NOT NULL;

WITH unique_name_parties AS (
  SELECT
    p.org_id,
    LOWER(BTRIM(p.name)) AS normalized_name,
    MIN(p.id) AS party_id
  FROM parties p
  WHERE p.is_active = true
  GROUP BY p.org_id, LOWER(BTRIM(p.name))
  HAVING COUNT(*) = 1
)
UPDATE fabric_stock_sales s
SET party_id = u.party_id
FROM unique_name_parties u
WHERE s.party_id IS NULL
  AND s.org_id = u.org_id
  AND NULLIF(BTRIM(s.party_name), '') IS NOT NULL
  AND u.normalized_name = LOWER(BTRIM(s.party_name));

UPDATE commercial_receivables cr
SET party_id = fss.party_id
FROM fabric_stock_sales fss
WHERE cr.party_id IS NULL
  AND cr.source_type = 'fabric_stock_sale'
  AND cr.source_id = fss.id
  AND fss.org_id = cr.org_id
  AND fss.party_id IS NOT NULL;

WITH unique_name_parties AS (
  SELECT
    p.org_id,
    LOWER(BTRIM(p.name)) AS normalized_name,
    MIN(p.id) AS party_id
  FROM parties p
  WHERE p.is_active = true
  GROUP BY p.org_id, LOWER(BTRIM(p.name))
  HAVING COUNT(*) = 1
)
UPDATE commercial_receivables cr
SET party_id = u.party_id
FROM unique_name_parties u
WHERE cr.party_id IS NULL
  AND cr.org_id = u.org_id
  AND NULLIF(BTRIM(cr.party_name), '') IS NOT NULL
  AND u.normalized_name = LOWER(BTRIM(cr.party_name));

DROP FUNCTION IF EXISTS create_party_stock_sale_dispatch_v1(
  TEXT,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  INTEGER,
  DATE,
  BOOLEAN,
  NUMERIC,
  DATE,
  TEXT,
  TEXT,
  TEXT,
  TEXT
);

DROP FUNCTION IF EXISTS create_party_stock_sale_dispatch_v1(
  TEXT,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  INTEGER,
  DATE,
  BOOLEAN,
  NUMERIC,
  DATE,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
);

CREATE OR REPLACE FUNCTION create_party_stock_sale_dispatch_v1(
  p_source_type TEXT,
  p_source_id UUID,
  p_party_name TEXT,
  p_party_phone TEXT,
  p_party_city TEXT,
  p_party_gstin TEXT,
  p_sold_meters NUMERIC,
  p_sold_takas NUMERIC,
  p_sale_rate_per_meter NUMERIC,
  p_credit_days INTEGER,
  p_sale_date DATE,
  p_dispatch_now BOOLEAN,
  p_actual_dispatched_meters NUMERIC,
  p_dispatch_date DATE,
  p_transport_name TEXT,
  p_vehicle_number TEXT,
  p_challan_number TEXT,
  p_notes TEXT,
  p_party_id UUID DEFAULT NULL
)
RETURNS TABLE (
  sale_id UUID,
  dispatch_id UUID,
  dispatch_number INTEGER,
  dispatch_status TEXT,
  pending_dispatch_meters NUMERIC,
  receivable_id UUID,
  party_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_role TEXT;
  v_lot RECORD;
  v_sale RECORD;
  v_dispatch_id UUID;
  v_dispatch_number INTEGER;
  v_dispatch_status TEXT;
  v_pending_dispatch_meters NUMERIC;
  v_actual_dispatched_meters NUMERIC;
  v_due_date DATE;
  v_sale_takas NUMERIC;
  v_gst_amount NUMERIC;
  v_receivable_id UUID;
  v_party RECORD;
  v_party_id UUID;
  v_resolved_party_name TEXT;
  v_resolved_party_phone TEXT;
  v_resolved_party_city TEXT;
  v_resolved_party_gstin TEXT;
  v_exact_party_count INTEGER := 0;
  v_has_distinguishing_contact BOOLEAN := false;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  v_user_id := auth.uid();
  v_role := auth.jwt() ->> 'user_role';

  IF v_org_id IS NULL OR v_user_id IS NULL OR v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can create party stock sales';
  END IF;

  IF p_source_id IS NULL OR COALESCE(btrim(p_source_type), '') = '' THEN
    RAISE EXCEPTION 'Source stock is required';
  END IF;

  IF p_party_id IS NULL AND COALESCE(btrim(p_party_name), '') = '' THEN
    RAISE EXCEPTION 'Party name is required';
  END IF;

  IF p_party_id IS NOT NULL THEN
    SELECT p.*
      INTO v_party
    FROM parties p
    WHERE p.id = p_party_id
      AND p.org_id = v_org_id
      AND p.is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected party was not found';
    END IF;

    v_party_id := v_party.id;
  END IF;

  v_has_distinguishing_contact :=
    COALESCE(btrim(COALESCE(p_party_phone, '')), '') <> ''
    OR COALESCE(btrim(COALESCE(p_party_gstin, '')), '') <> '';

  IF v_party_id IS NULL AND COALESCE(btrim(p_party_name), '') <> '' THEN
    IF COALESCE(btrim(COALESCE(p_party_gstin, '')), '') <> '' THEN
      SELECT p.*
        INTO v_party
      FROM parties p
      WHERE p.org_id = v_org_id
        AND p.is_active = true
        AND LOWER(BTRIM(p.name)) = LOWER(BTRIM(p_party_name))
        AND UPPER(BTRIM(COALESCE(p.gstin, ''))) = UPPER(BTRIM(p_party_gstin))
      LIMIT 1;

      IF FOUND THEN
        v_party_id := v_party.id;
      END IF;
    END IF;
  END IF;

  IF v_party_id IS NULL AND COALESCE(btrim(p_party_name), '') <> '' THEN
    IF COALESCE(btrim(COALESCE(p_party_phone, '')), '') <> '' THEN
      SELECT p.*
        INTO v_party
      FROM parties p
      WHERE p.org_id = v_org_id
        AND p.is_active = true
        AND LOWER(BTRIM(p.name)) = LOWER(BTRIM(p_party_name))
        AND BTRIM(COALESCE(p.phone, '')) = BTRIM(p_party_phone)
      LIMIT 1;

      IF FOUND THEN
        v_party_id := v_party.id;
      END IF;
    END IF;
  END IF;

  IF v_party_id IS NULL AND COALESCE(btrim(p_party_name), '') <> '' THEN
    SELECT COUNT(*)
      INTO v_exact_party_count
    FROM parties p
    WHERE p.org_id = v_org_id
      AND p.is_active = true
      AND LOWER(BTRIM(p.name)) = LOWER(BTRIM(p_party_name));

    IF v_exact_party_count = 1 AND NOT v_has_distinguishing_contact THEN
      SELECT p.*
        INTO v_party
      FROM parties p
      WHERE p.org_id = v_org_id
        AND p.is_active = true
        AND LOWER(BTRIM(p.name)) = LOWER(BTRIM(p_party_name))
      LIMIT 1;

      v_party_id := v_party.id;
    ELSIF v_exact_party_count > 1 AND NOT v_has_distinguishing_contact THEN
      RAISE EXCEPTION 'Multiple saved parties share this name. Select the correct party or add phone/GSTIN to create a new one.';
    END IF;
  END IF;

  IF v_party_id IS NULL AND COALESCE(btrim(p_party_name), '') <> '' THEN
    INSERT INTO parties (
      org_id,
      name,
      phone,
      gstin,
      default_credit_days
    ) VALUES (
      v_org_id,
      NULLIF(btrim(p_party_name), ''),
      NULLIF(btrim(COALESCE(p_party_phone, '')), ''),
      NULLIF(btrim(COALESCE(p_party_gstin, '')), ''),
      LEAST(GREATEST(COALESCE(p_credit_days, 30), 0), 365)
    )
    RETURNING *
    INTO v_party;

    v_party_id := v_party.id;
  END IF;

  v_resolved_party_name := COALESCE(NULLIF(btrim(v_party.name), ''), NULLIF(btrim(p_party_name), ''));
  IF COALESCE(v_resolved_party_name, '') = '' THEN
    RAISE EXCEPTION 'Party name is required';
  END IF;

  v_resolved_party_phone := COALESCE(NULLIF(btrim(COALESCE(p_party_phone, '')), ''), NULLIF(btrim(COALESCE(v_party.phone, '')), ''));
  v_resolved_party_city := NULLIF(btrim(COALESCE(p_party_city, '')), '');
  v_resolved_party_gstin := COALESCE(NULLIF(btrim(COALESCE(p_party_gstin, '')), ''), NULLIF(btrim(COALESCE(v_party.gstin, '')), ''));

  IF p_sold_meters IS NULL OR p_sold_meters <= 0 THEN
    RAISE EXCEPTION 'Sold meters must be greater than 0';
  END IF;

  IF p_sale_rate_per_meter IS NULL OR p_sale_rate_per_meter <= 0 THEN
    RAISE EXCEPTION 'Sale rate must be greater than 0';
  END IF;

  IF COALESCE(p_credit_days, 0) < 0 THEN
    RAISE EXCEPTION 'Credit days cannot be negative';
  END IF;

  IF p_sold_takas IS NOT NULL AND p_sold_takas <= 0 THEN
    RAISE EXCEPTION 'Sold takas must be greater than 0 when provided';
  END IF;

  v_actual_dispatched_meters := CASE WHEN p_dispatch_now THEN COALESCE(p_actual_dispatched_meters, 0) ELSE 0 END;

  IF p_dispatch_now AND (v_actual_dispatched_meters <= 0 OR v_actual_dispatched_meters > p_sold_meters) THEN
    RAISE EXCEPTION 'Dispatched meters must be greater than 0 and not more than sold meters';
  END IF;

  v_pending_dispatch_meters := GREATEST(p_sold_meters - v_actual_dispatched_meters, 0);
  v_dispatch_status := CASE
    WHEN NOT p_dispatch_now THEN 'not_dispatched'
    WHEN v_actual_dispatched_meters + 0.01 < p_sold_meters THEN 'partially_dispatched'
    ELSE 'dispatched'
  END;

  IF p_dispatch_now THEN
    v_due_date := p_dispatch_date + COALESCE(p_credit_days, 0);
  ELSE
    v_due_date := NULL;
  END IF;

  UPDATE fabric_stock_lots
  SET
    available_meters = available_meters - p_sold_meters,
    available_taka_count = CASE
      WHEN p_sold_takas IS NULL THEN available_taka_count
      ELSE available_taka_count - p_sold_takas
    END
  WHERE id = p_source_id
    AND org_id = v_org_id
    AND available_meters >= p_sold_meters
    AND (p_sold_takas IS NULL OR available_taka_count >= p_sold_takas)
  RETURNING *
  INTO v_lot;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot sell more than available stock';
  END IF;

  IF v_lot.cost_per_meter IS NULL OR v_lot.cost_per_meter < 0 THEN
    RAISE EXCEPTION 'Cost per meter snapshot is required';
  END IF;

  v_sale_takas := COALESCE(p_sold_takas, ROUND(p_sold_meters / GREATEST(v_lot.meters_per_taka, 0.0001), 2));

  INSERT INTO fabric_stock_sales (
    org_id,
    stock_lot_id,
    sale_date,
    taka_sold,
    meters_sold,
    price_per_meter,
    cost_per_meter,
    party_id,
    party_name,
    party_phone,
    party_city,
    party_gstin,
    credit_days,
    due_date,
    dispatch_status,
    dispatched_meters,
    pending_dispatch_meters,
    dispatch_date,
    transport_name,
    vehicle_number,
    challan_number,
    notes,
    created_by
  ) VALUES (
    v_org_id,
    p_source_id,
    p_sale_date,
    v_sale_takas,
    p_sold_meters,
    p_sale_rate_per_meter,
    v_lot.cost_per_meter,
    v_party_id,
    v_resolved_party_name,
    v_resolved_party_phone,
    v_resolved_party_city,
    v_resolved_party_gstin,
    COALESCE(p_credit_days, 0),
    v_due_date,
    v_dispatch_status,
    v_actual_dispatched_meters,
    v_pending_dispatch_meters,
    CASE WHEN p_dispatch_now THEN p_dispatch_date ELSE NULL END,
    NULLIF(btrim(COALESCE(p_transport_name, '')), ''),
    NULLIF(btrim(COALESCE(p_vehicle_number, '')), ''),
    NULLIF(btrim(COALESCE(p_challan_number, '')), ''),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    v_user_id
  )
  RETURNING *
  INTO v_sale;

  INSERT INTO fabric_stock_movements (
    org_id,
    stock_lot_id,
    sale_id,
    movement_type,
    movement_date,
    taka_delta,
    meters_delta,
    reference,
    notes,
    created_by
  ) VALUES (
    v_org_id,
    p_source_id,
    v_sale.id,
    'sale',
    p_sale_date,
    -v_sale_takas,
    -p_sold_meters,
    'Sale to ' || v_resolved_party_name,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    v_user_id
  );

  IF p_dispatch_now THEN
    SELECT COALESCE(MAX(d.dispatch_number), 0) + 1
      INTO v_dispatch_number
    FROM dispatches d
    WHERE d.org_id = v_org_id
      AND d.order_id IS NULL;

    v_gst_amount := ROUND((p_sold_meters * p_sale_rate_per_meter) * 5 / 100, 2);

    INSERT INTO dispatches (
      org_id,
      order_id,
      stock_sale_id,
      dispatch_number,
      qty_meters_sent,
      status,
      notes,
      dispatched_at,
      created_by,
      taxable_value,
      gst_percent,
      cgst_amount,
      sgst_amount,
      igst_amount,
      total_invoice_value,
      eway_bill_required,
      vehicle_number,
      transporter_name,
      party_name,
      party_phone,
      party_city,
      challan_number
    ) VALUES (
      v_org_id,
      NULL,
      v_sale.id,
      v_dispatch_number,
      v_actual_dispatched_meters,
      'in_transit',
      NULLIF(btrim(COALESCE(p_notes, '')), ''),
      p_dispatch_date::timestamptz,
      v_user_id,
      ROUND(p_sold_meters * p_sale_rate_per_meter, 2),
      5,
      ROUND(v_gst_amount / 2, 2),
      ROUND(v_gst_amount / 2, 2),
      0,
      ROUND(p_sold_meters * p_sale_rate_per_meter, 2) + v_gst_amount,
      ROUND(p_sold_meters * p_sale_rate_per_meter, 2) + v_gst_amount > 50000,
      NULLIF(btrim(COALESCE(p_vehicle_number, '')), ''),
      NULLIF(btrim(COALESCE(p_transport_name, '')), ''),
      v_resolved_party_name,
      v_resolved_party_phone,
      v_resolved_party_city,
      NULLIF(btrim(COALESCE(p_challan_number, '')), '')
    )
    RETURNING id INTO v_dispatch_id;

    UPDATE fabric_stock_sales
    SET dispatch_id = v_dispatch_id
    WHERE id = v_sale.id
      AND org_id = v_org_id;
  END IF;

  INSERT INTO commercial_receivables (
    org_id,
    source_type,
    source_id,
    source_date,
    order_id,
    dispatch_id,
    party_id,
    party_name,
    quality_label,
    total_amount,
    payment_status,
    credit_days,
    due_date,
    created_by,
    updated_by
  ) VALUES (
    v_org_id,
    'fabric_stock_sale',
    v_sale.id,
    p_sale_date,
    v_lot.order_id,
    v_dispatch_id,
    v_party_id,
    v_resolved_party_name,
    v_lot.quality_label,
    v_sale.revenue_amount,
    'unpaid',
    COALESCE(p_credit_days, 0),
    v_due_date,
    v_user_id,
    v_user_id
  )
  ON CONFLICT (org_id, source_type, source_id)
  DO UPDATE SET
    dispatch_id = EXCLUDED.dispatch_id,
    party_id = EXCLUDED.party_id,
    party_name = EXCLUDED.party_name,
    quality_label = EXCLUDED.quality_label,
    total_amount = EXCLUDED.total_amount,
    credit_days = EXCLUDED.credit_days,
    due_date = EXCLUDED.due_date,
    updated_by = EXCLUDED.updated_by
  RETURNING id INTO v_receivable_id;

  RETURN QUERY
  SELECT
    v_sale.id,
    v_dispatch_id,
    v_dispatch_number,
    v_dispatch_status,
    v_pending_dispatch_meters,
    v_receivable_id,
    v_party_id;
END;
$$;

DROP VIEW IF EXISTS commercial_profit_entries;

CREATE OR REPLACE VIEW commercial_profit_entries
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
  s.created_at
FROM fabric_stock_sales s
JOIN fabric_stock_lots l ON l.id = s.stock_lot_id
LEFT JOIN parties p ON p.id = s.party_id

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
  s.created_at
FROM market_run_sales s
JOIN market_runs mr ON mr.id = s.market_run_id
LEFT JOIN parties p ON p.id = s.party_id

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
  i.created_at
FROM party_invoices i
JOIN orders o ON o.id = i.order_id
LEFT JOIN parties p ON p.id = COALESCE(i.party_id, o.party_id)
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
  q.created_at
FROM estimator_quotes q
JOIN orders o ON o.id = q.order_id
LEFT JOIN parties p ON p.id = o.party_id
WHERE NOT EXISTS (
  SELECT 1
  FROM party_invoices i
  WHERE i.order_id = o.id
    AND i.org_id = q.org_id
    AND i.status <> 'cancelled'
);

GRANT SELECT ON commercial_profit_entries TO authenticated;
