-- Batch 6: Golden A completed-order stock dispatch closure.
-- Production auto-completes order-backed work when target meters are reached,
-- while the owner dispatch UI already allows dispatching active or completed
-- orders. Keep cancelled orders blocked, but allow completed orders to dispatch
-- their already-sold, pending stock.

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
  p_created_by UUID,
  p_idempotency_key TEXT DEFAULT NULL
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
  v_existing_dispatch RECORD;
  v_idempotency_key TEXT;
  i INTEGER;
  v_sale_row RECORD;
  v_package_id UUID;
  v_package_no TEXT;
  v_units_count INTEGER;
  v_due_date DATE;
  v_new_pending NUMERIC;
BEGIN
  PERFORM public.assert_org_not_locked(p_org_id);

  v_actor_org_id := (auth.jwt() ->> 'org_id')::uuid;
  v_role := auth.jwt() ->> 'user_role';
  v_idempotency_key := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');

  IF v_role NOT IN ('owner','supervisor') THEN
    RAISE EXCEPTION 'Only owners or supervisors can create dispatches';
  END IF;

  IF p_org_id IS DISTINCT FROM v_actor_org_id THEN
    RAISE EXCEPTION 'Cannot create dispatch outside your organization';
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT
      d.id,
      d.order_id,
      d.dispatch_number,
      d.qty_meters_sent,
      o.tracking_token,
      o.party_name,
      org.name AS org_name
    INTO v_existing_dispatch
    FROM dispatches d
    JOIN orders o ON o.id = d.order_id
    JOIN organizations org ON org.id = d.org_id
    WHERE d.org_id = p_org_id
      AND d.idempotency_key = v_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      IF v_existing_dispatch.order_id IS DISTINCT FROM p_order_id THEN
        RAISE EXCEPTION 'Duplicate dispatch request key was used for a different order';
      END IF;

      RETURN QUERY
      SELECT
        v_existing_dispatch.id,
        v_existing_dispatch.dispatch_number,
        v_existing_dispatch.qty_meters_sent,
        v_existing_dispatch.tracking_token,
        v_existing_dispatch.party_name,
        COALESCE(v_existing_dispatch.org_name, 'Factory');
      RETURN;
    END IF;
  END IF;

  v_selected_count := COALESCE(array_length(p_sale_ids, 1), 0);
  IF v_selected_count = 0 THEN
    RAISE EXCEPTION 'Select at least one sold stock entry to dispatch';
  END IF;

  IF COALESCE(array_length(p_dispatch_meters, 1), 0) <> v_selected_count
    OR COALESCE(array_length(p_dispatch_takas, 1), 0) <> v_selected_count THEN
    RAISE EXCEPTION 'Dispatch quantity arrays must match selected sale count';
  END IF;

  IF (SELECT COUNT(DISTINCT sale_id) FROM unnest(p_sale_ids) AS selected_sale(sale_id)) <> v_selected_count THEN
    RAISE EXCEPTION 'Select each sold stock entry only once per dispatch';
  END IF;

  IF p_dispatch_date IS NULL THEN
    RAISE EXCEPTION 'Dispatch date is required';
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

  IF v_status NOT IN ('active', 'completed') THEN
    RAISE EXCEPTION 'Can only dispatch against active or completed orders';
  END IF;

  v_total := 0;
  v_total_invoice_value := 0;

  FOR i IN 1..v_selected_count LOOP
    SELECT s.id, s.pending_dispatch_meters, s.price_per_meter, s.taka_sold, s.meters_sold
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

    IF v_sale_row.pending_dispatch_meters <= 0.01 THEN
      RAISE EXCEPTION 'Sale ID % has already been fully dispatched', p_sale_ids[i];
    END IF;

    IF p_dispatch_meters[i] <= 0 OR p_dispatch_meters[i] > v_sale_row.pending_dispatch_meters + 0.01 THEN
      RAISE EXCEPTION 'Invalid dispatch meters for sale ID %. Must be between 0 and %', p_sale_ids[i], v_sale_row.pending_dispatch_meters;
    END IF;

    IF p_dispatch_takas[i] IS NOT NULL AND p_dispatch_takas[i] <= 0 THEN
      RAISE EXCEPTION 'Dispatch units must be greater than 0 for sale ID %', p_sale_ids[i];
    END IF;

    v_total := v_total + p_dispatch_meters[i];
    v_total_invoice_value := v_total_invoice_value + ROUND(p_dispatch_meters[i] * v_sale_row.price_per_meter, 2);
  END LOOP;

  v_gst_amount := ROUND(v_total_invoice_value * v_gst_percent / 100, 2);
  v_eway_required := (v_total_invoice_value + v_gst_amount) > 50000;

  SELECT next_dispatch_number(p_order_id)
    INTO v_dispatch_number;

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
    idempotency_key,
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
    v_idempotency_key,
    p_created_by
  )
  RETURNING id, dispatch_number INTO v_dispatch_id, v_dispatch_number;

  FOR i IN 1..v_selected_count LOOP
    SELECT s.id, s.sale_date, s.meters_sold, s.taka_sold, s.price_per_meter, s.credit_days, s.pending_dispatch_meters,
           l.quality_label, l.godown, l.order_id
      INTO v_sale_row
    FROM fabric_stock_sales s
    JOIN fabric_stock_lots l ON l.id = s.stock_lot_id
    WHERE s.id = p_sale_ids[i]
      AND s.org_id = p_org_id;

    IF p_dispatch_takas[i] IS NULL THEN
      IF v_sale_row.meters_sold <= 0 OR v_sale_row.taka_sold <= 0 THEN
        RAISE EXCEPTION 'Cannot derive dispatch units for sale ID %', p_sale_ids[i];
      END IF;
      v_units_count := CEIL((p_dispatch_meters[i] / v_sale_row.meters_sold) * v_sale_row.taka_sold)::integer;
    ELSE
      v_units_count := CEIL(p_dispatch_takas[i])::integer;
    END IF;

    IF v_units_count <= 0 THEN
      RAISE EXCEPTION 'Dispatch units must be greater than 0 for sale ID %', p_sale_ids[i];
    END IF;

    v_package_no := 'SS-' || upper(left(replace(v_sale_row.id::text, '-', ''), 8)) || '-' || upper(left(replace(v_dispatch_id::text, '-', ''), 8));

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
      v_package_no,
      'bulk',
      v_units_count,
      p_dispatch_meters[i],
      'Sold',
      'pass',
      'dispatched',
      v_sale_row.godown,
      v_sale_row.sale_date,
      'stock-sale:' || v_sale_row.id::text || ':dispatch:' || v_dispatch_id::text,
      p_created_by
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
      p_org_id,
      v_dispatch_id,
      v_package_id,
      p_order_id,
      v_package_no,
      'bulk',
      v_units_count,
      'Sold',
      'pass',
      v_sale_row.godown,
      p_dispatch_meters[i]
    );

    v_due_date := p_dispatch_date + COALESCE(v_sale_row.credit_days, 0);
    v_new_pending := v_sale_row.pending_dispatch_meters - p_dispatch_meters[i];
    IF v_new_pending < -0.01 THEN
      RAISE EXCEPTION 'Dispatch meters cannot exceed pending meters for sale ID %', p_sale_ids[i];
    ELSIF ABS(v_new_pending) <= 0.01 THEN
      v_new_pending := 0;
    END IF;

    UPDATE fabric_stock_sales
    SET
      dispatch_id = v_dispatch_id,
      dispatch_status = CASE
        WHEN v_new_pending = 0 THEN 'dispatched'
        ELSE 'partially_dispatched'
      END,
      dispatched_meters = COALESCE(dispatched_meters, 0) + p_dispatch_meters[i],
      pending_dispatch_meters = v_new_pending,
      dispatch_date = p_dispatch_date,
      due_date = v_due_date,
      transport_name = NULLIF(btrim(COALESCE(p_transporter_name, transport_name, '')), ''),
      vehicle_number = NULLIF(btrim(COALESCE(p_vehicle_number, vehicle_number, '')), ''),
      notes = NULLIF(btrim(COALESCE(p_notes, notes, '')), '')
    WHERE id = p_sale_ids[i]
      AND org_id = p_org_id;

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

GRANT EXECUTE ON FUNCTION create_stock_sale_dispatch(
  UUID, UUID, UUID[], NUMERIC[], NUMERIC[], DATE, TEXT, TEXT, TEXT, TEXT,
  TEXT, NUMERIC, TIMESTAMPTZ, UUID, TEXT
) TO authenticated, service_role;
