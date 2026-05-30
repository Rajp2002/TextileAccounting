-- New migration to update confirm_party_stock_sale_dispatch_v1 to support partial/configurable dispatches.

DROP FUNCTION IF EXISTS confirm_party_stock_sale_dispatch_v1(UUID, DATE, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION confirm_party_stock_sale_dispatch_v1(
  p_sale_id UUID,
  p_dispatch_date DATE,
  p_transport_name TEXT,
  p_vehicle_number TEXT,
  p_challan_number TEXT,
  p_dispatch_meters NUMERIC,
  p_dispatch_takas NUMERIC,
  p_notes TEXT
)
RETURNS TABLE (
  dispatch_id UUID,
  dispatch_number INTEGER,
  due_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_role TEXT;
  v_sale RECORD;
  v_dispatch_id UUID;
  v_dispatch_number INTEGER;
  v_due_date DATE;
  v_gst_amount NUMERIC;
  v_gst_percent NUMERIC := 5;
  v_total_invoice_value NUMERIC;
  v_eway_required BOOLEAN;
  v_package_id UUID;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  v_user_id := auth.uid();
  v_role := auth.jwt() ->> 'user_role';

  IF v_org_id IS NULL OR v_user_id IS NULL OR v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can confirm party stock sale dispatches';
  END IF;

  -- 1. Fetch and lock sale
  SELECT s.*, l.quality_label, l.godown, l.order_id
    INTO v_sale
  FROM fabric_stock_sales s
  JOIN fabric_stock_lots l ON l.id = s.stock_lot_id
  WHERE s.id = p_sale_id
    AND s.org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  IF v_sale.pending_dispatch_meters <= 0 THEN
    RAISE EXCEPTION 'Sale has already been fully dispatched';
  END IF;

  IF p_dispatch_meters <= 0 OR p_dispatch_meters > v_sale.pending_dispatch_meters THEN
    RAISE EXCEPTION 'Invalid dispatch meters. Must be between 0 and %', v_sale.pending_dispatch_meters;
  END IF;

  -- 2. Calculate new due date starting from dispatch_date
  v_due_date := p_dispatch_date + COALESCE(v_sale.credit_days, 0);

  -- 3. Calculate GST and E-way bill requirement based on THIS batch's dispatched meters
  v_gst_amount := ROUND((p_dispatch_meters * v_sale.price_per_meter) * v_gst_percent / 100, 2);
  v_total_invoice_value := ROUND(p_dispatch_meters * v_sale.price_per_meter, 2) + v_gst_amount;
  v_eway_required := v_total_invoice_value > 50000;

  -- 4. Get next dispatch number for non-order dispatches
  SELECT COALESCE(MAX(d.dispatch_number), 0) + 1
    INTO v_dispatch_number
  FROM dispatches d
  WHERE d.org_id = v_org_id
    AND d.order_id IS NULL;

  -- 5. Insert dispatch
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
    p_dispatch_meters,
    'in_transit',
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    p_dispatch_date::timestamptz,
    v_user_id,
    ROUND(p_dispatch_meters * v_sale.price_per_meter, 2),
    v_gst_percent,
    ROUND(v_gst_amount / 2, 2),
    ROUND(v_gst_amount / 2, 2),
    0,
    v_total_invoice_value,
    v_eway_required,
    NULLIF(btrim(COALESCE(p_vehicle_number, '')), ''),
    NULLIF(btrim(COALESCE(p_transport_name, '')), ''),
    NULLIF(btrim(v_sale.party_name), ''),
    NULLIF(btrim(COALESCE(v_sale.party_phone, '')), ''),
    NULLIF(btrim(COALESCE(v_sale.party_city, '')), ''),
    NULLIF(btrim(COALESCE(p_challan_number, '')), '')
  )
  RETURNING id INTO v_dispatch_id;

  -- 6. Insert a package for tracking
  INSERT INTO fabric_packages (
    org_id,
    order_id,
    package_no,
    package_type,
    units_count,
    metres,
    grade,
    inspection_status,
    stock_state,
    location,
    source_date,
    source_reference,
    created_by
  ) VALUES (
    v_org_id,
    v_sale.order_id,
    'SS-' || upper(left(replace(v_sale.id::text, '-', ''), 8)) || '-' || v_dispatch_number::text,
    'bulk',
    GREATEST(1, COALESCE(p_dispatch_takas, 1)::integer),
    p_dispatch_meters,
    'Sold',
    'pass',
    'dispatched',
    v_sale.godown,
    v_sale.sale_date,
    'stock-sale:' || v_sale.id::text || '-d' || v_dispatch_number::text,
    v_user_id
  )
  RETURNING id INTO v_package_id;

  INSERT INTO dispatch_package_lines (
    org_id,
    dispatch_id,
    package_id,
    order_id,
    package_no,
    package_type,
    units_count,
    grade,
    inspection_status,
    location_snapshot,
    qty_meters_sent
  ) VALUES (
    v_org_id,
    v_dispatch_id,
    v_package_id,
    v_sale.order_id,
    'SS-' || upper(left(replace(v_sale.id::text, '-', ''), 8)) || '-' || v_dispatch_number::text,
    'bulk',
    GREATEST(1, COALESCE(p_dispatch_takas, 1)::integer),
    'Sold',
    'pass',
    v_sale.godown,
    p_dispatch_meters
  );

  -- 7. Update sale details
  UPDATE fabric_stock_sales
  SET
    dispatch_id = v_dispatch_id,
    dispatch_status = CASE 
      WHEN GREATEST(pending_dispatch_meters - p_dispatch_meters, 0) <= 0.01 THEN 'dispatched' 
      ELSE 'partially_dispatched' 
    END,
    dispatched_meters = COALESCE(dispatched_meters, 0) + p_dispatch_meters,
    pending_dispatch_meters = GREATEST(pending_dispatch_meters - p_dispatch_meters, 0),
    dispatch_date = p_dispatch_date,
    due_date = v_due_date,
    transport_name = NULLIF(btrim(COALESCE(p_transport_name, transport_name, '')), ''),
    vehicle_number = NULLIF(btrim(COALESCE(p_vehicle_number, vehicle_number, '')), ''),
    challan_number = NULLIF(btrim(COALESCE(p_challan_number, challan_number, '')), ''),
    notes = NULLIF(btrim(COALESCE(p_notes, notes, '')), '')
  WHERE id = v_sale.id;

  -- 8. Update commercial receivable
  UPDATE commercial_receivables
  SET
    dispatch_id = v_dispatch_id,
    due_date = v_due_date,
    updated_by = v_user_id
  WHERE org_id = v_org_id
    AND source_type = 'fabric_stock_sale'
    AND source_id = v_sale.id;

  RETURN QUERY
  SELECT
    v_dispatch_id,
    v_dispatch_number,
    v_due_date;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_party_stock_sale_dispatch_v1(UUID, DATE, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;
