-- ============================================================
-- MIGRATION: Rolling Stock Inward From Production
-- Tracks shift-wise produced fabric as pending godown inward,
-- then confirms it into costed stock lots for sales/dispatch.
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stock_meters_per_unit NUMERIC(12,2) NOT NULL DEFAULT 50 CHECK (stock_meters_per_unit > 0),
  ADD COLUMN IF NOT EXISTS stock_unit_label TEXT NOT NULL DEFAULT 'taka',
  ADD COLUMN IF NOT EXISTS default_godown TEXT NOT NULL DEFAULT 'Main Godown',
  ADD COLUMN IF NOT EXISTS dispatch_batch_meters NUMERIC(12,2) CHECK (dispatch_batch_meters IS NULL OR dispatch_batch_meters > 0);

ALTER TABLE market_runs
  ADD COLUMN IF NOT EXISTS stock_meters_per_unit NUMERIC(12,2) NOT NULL DEFAULT 50 CHECK (stock_meters_per_unit > 0),
  ADD COLUMN IF NOT EXISTS stock_unit_label TEXT NOT NULL DEFAULT 'taka',
  ADD COLUMN IF NOT EXISTS default_godown TEXT NOT NULL DEFAULT 'Main Godown';

ALTER TABLE fabric_stock_lots
  ADD COLUMN IF NOT EXISTS unit_label TEXT NOT NULL DEFAULT 'taka',
  ADD COLUMN IF NOT EXISTS original_meters NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS available_meters NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS stock_purpose TEXT NOT NULL DEFAULT 'manual'
    CHECK (stock_purpose IN ('sellable','order_reserved','manual')),
  ADD COLUMN IF NOT EXISTS source_date DATE,
  ADD COLUMN IF NOT EXISTS source_shift TEXT CHECK (source_shift IN ('day','night'));

UPDATE fabric_stock_lots
SET
  original_meters = COALESCE(original_meters, ROUND(original_taka_count * meters_per_taka, 2)),
  available_meters = COALESCE(available_meters, ROUND(available_taka_count * meters_per_taka, 2)),
  stock_purpose = CASE
    WHEN source_type = 'market_run' THEN 'sellable'
    WHEN source_type = 'order' THEN 'order_reserved'
    ELSE stock_purpose
  END
WHERE original_meters IS NULL OR available_meters IS NULL;

ALTER TABLE fabric_stock_lots
  ALTER COLUMN original_meters SET NOT NULL,
  ALTER COLUMN available_meters SET NOT NULL;

ALTER TABLE fabric_stock_lots
  DROP CONSTRAINT IF EXISTS fabric_stock_lots_available_meters_within_original,
  ADD CONSTRAINT fabric_stock_lots_available_meters_within_original
    CHECK (available_meters >= 0 AND available_meters <= original_meters);

CREATE INDEX IF NOT EXISTS idx_fabric_stock_lots_org_purpose
  ON fabric_stock_lots(org_id, stock_purpose, available_meters DESC)
  WHERE available_meters > 0;

CREATE INDEX IF NOT EXISTS idx_fabric_stock_lots_order_source_shift
  ON fabric_stock_lots(order_id, source_date, source_shift)
  WHERE order_id IS NOT NULL;

-- ============================================================
-- Pending inward drafts
-- ============================================================

