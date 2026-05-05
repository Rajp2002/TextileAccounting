-- Fix stock sale RPC validation and generated-column RETURNING ambiguity.

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

  IF p_taka_sold IS NULL OR p_taka_sold <= 0 THEN
    RAISE EXCEPTION 'Units sold must be greater than zero';
  END IF;

  IF p_taka_sold <> TRUNC(p_taka_sold) THEN
    RAISE EXCEPTION 'Units sold must be a whole number';
  END IF;

  IF p_price_per_meter IS NULL OR p_price_per_meter < 0 THEN
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
    RAISE EXCEPTION 'Cannot sell % units - only % available',
      p_taka_sold, v_lot.available_taka_count;
  END IF;

  v_meters_sold := ROUND(p_taka_sold * v_lot.meters_per_taka, 2);

  IF v_meters_sold > v_lot.available_meters THEN
    RAISE EXCEPTION 'Cannot sell % m - only % m available',
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
  RETURNING fabric_stock_sales.id,
            fabric_stock_sales.revenue_amount,
            fabric_stock_sales.gross_profit_amount
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
