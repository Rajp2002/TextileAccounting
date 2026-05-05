-- Dispatch sold taka stock instead of currently available godown stock.

ALTER TABLE fabric_stock_sales
  ADD COLUMN IF NOT EXISTS dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL;

ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS eway_bill_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vehicle_number TEXT,
  ADD COLUMN IF NOT EXISTS transporter_name TEXT,
  ADD COLUMN IF NOT EXISTS transporter_id TEXT,
  ADD COLUMN IF NOT EXISTS approximate_distance_km NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS eway_bill_generated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fabric_stock_sales_pending_dispatch
  ON fabric_stock_sales(org_id, sale_date DESC, created_at DESC)
  WHERE dispatch_id IS NULL;

CREATE OR REPLACE FUNCTION create_stock_sale_dispatch(
  p_org_id UUID,
  p_order_id UUID,
  p_sale_ids UUID[],
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
  v_sale_count INTEGER;
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

  PERFORM 1
  FROM fabric_stock_sales s
  WHERE s.org_id = p_org_id
    AND s.id = ANY(p_sale_ids)
  FOR UPDATE;

  SELECT COUNT(*), COALESCE(SUM(s.meters_sold), 0), COALESCE(SUM(s.revenue_amount), 0)
    INTO v_sale_count, v_total, v_total_invoice_value
  FROM fabric_stock_sales s
  JOIN fabric_stock_lots l ON l.id = s.stock_lot_id
  WHERE s.org_id = p_org_id
    AND s.id = ANY(p_sale_ids)
    AND s.dispatch_id IS NULL
    AND (
      l.order_id = p_order_id
      OR (
        l.order_id IS NULL
        AND v_quality_label IS NOT NULL
        AND lower(btrim(l.quality_label)) = lower(btrim(v_quality_label))
      )
    );

  IF v_sale_count <> v_selected_count THEN
    RAISE EXCEPTION 'One or more selected stock sales are already dispatched or do not match this order';
  END IF;

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
    NOW(),
    p_created_by
  )
  RETURNING id INTO v_dispatch_id;

  WITH inserted_packages AS (
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
    )
    SELECT
      s.org_id,
      p_order_id,
      'SS-' || upper(left(replace(s.id::text, '-', ''), 8)),
      'bulk',
      GREATEST(1, s.taka_sold::integer),
      s.meters_sold,
      'Sold',
      'pass',
      'dispatched',
      l.godown,
      s.sale_date,
      'stock-sale:' || s.id::text,
      p_created_by
    FROM fabric_stock_sales s
    JOIN fabric_stock_lots l ON l.id = s.stock_lot_id
    WHERE s.org_id = p_org_id
      AND s.id = ANY(p_sale_ids)
      AND s.dispatch_id IS NULL
      AND (
        l.order_id = p_order_id
        OR (
          l.order_id IS NULL
          AND v_quality_label IS NOT NULL
          AND lower(btrim(l.quality_label)) = lower(btrim(v_quality_label))
        )
      )
    RETURNING id, org_id, order_id, package_no, package_type, units_count, metres, grade, inspection_status, location, source_reference
  )
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
  )
  SELECT
    ip.org_id,
    v_dispatch_id,
    ip.id,
    ip.order_id,
    ip.package_no,
    ip.package_type,
    ip.units_count,
    ip.grade,
    ip.inspection_status,
    ip.location,
    ip.metres
  FROM inserted_packages ip;

  UPDATE fabric_stock_sales
  SET dispatch_id = v_dispatch_id
  WHERE org_id = p_org_id
    AND id = ANY(p_sale_ids);

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

GRANT EXECUTE ON FUNCTION create_stock_sale_dispatch(UUID, UUID, UUID[], TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, UUID)
  TO authenticated, service_role;
