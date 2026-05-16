-- Production hardening for party-first stock sale dispatch.
-- Makes the write path atomic, prevents concurrent over-selling, and keeps
-- intentional partial dispatch separate from discrepancy reconciliation.

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
  p_notes TEXT
)
RETURNS TABLE (
  sale_id UUID,
  dispatch_id UUID,
  dispatch_number INTEGER,
  dispatch_status TEXT,
  pending_dispatch_meters NUMERIC,
  receivable_id UUID
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

  IF COALESCE(btrim(p_party_name), '') = '' THEN
    RAISE EXCEPTION 'Party name is required';
  END IF;

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
  v_due_date := p_sale_date + COALESCE(p_credit_days, 0);

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
    NULLIF(btrim(p_party_name), ''),
    NULLIF(btrim(COALESCE(p_party_phone, '')), ''),
    NULLIF(btrim(COALESCE(p_party_city, '')), ''),
    NULLIF(btrim(COALESCE(p_party_gstin, '')), ''),
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
    'Sale to ' || NULLIF(btrim(p_party_name), ''),
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
      NULLIF(btrim(p_party_name), ''),
      NULLIF(btrim(COALESCE(p_party_phone, '')), ''),
      NULLIF(btrim(COALESCE(p_party_city, '')), ''),
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
    NULLIF(btrim(p_party_name), ''),
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
    v_receivable_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_party_stock_sale_dispatch_v1(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, INTEGER, DATE,
  BOOLEAN, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT
) TO authenticated, service_role;
