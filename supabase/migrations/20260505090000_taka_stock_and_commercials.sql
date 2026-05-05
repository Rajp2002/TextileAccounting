-- ============================================================
-- MIGRATION: Phase 1 Taka Stock + Commercial Profit Summary
-- Adds a lightweight godown stock layer for fabric sold in takas,
-- anonymous stock sales, stock movements, and a unified gross
-- profit view for owner-facing commercials.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. FABRIC STOCK LOTS
-- ============================================================

CREATE TABLE IF NOT EXISTS fabric_stock_lots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quality_label         TEXT NOT NULL,
  godown                TEXT NOT NULL DEFAULT 'Main Godown',
  source_type           TEXT NOT NULL DEFAULT 'manual'
                          CHECK (source_type IN ('opening','market_run','order','manual','adjustment')),
  market_run_id         UUID REFERENCES market_runs(id) ON DELETE SET NULL,
  order_id              UUID REFERENCES orders(id) ON DELETE SET NULL,
  quote_id              UUID REFERENCES estimator_quotes(id) ON DELETE SET NULL,
  original_taka_count   NUMERIC(12,2) NOT NULL CHECK (original_taka_count >= 0),
  available_taka_count  NUMERIC(12,2) NOT NULL CHECK (available_taka_count >= 0),
  meters_per_taka       NUMERIC(12,2) NOT NULL CHECK (meters_per_taka > 0),
  cost_per_meter        NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (cost_per_meter >= 0),
  received_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fabric_stock_lots_available_within_original
    CHECK (available_taka_count <= original_taka_count)
);

CREATE INDEX IF NOT EXISTS idx_fabric_stock_lots_org_quality
  ON fabric_stock_lots(org_id, lower(quality_label), godown);

CREATE INDEX IF NOT EXISTS idx_fabric_stock_lots_org_available
  ON fabric_stock_lots(org_id, available_taka_count DESC)
  WHERE available_taka_count > 0;

CREATE INDEX IF NOT EXISTS idx_fabric_stock_lots_market_run
  ON fabric_stock_lots(market_run_id)
  WHERE market_run_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_fabric_stock_lots_updated_at ON fabric_stock_lots;
CREATE TRIGGER trg_fabric_stock_lots_updated_at
  BEFORE UPDATE ON fabric_stock_lots
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- 2. ANONYMOUS STOCK SALES
-- ============================================================