CREATE TABLE IF NOT EXISTS fabric_stock_inward_drafts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_type           TEXT NOT NULL CHECK (source_type IN ('market_run','order')),
  market_run_id         UUID REFERENCES market_runs(id) ON DELETE SET NULL,
  order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  quote_id              UUID REFERENCES estimator_quotes(id) ON DELETE SET NULL,
  quality_label         TEXT NOT NULL,
  source_date           DATE NOT NULL,
  source_shift          TEXT NOT NULL CHECK (source_shift IN ('day','night')),
  suggested_meters      NUMERIC(12,2) NOT NULL CHECK (suggested_meters > 0),
  suggested_unit_count  NUMERIC(12,2) NOT NULL CHECK (suggested_unit_count > 0),
  meters_per_unit       NUMERIC(12,2) NOT NULL CHECK (meters_per_unit > 0),
  unit_label            TEXT NOT NULL DEFAULT 'taka',
  cost_per_meter        NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (cost_per_meter >= 0),
  suggested_godown      TEXT NOT NULL DEFAULT 'Main Godown',
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','confirmed','dismissed')),
  confirmed_stock_lot_id UUID REFERENCES fabric_stock_lots(id) ON DELETE SET NULL,
  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  confirmed_by          UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at          TIMESTAMPTZ,
  UNIQUE (org_id, order_id, source_date, source_shift)
);

CREATE INDEX IF NOT EXISTS idx_fabric_stock_inward_drafts_org_status
  ON fabric_stock_inward_drafts(org_id, status, source_date DESC);

DROP TRIGGER IF EXISTS trg_fabric_stock_inward_drafts_updated_at ON fabric_stock_inward_drafts;
CREATE TRIGGER trg_fabric_stock_inward_drafts_updated_at
  BEFORE UPDATE ON fabric_stock_inward_drafts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE fabric_stock_inward_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fabric_stock_inward_drafts_org_select"
  ON fabric_stock_inward_drafts FOR SELECT
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner','supervisor')
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "fabric_stock_inward_drafts_owner_insert"
  ON fabric_stock_inward_drafts FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner','supervisor')
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY "fabric_stock_inward_drafts_owner_update"
  ON fabric_stock_inward_drafts FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- ============================================================
-- Generate/refresh pending inward from one order shift
-- ============================================================

