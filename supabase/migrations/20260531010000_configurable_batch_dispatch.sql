-- Migration: Update create_stock_sale_dispatch to support configurable batch dispatch quantities and dates.

DROP FUNCTION IF EXISTS create_stock_sale_dispatch(UUID, UUID, UUID[], TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, UUID);

CREATE OR REPLACE FUNCTION create_stock_sale_dispatch(
  p_org_id UUID,
  p_order_id UUID,
  p_sale_ids UUID[],
  p_dispatch_meters NUMERIC[],
  p_dispatch_takas NUMERIC[],
  p_dispatch_date DATE,
  p_notes TEXT,
  p_eway_bill_number TEXT,
  p_vehicle_number TEXT,
  p_transporter_name TEXT,
  p_transporter_id TEXT,
  p_approximate_distance_km NUMERIC,
  p_eway_bill_generated_at TIMESTAMPTZ,
  p_created_by UUID
)
RETURNS TABLE (
  dispatch_id UUID,
  dispatch_number INTEGER,
  qty_meters_sent NUMERIC,
  tracking_token TEXT,
  party_name TEXT,
  org_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispatch_id UUID;
  v_dispatch_number INTEGER;
  v_total NUMERIC(10,2);
  v_selected_count INTEGER;
  v_party_name TEXT;
  v_tracking_token TEXT;
  v_org_name TEXT;
  v_status TEXT;
  v_quality_label TEXT;
  v_role TEXT;
  v_actor_org_id UUID;
  v_gst_percent NUMERIC := 5;
  v_gst_amount NUMERIC;
  v_total_invoice_value NUMERIC;
  v_eway_required BOOLEAN;
  
  -- Loop variables
  i INTEGER;
  v_sale_row RECORD;
  v_package_id UUID;
  v_due_date DATE;
BEGIN
  v_actor_org_id := (auth.jwt() ->> 'org_id')::uuid;
  v_role := auth.jwt() ->> 'user_role';
  IF v_role NOT IN ('owner','supervisor') THEN
    RAISE EXCEPTION 'Only owners or supervisors can create dispatches';
  END IF;

  IF p_org_id IS DISTINCT FROM v_actor_org_id THEN
    RAISE EXCEPTION 'Cannot create dispatch outside your organization';
  END IF;

  v_selected_count := COALESCE(array_length(p_sale_ids, 1), 0);
  IF v_selected_count = 0 THEN
    RAISE EXCEPTION 'Select at least one sold stock entry to dispatch';
  END IF;

  SELECT o.party_name, o.tracking_token, o.status, o.quality_label, org.name
    INTO v_party_name, v_tracking_token, v_status, v_quality_label, v_org_name
  FROM orders o
  JOIN organizations org ON org.id = o.org_id
  WHERE o.id = p_order_id
    AND o.org_id = p_org_id;

  IF v_tracking_token IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Cannot dispatch from a completed or cancelled order';
  END IF;

  -- 1. Validation loop and lock rows
  v_total := 0;
  v_total_invoice_value := 0;

  FOR i IN 1..v_selected_count LOOP
    SELECT s.id, s.pending_dispatch_meters, s.price_per_meter
      INTO v_sale_row
    FROM fabric_stock_sales s
    JOIN fabric_stock_lots l ON l.id = s.stock_lot_id
    WHERE s.org_id = p_org_id
      AND s.id = p_sale_ids[i]
      AND (
        l.order_id = p_order_id
        OR (
          l.order_id IS NULL
          AND v_quality_label IS NOT NULL
          AND lower(btrim(l.quality_label)) = lower(btrim(v_quality_label))
        )
      )
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sale ID % not found or does not match this order/quality', p_sale_ids[i];
    END IF;

    IF v_sale_row.pending_dispatch_meters <= 0 THEN
      RAISE EXCEPTION 'Sale ID % has already been fully dispatched', p_sale_ids[i];
    END IF;

    IF p_dispatch_meters[i] <= 0 OR p_dispatch_meters[i] > v_sale_row.pending_dispatch_meters + 0.01 THEN
      RAISE EXCEPTION 'Invalid dispatch meters for sale ID %. Must be between 0 and %', p_sale_ids[i], v_sale_row.pending_dispatch_meters;
    END IF;

    v_total := v_total + p_dispatch_meters[i];
    v_total_invoice_value := v_total_invoice_value + ROUND(p_dispatch_meters[i] * v_sale_row.price_per_meter, 2);
  END LOOP;

  v_gst_amount := ROUND(v_total_invoice_value * v_gst_percent / 100, 2);
  v_eway_required := (v_total_invoice_value + v_gst_amount) > 50000;

  SELECT next_dispatch_number(p_order_id)
    INTO v_dispatch_number;

  -- 2. Insert single dispatch header
  INSERT INTO dispatches (
    org_id,
    order_id,
    dispatch_number,
    qty_meters_sent,
    status,
    notes,
    eway_bill_number,
    eway_bill_required,
    vehicle_number,
    transporter_name,
    transporter_id,
    approximate_distance_km,
    eway_bill_generated_at,
    taxable_value,
    gst_percent,
    cgst_amount,
    sgst_amount,
    igst_amount,
    total_invoice_value,
    dispatched_at,
    created_by
  ) VALUES (
    p_org_id,
    p_order_id,
    v_dispatch_number,
    v_total,
    'in_transit',
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    NULLIF(btrim(COALESCE(p_eway_bill_number, '')), ''),
    v_eway_required,
    NULLIF(btrim(COALESCE(p_vehicle_number, '')), ''),
    NULLIF(btrim(COALESCE(p_transporter_name, '')), ''),
    NULLIF(btrim(COALESCE(p_transporter_id, '')), ''),
    p_approximate_distance_km,
    p_eway_bill_generated_at,
    v_total_invoice_value,
    v_gst_percent,
    ROUND(v_gst_amount / 2, 2),
    ROUND(v_gst_amount / 2, 2),
    0,
    v_total_invoice_value + v_gst_amount,
    p_dispatch_date::timestamptz,
    p_created_by
  )
  RETURNING id INTO v_dispatch_id;

  -- 3. Loop again to insert fabric packages, dispatch package lines, update sales & receivables
  FOR i IN 1..v_selected_count LOOP
    SELECT s.id, s.sale_date, s.meters_sold, s.price_per_meter, s.credit_days, l.quality_label, l.godown, l.order_id
      INTO v_sale_row
    FROM fabric_stock_sales s
    JOIN fabric_stock_lots l ON l.id = s.stock_lot_id
    WHERE s.id = p_sale_ids[i];

    -- Insert package for tracking
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
      p_org_id,
      p_order_id,
      'SS-' || upper(left(replace(v_sale_row.id::text, '-', ''), 8)) || '-' || v_dispatch_number::text,
      'bulk',
      GREATEST(1, COALESCE(p_dispatch_takas[i], 1)::integer),
      p_dispatch_meters[i],
      'Sold',
      'pass',
      'dispatched',
      v_sale_row.godown,
      v_sale_row.sale_date,
      'stock-sale:' || v_sale_row.id::text || '-d' || v_dispatch_number::text,
      p_created_by
    )
    RETURNING id INTO v_package_id;

    -- Insert dispatch package line
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
      p_org_id,
      v_dispatch_id,
      v_package_id,
      p_order_id,
      'SS-' || upper(left(replace(v_sale_row.id::text, '-', ''), 8)) || '-' || v_dispatch_number::text,
      'bulk',
      GREATEST(1, COALESCE(p_dispatch_takas[i], 1)::integer),
      'Sold',
      'pass',
      v_sale_row.godown,
      p_dispatch_meters[i]
    );

    v_due_date := p_dispatch_date + COALESCE(v_sale_row.credit_days, 0);

    UPDATE fabric_stock_sales
    SET
      dispatch_id = v_dispatch_id,
      dispatch_status = CASE 
        WHEN GREATEST(pending_dispatch_meters - p_dispatch_meters[i], 0) <= 0.01 THEN 'dispatched' 
        ELSE 'partially_dispatched' 
      END,
      dispatched_meters = COALESCE(dispatched_meters, 0) + p_dispatch_meters[i],
      pending_dispatch_meters = GREATEST(pending_dispatch_meters - p_dispatch_meters[i], 0),
      dispatch_date = p_dispatch_date,
      due_date = v_due_date,
      transport_name = NULLIF(btrim(COALESCE(p_transporter_name, transport_name, '')), ''),
      vehicle_number = NULLIF(btrim(COALESCE(p_vehicle_number, vehicle_number, '')), ''),
      notes = NULLIF(btrim(COALESCE(p_notes, notes, '')), '')
    WHERE id = p_sale_ids[i];

    UPDATE commercial_receivables
    SET
      dispatch_id = v_dispatch_id,
      due_date = v_due_date,
      updated_by = p_created_by
    WHERE org_id = p_org_id
      AND source_type = 'fabric_stock_sale'
      AND source_id = v_sale_row.id;
  END LOOP;

  RETURN QUERY
  SELECT
    v_dispatch_id,
    v_dispatch_number,
    v_total,
    v_tracking_token,
    v_party_name,
    COALESCE(v_org_name, 'Factory');
END;
$$;

GRANT EXECUTE ON FUNCTION create_stock_sale_dispatch(UUID, UUID, UUID[], NUMERIC[], NUMERIC[], DATE, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, UUID)
  TO authenticated, service_role;