CREATE TABLE IF NOT EXISTS fabric_stock_sales (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stock_lot_id          UUID NOT NULL REFERENCES fabric_stock_lots(id) ON DELETE RESTRICT,
  sale_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  taka_sold             NUMERIC(12,2) NOT NULL CHECK (taka_sold > 0),
  meters_sold           NUMERIC(12,2) NOT NULL CHECK (meters_sold > 0),
  price_per_meter       NUMERIC(12,4) NOT NULL CHECK (price_per_meter >= 0),
  cost_per_meter        NUMERIC(12,4) NOT NULL CHECK (cost_per_meter >= 0),
  revenue_amount        NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(meters_sold * price_per_meter, 2)) STORED,
  cost_amount           NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(meters_sold * cost_per_meter, 2)) STORED,
  gross_profit_amount   NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(meters_sold * (price_per_meter - cost_per_meter), 2)) STORED,
  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fabric_stock_sales_org_date
  ON fabric_stock_sales(org_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_fabric_stock_sales_lot
  ON fabric_stock_sales(stock_lot_id, sale_date DESC);

-- ============================================================
-- 3. STOCK MOVEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS fabric_stock_movements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stock_lot_id          UUID NOT NULL REFERENCES fabric_stock_lots(id) ON DELETE CASCADE,
  sale_id               UUID REFERENCES fabric_stock_sales(id) ON DELETE SET NULL,
  movement_type         TEXT NOT NULL
                          CHECK (movement_type IN ('inward','sale','adjustment_add','adjustment_subtract')),
  movement_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  taka_delta            NUMERIC(12,2) NOT NULL,
  meters_delta          NUMERIC(12,2) NOT NULL,
  reference             TEXT,
  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fabric_stock_movements_lot
  ON fabric_stock_movements(stock_lot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fabric_stock_movements_org_date
  ON fabric_stock_movements(org_id, movement_date DESC);

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE fabric_stock_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabric_stock_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabric_stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fabric_stock_lots_owner_select"
  ON fabric_stock_lots FOR SELECT
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "fabric_stock_lots_owner_insert"
  ON fabric_stock_lots FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "fabric_stock_lots_owner_update"
  ON fabric_stock_lots FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "fabric_stock_sales_owner_select"
  ON fabric_stock_sales FOR SELECT
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "fabric_stock_sales_owner_insert"
  ON fabric_stock_sales FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "fabric_stock_movements_owner_select"
  ON fabric_stock_movements FOR SELECT
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "fabric_stock_movements_owner_insert"
  ON fabric_stock_movements FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- ============================================================
-- 5. ATOMIC SALE RPC
-- ============================================================

CREATE OR REPLACE FUNCTION record_fabric_stock_sale(
  p_stock_lot_id      UUID,
  p_taka_sold         NUMERIC,
  p_price_per_meter   NUMERIC,
  p_sale_date         DATE,
  p_notes             TEXT
)
RETURNS TABLE (
  sale_id             UUID,
  meters_sold         NUMERIC,
  revenue_amount      NUMERIC,
  gross_profit_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id       UUID;
  v_role         TEXT;
  v_lot          fabric_stock_lots%ROWTYPE;
  v_sale_id      UUID;
  v_meters_sold  NUMERIC;
  v_revenue      NUMERIC;
  v_profit       NUMERIC;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  v_role   := auth.jwt() ->> 'user_role';

  IF v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can record stock sales';
  END IF;

  IF p_taka_sold <= 0 THEN
    RAISE EXCEPTION 'Takas sold must be greater than zero';
  END IF;

  IF p_price_per_meter < 0 THEN
    RAISE EXCEPTION 'Sale price cannot be negative';
  END IF;

  SELECT *
    INTO v_lot
  FROM fabric_stock_lots
  WHERE id = p_stock_lot_id
    AND org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock lot not found';
  END IF;

  IF p_taka_sold > v_lot.available_taka_count THEN
    RAISE EXCEPTION 'Cannot sell % taka — only % taka available',
      p_taka_sold, v_lot.available_taka_count;
  END IF;

  v_meters_sold := ROUND(p_taka_sold * v_lot.meters_per_taka, 2);

  INSERT INTO fabric_stock_sales (
    org_id,
    stock_lot_id,
    sale_date,
    taka_sold,
    meters_sold,
    price_per_meter,
    cost_per_meter,
    notes,
    created_by
  ) VALUES (
    v_org_id,
    p_stock_lot_id,
    COALESCE(p_sale_date, CURRENT_DATE),
    p_taka_sold,
    v_meters_sold,
    p_price_per_meter,
    v_lot.cost_per_meter,
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    auth.uid()
  )
  RETURNING id, revenue_amount, gross_profit_amount
  INTO v_sale_id, v_revenue, v_profit;

  UPDATE fabric_stock_lots
  SET available_taka_count = available_taka_count - p_taka_sold
  WHERE id = p_stock_lot_id;

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
    p_stock_lot_id,
    v_sale_id,
    'sale',
    COALESCE(p_sale_date, CURRENT_DATE),
    -p_taka_sold,
    -v_meters_sold,
    'Stock sale',
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    auth.uid()
  );

  RETURN QUERY SELECT v_sale_id, v_meters_sold, v_revenue, v_profit;
END;
$$;

GRANT EXECUTE ON FUNCTION record_fabric_stock_sale(UUID, NUMERIC, NUMERIC, DATE, TEXT)
  TO authenticated, service_role;

-- ============================================================
-- 6. ATOMIC ADJUSTMENT RPC
-- ============================================================

CREATE OR REPLACE FUNCTION adjust_fabric_stock_lot(
  p_stock_lot_id      UUID,
  p_adjustment_mode   TEXT,
  p_taka_count        NUMERIC,
  p_notes             TEXT
)
RETURNS TABLE (
  stock_lot_id        UUID,
  available_taka      NUMERIC,
  available_meters    NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id       UUID;
  v_role         TEXT;
  v_lot          fabric_stock_lots%ROWTYPE;
  v_delta_taka   NUMERIC;
  v_delta_meters NUMERIC;
  v_next_taka    NUMERIC;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  v_role   := auth.jwt() ->> 'user_role';

  IF v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can adjust stock';
  END IF;

  IF p_adjustment_mode NOT IN ('add', 'subtract') THEN
    RAISE EXCEPTION 'Invalid adjustment mode';
  END IF;

  IF p_taka_count <= 0 THEN
    RAISE EXCEPTION 'Taka count must be greater than zero';
  END IF;

  SELECT *
    INTO v_lot
  FROM fabric_stock_lots
  WHERE id = p_stock_lot_id
    AND org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock lot not found';
  END IF;

  v_delta_taka := CASE WHEN p_adjustment_mode = 'add' THEN p_taka_count ELSE -p_taka_count END;
  v_delta_meters := ROUND(v_delta_taka * v_lot.meters_per_taka, 2);
  v_next_taka := v_lot.available_taka_count + v_delta_taka;

  IF v_next_taka < 0 THEN
    RAISE EXCEPTION 'Cannot subtract % taka — only % taka available',
      p_taka_count, v_lot.available_taka_count;
  END IF;

  UPDATE fabric_stock_lots
  SET
    available_taka_count = v_next_taka,
    original_taka_count = CASE
      WHEN p_adjustment_mode = 'add' THEN original_taka_count + p_taka_count
      ELSE original_taka_count
    END
  WHERE id = p_stock_lot_id;

  INSERT INTO fabric_stock_movements (
    org_id,
    stock_lot_id,
    movement_type,
    movement_date,
    taka_delta,
    meters_delta,
    reference,
    notes,
    created_by
  ) VALUES (
    v_org_id,
    p_stock_lot_id,
    CASE WHEN p_adjustment_mode = 'add' THEN 'adjustment_add' ELSE 'adjustment_subtract' END,
    CURRENT_DATE,
    v_delta_taka,
    v_delta_meters,
    'Manual adjustment',
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    auth.uid()
  );

  RETURN QUERY
  SELECT p_stock_lot_id, v_next_taka, ROUND(v_next_taka * v_lot.meters_per_taka, 2);
END;
$$;

GRANT EXECUTE ON FUNCTION adjust_fabric_stock_lot(UUID, TEXT, NUMERIC, TEXT)
  TO authenticated, service_role;

-- ============================================================
-- 7. STOCK SUMMARY VIEW
-- ============================================================

CREATE OR REPLACE VIEW fabric_stock_lot_summary
WITH (security_invoker = true)
AS
SELECT
  l.id AS stock_lot_id,
  l.org_id,
  l.quality_label,
  l.godown,
  l.source_type,
  l.market_run_id,
  l.order_id,
  l.quote_id,
  l.original_taka_count,
  l.available_taka_count,
  ROUND(l.original_taka_count * l.meters_per_taka, 2) AS original_meters,
  ROUND(l.available_taka_count * l.meters_per_taka, 2) AS available_meters,
  l.meters_per_taka,
  l.cost_per_meter,
  l.received_date,
  l.notes,
  l.created_at,
  l.updated_at,
  COALESCE(SUM(s.taka_sold), 0) AS sold_taka_count,
  COALESCE(SUM(s.meters_sold), 0) AS sold_meters,
  COALESCE(SUM(s.revenue_amount), 0) AS total_revenue,
  COALESCE(SUM(s.cost_amount), 0) AS total_cost_on_sold,
  COALESCE(SUM(s.gross_profit_amount), 0) AS total_gross_profit,
  CASE
    WHEN l.available_taka_count = 0 THEN 'sold_out'
    WHEN COALESCE(SUM(s.taka_sold), 0) > 0 THEN 'partially_sold'
    ELSE 'available'
  END AS stock_status
FROM fabric_stock_lots l
LEFT JOIN fabric_stock_sales s ON s.stock_lot_id = l.id
GROUP BY l.id;

-- ============================================================
-- 8. COMMERCIAL PROFIT VIEW
-- ============================================================

CREATE OR REPLACE VIEW commercial_profit_entries
WITH (security_invoker = true)
AS
-- Anonymous taka stock sales
SELECT
  s.id AS source_id,
  s.org_id,
  'stock_sale'::TEXT AS source_kind,
  CASE
    WHEN l.source_type = 'market_run' THEN 'Market Run Stock Sale'
    WHEN l.source_type = 'order' THEN 'Order Stock Sale'
    ELSE 'Stock Sale'
  END AS source_label,
  'realized'::TEXT AS stage,
  s.sale_date AS event_date,
  l.quality_label,
  (s.taka_sold::TEXT || ' taka') AS quantity_label,
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

-- Existing market-run sales that went through the ledger/trader flow
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

-- Realized order invoices, costed from the linked estimator quote
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

-- ============================================================
-- 9. REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE fabric_stock_lots;
ALTER PUBLICATION supabase_realtime ADD TABLE fabric_stock_sales;
ALTER PUBLICATION supabase_realtime ADD TABLE fabric_stock_movements;