CREATE OR REPLACE FUNCTION create_or_refresh_stock_inward_draft(
  p_order_id UUID,
  p_source_date DATE,
  p_source_shift TEXT
)
RETURNS TABLE (
  draft_id UUID,
  suggested_meters NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_role TEXT;
  v_order RECORD;
  v_quote RECORD;
  v_market_run RECORD;
  v_meters NUMERIC;
  v_source_type TEXT;
  v_quality_label TEXT;
  v_cost_per_meter NUMERIC := 0;
  v_quote_id UUID;
  v_meters_per_unit NUMERIC;
  v_unit_label TEXT;
  v_godown TEXT;
  v_draft_id UUID;
  v_status TEXT;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  v_role := auth.jwt() ->> 'user_role';

  IF v_role NOT IN ('owner','supervisor') THEN
    RAISE EXCEPTION 'Only owners or supervisors can prepare stock inward';
  END IF;

  IF p_source_shift NOT IN ('day','night') THEN
    RAISE EXCEPTION 'Invalid shift';
  END IF;

  SELECT
    o.id,
    o.org_id,
    o.market_run_id,
    o.quality_label,
    o.party_name,
    o.stock_meters_per_unit,
    o.stock_unit_label,
    o.default_godown
  INTO v_order
  FROM orders o
  WHERE o.id = p_order_id
    AND o.org_id = v_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT ROUND(COALESCE(SUM(pl.meters), 0), 2)
    INTO v_meters
  FROM production_logs pl
  WHERE pl.org_id = v_org_id
    AND pl.order_id = p_order_id
    AND pl.date = p_source_date
    AND pl.shift = p_source_shift;

  IF v_meters <= 0 THEN
    RETURN;
  END IF;

  v_source_type := CASE WHEN v_order.market_run_id IS NOT NULL THEN 'market_run' ELSE 'order' END;
  v_quality_label := COALESCE(NULLIF(BTRIM(v_order.quality_label), ''), NULLIF(BTRIM(v_order.party_name), ''), 'Produced Fabric');
  v_meters_per_unit := v_order.stock_meters_per_unit;
  v_unit_label := COALESCE(NULLIF(BTRIM(v_order.stock_unit_label), ''), 'taka');
  v_godown := COALESCE(NULLIF(BTRIM(v_order.default_godown), ''), 'Main Godown');

  IF v_order.market_run_id IS NOT NULL THEN
    SELECT mr.cost_per_meter, mr.stock_meters_per_unit, mr.stock_unit_label, mr.default_godown
      INTO v_market_run
    FROM market_runs mr
    WHERE mr.id = v_order.market_run_id
      AND mr.org_id = v_org_id;

    IF FOUND THEN
      v_cost_per_meter := COALESCE(v_market_run.cost_per_meter, 0);
      v_meters_per_unit := COALESCE(v_market_run.stock_meters_per_unit, v_meters_per_unit);
      v_unit_label := COALESCE(NULLIF(BTRIM(v_market_run.stock_unit_label), ''), v_unit_label);
      v_godown := COALESCE(NULLIF(BTRIM(v_market_run.default_godown), ''), v_godown);
    END IF;
  ELSE
    SELECT q.id, q.landed_cost_per_meter
      INTO v_quote
    FROM estimator_quotes q
    WHERE q.order_id = p_order_id
      AND q.org_id = v_org_id
    ORDER BY q.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_quote_id := v_quote.id;
      v_cost_per_meter := COALESCE(v_quote.landed_cost_per_meter, 0);
    END IF;
  END IF;

  INSERT INTO fabric_stock_inward_drafts (
    org_id,
    source_type,
    market_run_id,
    order_id,
    quote_id,
    quality_label,
    source_date,
    source_shift,
    suggested_meters,
    suggested_unit_count,
    meters_per_unit,
    unit_label,
    cost_per_meter,
    suggested_godown,
    created_by
  ) VALUES (
    v_org_id,
    v_source_type,
    v_order.market_run_id,
    p_order_id,
    CASE WHEN v_source_type = 'order' THEN v_quote_id ELSE NULL END,
    v_quality_label,
    p_source_date,
    p_source_shift,
    v_meters,
    ROUND(v_meters / v_meters_per_unit, 2),
    v_meters_per_unit,
    v_unit_label,
    v_cost_per_meter,
    v_godown,
    auth.uid()
  )
  ON CONFLICT (org_id, order_id, source_date, source_shift)
  DO UPDATE SET
    suggested_meters = EXCLUDED.suggested_meters,
    suggested_unit_count = EXCLUDED.suggested_unit_count,
    meters_per_unit = EXCLUDED.meters_per_unit,
    unit_label = EXCLUDED.unit_label,
    cost_per_meter = EXCLUDED.cost_per_meter,
    suggested_godown = EXCLUDED.suggested_godown,
    updated_at = NOW()
  WHERE fabric_stock_inward_drafts.status = 'pending'
  RETURNING id, fabric_stock_inward_drafts.status
  INTO v_draft_id, v_status;

  RETURN QUERY SELECT v_draft_id, v_meters, v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION create_or_refresh_stock_inward_draft(UUID, DATE, TEXT)
  TO authenticated, service_role;

-- ============================================================
-- Confirm pending inward into an active stock lot
-- ============================================================

CREATE OR REPLACE FUNCTION confirm_stock_inward_draft(
  p_draft_id UUID,
  p_actual_unit_count NUMERIC,
  p_meters_per_unit NUMERIC,
  p_godown TEXT,
  p_unit_label TEXT,
  p_notes TEXT
)
RETURNS TABLE (
  stock_lot_id UUID,
  original_meters NUMERIC,
  original_unit_count NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_role TEXT;
  v_draft fabric_stock_inward_drafts%ROWTYPE;
  v_stock_lot_id UUID;
  v_meters NUMERIC;
  v_unit_label TEXT;
  v_godown TEXT;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  v_role := auth.jwt() ->> 'user_role';

  IF v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can confirm stock inward';
  END IF;

  IF p_actual_unit_count <= 0 THEN
    RAISE EXCEPTION 'Unit count must be greater than zero';
  END IF;

  IF p_meters_per_unit <= 0 THEN
    RAISE EXCEPTION 'Meters per unit must be greater than zero';
  END IF;

  SELECT *
    INTO v_draft
  FROM fabric_stock_inward_drafts
  WHERE id = p_draft_id
    AND org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending inward not found';
  END IF;

  IF v_draft.status <> 'pending' THEN
    RAISE EXCEPTION 'This inward has already been %', v_draft.status;
  END IF;

  v_unit_label := COALESCE(NULLIF(BTRIM(p_unit_label), ''), v_draft.unit_label, 'taka');
  v_godown := COALESCE(NULLIF(BTRIM(p_godown), ''), v_draft.suggested_godown, 'Main Godown');
  v_meters := ROUND(p_actual_unit_count * p_meters_per_unit, 2);

  INSERT INTO fabric_stock_lots (
    org_id,
    quality_label,
    godown,
    source_type,
    market_run_id,
    order_id,
    quote_id,
    original_taka_count,
    available_taka_count,
    meters_per_taka,
    unit_label,
    original_meters,
    available_meters,
    stock_purpose,
    cost_per_meter,
    received_date,
    source_date,
    source_shift,
    notes,
    created_by
  ) VALUES (
    v_org_id,
    v_draft.quality_label,
    v_godown,
    v_draft.source_type,
    v_draft.market_run_id,
    v_draft.order_id,
    v_draft.quote_id,
    p_actual_unit_count,
    p_actual_unit_count,
    p_meters_per_unit,
    v_unit_label,
    v_meters,
    v_meters,
    CASE WHEN v_draft.source_type = 'market_run' THEN 'sellable' ELSE 'order_reserved' END,
    v_draft.cost_per_meter,
    v_draft.source_date,
    v_draft.source_date,
    v_draft.source_shift,
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_stock_lot_id;

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
    v_stock_lot_id,
    'inward',
    v_draft.source_date,
    p_actual_unit_count,
    v_meters,
    'Confirmed production inward',
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    auth.uid()
  );

  UPDATE fabric_stock_inward_drafts
  SET
    status = 'confirmed',
    confirmed_stock_lot_id = v_stock_lot_id,
    confirmed_by = auth.uid(),
    confirmed_at = NOW(),
    notes = NULLIF(BTRIM(COALESCE(p_notes, '')), '')
  WHERE id = p_draft_id;

  RETURN QUERY SELECT v_stock_lot_id, v_meters, p_actual_unit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_stock_inward_draft(UUID, NUMERIC, NUMERIC, TEXT, TEXT, TEXT)
  TO authenticated, service_role;

-- ============================================================
-- Patch stock sale/adjustment RPCs to maintain meter balance
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
    RAISE EXCEPTION 'Units sold must be greater than zero';
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
    RAISE EXCEPTION 'Cannot sell % units — only % available',
      p_taka_sold, v_lot.available_taka_count;
  END IF;

  v_meters_sold := ROUND(p_taka_sold * v_lot.meters_per_taka, 2);

  IF v_meters_sold > v_lot.available_meters THEN
    RAISE EXCEPTION 'Cannot sell % m — only % m available',
      v_meters_sold, v_lot.available_meters;
  END IF;

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
  SET
    available_taka_count = available_taka_count - p_taka_sold,
    available_meters = available_meters - v_meters_sold
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
  v_next_meters  NUMERIC;
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
    RAISE EXCEPTION 'Unit count must be greater than zero';
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
  v_next_meters := v_lot.available_meters + v_delta_meters;

  IF v_next_taka < 0 OR v_next_meters < 0 THEN
    RAISE EXCEPTION 'Cannot subtract % units — only % available',
      p_taka_count, v_lot.available_taka_count;
  END IF;

  UPDATE fabric_stock_lots
  SET
    available_taka_count = v_next_taka,
    available_meters = v_next_meters,
    original_taka_count = CASE
      WHEN p_adjustment_mode = 'add' THEN original_taka_count + p_taka_count
      ELSE original_taka_count
    END,
    original_meters = CASE
      WHEN p_adjustment_mode = 'add' THEN original_meters + ABS(v_delta_meters)
      ELSE original_meters
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
  SELECT p_stock_lot_id, v_next_taka, v_next_meters;
END;
$$;

-- ============================================================
-- Consume order-reserved stock when an order dispatch is created
-- ============================================================

CREATE OR REPLACE FUNCTION consume_order_stock_for_dispatch(
  p_order_id UUID,
  p_meters_to_consume NUMERIC,
  p_reference TEXT,
  p_notes TEXT
)
RETURNS TABLE (
  consumed_meters NUMERIC,
  remaining_unmatched_meters NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_role TEXT;
  v_lot fabric_stock_lots%ROWTYPE;
  v_remaining NUMERIC;
  v_consume_meters NUMERIC;
  v_consume_units NUMERIC;
  v_total_consumed NUMERIC := 0;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  v_role := auth.jwt() ->> 'user_role';

  IF v_role NOT IN ('owner','supervisor') THEN
    RAISE EXCEPTION 'Only owners or supervisors can consume order stock';
  END IF;

  IF p_meters_to_consume <= 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  v_remaining := p_meters_to_consume;

  FOR v_lot IN
    SELECT *
    FROM fabric_stock_lots
    WHERE org_id = v_org_id
      AND order_id = p_order_id
      AND stock_purpose = 'order_reserved'
      AND available_meters > 0
    ORDER BY received_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_consume_meters := LEAST(v_remaining, v_lot.available_meters);
    v_consume_units := ROUND(v_consume_meters / v_lot.meters_per_taka, 2);

    UPDATE fabric_stock_lots
    SET
      available_meters = available_meters - v_consume_meters,
      available_taka_count = GREATEST(0, available_taka_count - v_consume_units)
    WHERE id = v_lot.id;

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
      v_lot.id,
      'adjustment_subtract',
      CURRENT_DATE,
      -v_consume_units,
      -v_consume_meters,
      COALESCE(NULLIF(BTRIM(p_reference), ''), 'Order dispatch'),
      NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
      auth.uid()
    );

    v_remaining := v_remaining - v_consume_meters;
    v_total_consumed := v_total_consumed + v_consume_meters;
  END LOOP;

  RETURN QUERY SELECT ROUND(v_total_consumed, 2), ROUND(GREATEST(v_remaining, 0), 2);
END;
$$;

GRANT EXECUTE ON FUNCTION consume_order_stock_for_dispatch(UUID, NUMERIC, TEXT, TEXT)
  TO authenticated, service_role;

-- ============================================================
-- Rebuild lot summary with explicit meter balances
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
  l.stock_purpose,
  l.market_run_id,
  l.order_id,
  l.quote_id,
  l.original_taka_count,
  l.available_taka_count,
  l.original_meters,
  l.available_meters,
  l.meters_per_taka,
  l.unit_label,
  l.cost_per_meter,
  l.received_date,
  l.source_date,
  l.source_shift,
  l.notes,
  l.created_at,
  l.updated_at,
  COALESCE(SUM(s.taka_sold), 0) AS sold_taka_count,
  COALESCE(SUM(s.meters_sold), 0) AS sold_meters,
  COALESCE(SUM(s.revenue_amount), 0) AS total_revenue,
  COALESCE(SUM(s.cost_amount), 0) AS total_cost_on_sold,
  COALESCE(SUM(s.gross_profit_amount), 0) AS total_gross_profit,
  CASE
    WHEN l.available_taka_count = 0 OR l.available_meters = 0 THEN 'sold_out'
    WHEN COALESCE(SUM(s.taka_sold), 0) > 0 THEN 'partially_sold'
    ELSE 'available'
  END AS stock_status
FROM fabric_stock_lots l
LEFT JOIN fabric_stock_sales s ON s.stock_lot_id = l.id
GROUP BY l.id;

-- ============================================================
-- Rebuild market run summary so confirmed stock lots are visible
-- and stock-lot sales reduce the same commercial availability.
-- ============================================================

CREATE OR REPLACE VIEW market_run_summary AS
SELECT
    mr.id               AS market_run_id,
    mr.org_id,
    mr.fabric_label,
    mr.quality_label,
    mr.warp_instruction,
    mr.weft_instruction,
    mr.target_meters,
    mr.cost_per_meter,
    mr.worker_rate_per_m,
    mr.status,
    mr.quote_id,
    mr.notes,
    mr.created_at,

    ( SELECT o.id FROM orders o WHERE o.market_run_id = mr.id LIMIT 1 ) AS order_id,
    ( SELECT o.status FROM orders o WHERE o.market_run_id = mr.id LIMIT 1 ) AS order_status,

    COALESCE((
        SELECT SUM(pl.meters)
        FROM production_logs pl
        JOIN orders o ON o.id = pl.order_id
        WHERE o.market_run_id = mr.id
    ), 0) AS total_meters_produced,

    COALESCE((
        SELECT SUM(s.meters_sold)
        FROM market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0)
    + COALESCE((
        SELECT SUM(fs.meters_sold)
        FROM fabric_stock_sales fs
        JOIN fabric_stock_lots fl ON fl.id = fs.stock_lot_id
        WHERE fl.market_run_id = mr.id
    ), 0) AS total_meters_sold,

    CASE
      WHEN EXISTS (
        SELECT 1 FROM fabric_stock_lots fl WHERE fl.market_run_id = mr.id
      ) THEN COALESCE((
        SELECT SUM(fl.available_meters)
        FROM fabric_stock_lots fl
        WHERE fl.market_run_id = mr.id
      ), 0)
      ELSE
        COALESCE((
            SELECT SUM(pl.meters)
            FROM production_logs pl
            JOIN orders o ON o.id = pl.order_id
            WHERE o.market_run_id = mr.id
        ), 0)
        - COALESCE((
            SELECT SUM(s.meters_sold)
            FROM market_run_sales s
            WHERE s.market_run_id = mr.id
        ), 0)
    END AS meters_in_godown,

    COALESCE((
        SELECT SUM(s.meters_sold * s.price_per_meter)
        FROM market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0)
    + COALESCE((
        SELECT SUM(fs.revenue_amount)
        FROM fabric_stock_sales fs
        JOIN fabric_stock_lots fl ON fl.id = fs.stock_lot_id
        WHERE fl.market_run_id = mr.id
    ), 0) AS total_revenue,

    COALESCE((
        SELECT SUM(s.meters_sold * s.cost_per_meter)
        FROM market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0)
    + COALESCE((
        SELECT SUM(fs.cost_amount)
        FROM fabric_stock_sales fs
        JOIN fabric_stock_lots fl ON fl.id = fs.stock_lot_id
        WHERE fl.market_run_id = mr.id
    ), 0) AS total_cost_on_sold,

    COALESCE((
        SELECT SUM(s.meters_sold * (s.price_per_meter - s.cost_per_meter))
        FROM market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0)
    + COALESCE((
        SELECT SUM(fs.gross_profit_amount)
        FROM fabric_stock_sales fs
        JOIN fabric_stock_lots fl ON fl.id = fs.stock_lot_id
        WHERE fl.market_run_id = mr.id
    ), 0) AS total_profit,

    COALESCE((
        SELECT COUNT(*)::int
        FROM market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0) AS sales_count,

    COALESCE((
        SELECT COUNT(*)::int
        FROM fabric_stock_lots fl
        WHERE fl.market_run_id = mr.id
    ), 0) AS stock_lot_count

FROM market_runs mr;

ALTER PUBLICATION supabase_realtime ADD TABLE fabric_stock_inward_drafts;
