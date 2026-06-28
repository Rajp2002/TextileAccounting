-- Batch 3 dispatch/sale/receipt correctness.
-- Forward-only hardening: idempotent sale/dispatch submits, explicit dispatch
-- pending math, deterministic package identities, and synchronized receipt
-- state/discrepancy writes.

ALTER TABLE fabric_stock_sales
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fabric_stock_sales_org_idempotency_key
  ON fabric_stock_sales(org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dispatches_org_idempotency_key
  ON dispatches(org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

DROP FUNCTION IF EXISTS create_party_stock_sale_dispatch_v1(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, INTEGER,
  DATE, BOOLEAN, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT, UUID
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
  p_party_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
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
  v_existing_sale RECORD;
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
  v_tracking_token TEXT;
  v_idempotency_key TEXT;
  v_package_id UUID;
  v_package_no TEXT;
  v_package_units INTEGER;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  PERFORM public.assert_org_not_locked(v_org_id);

  v_user_id := auth.uid();
  v_role := auth.jwt() ->> 'user_role';
  v_idempotency_key := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');

  IF v_org_id IS NULL OR v_user_id IS NULL OR v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can create party stock sales';
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT
      s.id AS sale_id,
      s.dispatch_id,
      d.dispatch_number,
      s.dispatch_status,
      s.pending_dispatch_meters,
      cr.id AS receivable_id,
      s.party_id
    INTO v_existing_sale
    FROM fabric_stock_sales s
    LEFT JOIN dispatches d
      ON d.id = s.dispatch_id
     AND d.org_id = s.org_id
    LEFT JOIN commercial_receivables cr
      ON cr.org_id = s.org_id
     AND cr.source_type = 'fabric_stock_sale'
     AND cr.source_id = s.id
    WHERE s.org_id = v_org_id
      AND s.idempotency_key = v_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
      SELECT
        v_existing_sale.sale_id,
        v_existing_sale.dispatch_id,
        v_existing_sale.dispatch_number,
        v_existing_sale.dispatch_status,
        v_existing_sale.pending_dispatch_meters,
        v_existing_sale.receivable_id,
        v_existing_sale.party_id;
      RETURN;
    END IF;
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
      CASE WHEN COALESCE(p_credit_days, 30) > 365 THEN 365 ELSE COALESCE(p_credit_days, 30) END
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

  IF p_sale_date IS NULL THEN
    RAISE EXCEPTION 'Sale date is required';
  END IF;

  IF p_sold_takas IS NOT NULL AND p_sold_takas <= 0 THEN
    RAISE EXCEPTION 'Sold takas must be greater than 0 when provided';
  END IF;

  v_actual_dispatched_meters := CASE WHEN p_dispatch_now THEN COALESCE(p_actual_dispatched_meters, 0) ELSE 0 END;

  IF p_dispatch_now AND p_dispatch_date IS NULL THEN
    RAISE EXCEPTION 'Dispatch date is required';
  END IF;

  IF p_dispatch_now AND (v_actual_dispatched_meters <= 0 OR v_actual_dispatched_meters > p_sold_meters + 0.01) THEN
    RAISE EXCEPTION 'Dispatched meters must be greater than 0 and not more than sold meters';
  END IF;

  v_pending_dispatch_meters := p_sold_meters - v_actual_dispatched_meters;
  IF v_pending_dispatch_meters < -0.01 THEN
    RAISE EXCEPTION 'Dispatched meters cannot exceed sold meters';
  ELSIF ABS(v_pending_dispatch_meters) <= 0.01 THEN
    v_pending_dispatch_meters := 0;
  END IF;

  v_dispatch_status := CASE
    WHEN NOT p_dispatch_now THEN 'not_dispatched'
    WHEN v_pending_dispatch_meters > 0.01 THEN 'partially_dispatched'
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

  IF p_sold_takas IS NULL THEN
    IF v_lot.meters_per_taka IS NULL OR v_lot.meters_per_taka <= 0 THEN
      RAISE EXCEPTION 'Meters per taka snapshot is required when sold takas is not provided';
    END IF;
    v_sale_takas := ROUND(p_sold_meters / v_lot.meters_per_taka, 2);
  ELSE
    v_sale_takas := p_sold_takas;
  END IF;

  IF v_sale_takas <= 0 THEN
    RAISE EXCEPTION 'Sold takas must resolve to a positive value';
  END IF;

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
    idempotency_key,
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
    v_idempotency_key,
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

    v_gst_amount := ROUND((v_actual_dispatched_meters * p_sale_rate_per_meter) * 5 / 100, 2);
    v_tracking_token := rtrim(translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_'), '=');

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
      challan_number,
      tracking_token,
      idempotency_key
    ) VALUES (
      v_org_id,
      v_lot.order_id,
      v_sale.id,
      v_dispatch_number,
      v_actual_dispatched_meters,
      'in_transit',
      NULLIF(btrim(COALESCE(p_notes, '')), ''),
      p_dispatch_date::timestamptz,
      v_user_id,
      ROUND(v_actual_dispatched_meters * p_sale_rate_per_meter, 2),
      5,
      ROUND(v_gst_amount / 2, 2),
      ROUND(v_gst_amount / 2, 2),
      0,
      ROUND(v_actual_dispatched_meters * p_sale_rate_per_meter, 2) + v_gst_amount,
      ROUND(v_actual_dispatched_meters * p_sale_rate_per_meter, 2) + v_gst_amount > 50000,
      NULLIF(btrim(COALESCE(p_vehicle_number, '')), ''),
      NULLIF(btrim(COALESCE(p_transport_name, '')), ''),
      v_resolved_party_name,
      v_resolved_party_phone,
      v_resolved_party_city,
      NULLIF(btrim(COALESCE(p_challan_number, '')), ''),
      v_tracking_token,
      CASE WHEN v_idempotency_key IS NULL THEN NULL ELSE v_idempotency_key || ':dispatch' END
    )
    RETURNING id, dispatch_number INTO v_dispatch_id, v_dispatch_number;

    v_package_units := CEIL(v_sale_takas * (v_actual_dispatched_meters / p_sold_meters))::integer;
    IF v_package_units <= 0 THEN
      RAISE EXCEPTION 'Dispatch package units must be greater than 0';
    END IF;

    v_package_no := 'SS-' || upper(left(replace(v_sale.id::text, '-', ''), 8)) || '-' || upper(left(replace(v_dispatch_id::text, '-', ''), 8));

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
      v_lot.order_id,
      v_package_no,
      'bulk',
      v_package_units,
      v_actual_dispatched_meters,
      'Sold',
      'pass',
      'dispatched',
      v_lot.godown,
      v_sale.sale_date,
      'stock-sale:' || v_sale.id::text || ':dispatch:' || v_dispatch_id::text,
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
      v_lot.order_id,
      v_package_no,
      'bulk',
      v_package_units,
      'Sold',
      'pass',
      v_lot.godown,
      v_actual_dispatched_meters
    );

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

GRANT EXECUTE ON FUNCTION create_party_stock_sale_dispatch_v1(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, INTEGER,
  DATE, BOOLEAN, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT, UUID, TEXT
) TO authenticated, service_role;

DROP FUNCTION IF EXISTS create_stock_sale_dispatch(
  UUID, UUID, UUID[], NUMERIC[], NUMERIC[], DATE, TEXT, TEXT, TEXT, TEXT,
  TEXT, NUMERIC, TIMESTAMPTZ, UUID
);

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

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Cannot dispatch from a completed or cancelled order';
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

DROP FUNCTION IF EXISTS confirm_party_stock_sale_dispatch_v1(
  UUID, DATE, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT
);

CREATE OR REPLACE FUNCTION confirm_party_stock_sale_dispatch_v1(
  p_sale_id UUID,
  p_dispatch_date DATE,
  p_transport_name TEXT,
  p_vehicle_number TEXT,
  p_challan_number TEXT,
  p_dispatch_meters NUMERIC,
  p_dispatch_takas NUMERIC,
  p_notes TEXT,
  p_idempotency_key TEXT DEFAULT NULL
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
  v_existing_dispatch RECORD;
  v_dispatch_id UUID;
  v_dispatch_number INTEGER;
  v_due_date DATE;
  v_gst_amount NUMERIC;
  v_gst_percent NUMERIC := 5;
  v_total_invoice_value NUMERIC;
  v_eway_required BOOLEAN;
  v_package_id UUID;
  v_package_no TEXT;
  v_package_units INTEGER;
  v_tracking_token TEXT;
  v_new_pending NUMERIC;
  v_idempotency_key TEXT;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  PERFORM public.assert_org_not_locked(v_org_id);

  v_user_id := auth.uid();
  v_role := auth.jwt() ->> 'user_role';
  v_idempotency_key := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');

  IF v_org_id IS NULL OR v_user_id IS NULL OR v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can confirm party stock sale dispatches';
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT d.id, d.stock_sale_id, d.dispatch_number, s.due_date
      INTO v_existing_dispatch
    FROM dispatches d
    LEFT JOIN fabric_stock_sales s
      ON s.id = d.stock_sale_id
     AND s.org_id = d.org_id
    WHERE d.org_id = v_org_id
      AND d.idempotency_key = v_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      IF v_existing_dispatch.stock_sale_id IS DISTINCT FROM p_sale_id THEN
        RAISE EXCEPTION 'Duplicate dispatch request key was used for a different sale';
      END IF;

      RETURN QUERY
      SELECT v_existing_dispatch.id, v_existing_dispatch.dispatch_number, v_existing_dispatch.due_date;
      RETURN;
    END IF;
  END IF;

  IF p_dispatch_date IS NULL THEN
    RAISE EXCEPTION 'Dispatch date is required';
  END IF;

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

  IF v_sale.pending_dispatch_meters <= 0.01 THEN
    RAISE EXCEPTION 'Sale has already been fully dispatched';
  END IF;

  IF p_dispatch_meters <= 0 OR p_dispatch_meters > v_sale.pending_dispatch_meters + 0.01 THEN
    RAISE EXCEPTION 'Invalid dispatch meters. Must be between 0 and %', v_sale.pending_dispatch_meters;
  END IF;

  IF p_dispatch_takas IS NOT NULL AND p_dispatch_takas <= 0 THEN
    RAISE EXCEPTION 'Dispatch units must be greater than 0';
  END IF;

  v_new_pending := v_sale.pending_dispatch_meters - p_dispatch_meters;
  IF v_new_pending < -0.01 THEN
    RAISE EXCEPTION 'Dispatch meters cannot exceed pending meters';
  ELSIF ABS(v_new_pending) <= 0.01 THEN
    v_new_pending := 0;
  END IF;

  v_due_date := p_dispatch_date + COALESCE(v_sale.credit_days, 0);

  v_gst_amount := ROUND((p_dispatch_meters * v_sale.price_per_meter) * v_gst_percent / 100, 2);
  v_total_invoice_value := ROUND(p_dispatch_meters * v_sale.price_per_meter, 2) + v_gst_amount;
  v_eway_required := v_total_invoice_value > 50000;

  SELECT COALESCE(MAX(d.dispatch_number), 0) + 1
    INTO v_dispatch_number
  FROM dispatches d
  WHERE d.org_id = v_org_id
    AND d.order_id IS NULL;

  v_tracking_token := rtrim(translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_'), '=');

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
    challan_number,
    tracking_token,
    idempotency_key
  ) VALUES (
    v_org_id,
    v_sale.order_id,
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
    NULLIF(btrim(COALESCE(p_challan_number, '')), ''),
    v_tracking_token,
    v_idempotency_key
  )
  RETURNING id, dispatch_number INTO v_dispatch_id, v_dispatch_number;

  IF p_dispatch_takas IS NULL THEN
    IF v_sale.meters_sold <= 0 OR v_sale.taka_sold <= 0 THEN
      RAISE EXCEPTION 'Cannot derive dispatch units for this sale';
    END IF;
    v_package_units := CEIL((p_dispatch_meters / v_sale.meters_sold) * v_sale.taka_sold)::integer;
  ELSE
    v_package_units := CEIL(p_dispatch_takas)::integer;
  END IF;

  IF v_package_units <= 0 THEN
    RAISE EXCEPTION 'Dispatch package units must be greater than 0';
  END IF;

  v_package_no := 'SS-' || upper(left(replace(v_sale.id::text, '-', ''), 8)) || '-' || upper(left(replace(v_dispatch_id::text, '-', ''), 8));

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
    v_package_no,
    'bulk',
    v_package_units,
    p_dispatch_meters,
    'Sold',
    'pass',
    'dispatched',
    v_sale.godown,
    v_sale.sale_date,
    'stock-sale:' || v_sale.id::text || ':dispatch:' || v_dispatch_id::text,
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
    v_package_no,
    'bulk',
    v_package_units,
    'Sold',
    'pass',
    v_sale.godown,
    p_dispatch_meters
  );

  UPDATE fabric_stock_sales
  SET
    dispatch_id = v_dispatch_id,
    dispatch_status = CASE
      WHEN v_new_pending = 0 THEN 'dispatched'
      ELSE 'partially_dispatched'
    END,
    dispatched_meters = COALESCE(dispatched_meters, 0) + p_dispatch_meters,
    pending_dispatch_meters = v_new_pending,
    dispatch_date = p_dispatch_date,
    due_date = v_due_date,
    transport_name = NULLIF(btrim(COALESCE(p_transport_name, transport_name, '')), ''),
    vehicle_number = NULLIF(btrim(COALESCE(p_vehicle_number, vehicle_number, '')), ''),
    challan_number = NULLIF(btrim(COALESCE(p_challan_number, challan_number, '')), ''),
    notes = NULLIF(btrim(COALESCE(p_notes, notes, '')), '')
  WHERE id = v_sale.id
    AND org_id = v_org_id;

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

GRANT EXECUTE ON FUNCTION confirm_party_stock_sale_dispatch_v1(
  UUID, DATE, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT
) TO authenticated, service_role;

DROP FUNCTION IF EXISTS confirm_stock_sale_dispatch_receipt_v1(UUID, NUMERIC);

CREATE OR REPLACE FUNCTION confirm_stock_sale_dispatch_receipt_v1(
  p_dispatch_id UUID,
  p_qty_received NUMERIC,
  p_receipt_note TEXT DEFAULT NULL
)
RETURNS TABLE (
  qty_received NUMERIC,
  shortage_meters NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispatch RECORD;
  v_sale RECORD;
  v_received NUMERIC(12,2);
  v_remaining NUMERIC(12,2);
  v_line_received NUMERIC(12,2);
  v_line_shortage NUMERIC(12,2);
  v_shortage NUMERIC(12,2);
  v_party_id UUID;
  v_user_id UUID;
  v_org_id UUID;
  v_receipt_status TEXT;
  rec RECORD;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  PERFORM public.assert_org_not_locked(v_org_id);

  v_user_id := auth.uid();

  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT d.*
    INTO v_dispatch
  FROM dispatches d
  WHERE d.id = p_dispatch_id
    AND d.order_id IS NULL
    AND d.org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispatch not found';
  END IF;

  v_received := COALESCE(p_qty_received, v_dispatch.qty_meters_sent);
  IF v_received <= 0 THEN
    RAISE EXCEPTION 'Enter a valid received quantity greater than 0';
  END IF;

  IF v_dispatch.status <> 'in_transit' THEN
    IF v_dispatch.status = 'delivered'
      AND v_dispatch.qty_meters_received IS NOT NULL
      AND ABS(v_dispatch.qty_meters_received - v_received) <= 0.01 THEN
      RETURN QUERY
      SELECT v_dispatch.qty_meters_received, v_dispatch.qty_meters_sent - v_dispatch.qty_meters_received;
      RETURN;
    END IF;

    RAISE EXCEPTION 'This batch has already been confirmed';
  END IF;

  SELECT s.*, l.quality_label
    INTO v_sale
  FROM fabric_stock_sales s
  JOIN fabric_stock_lots l ON l.id = s.stock_lot_id
  WHERE s.id = v_dispatch.stock_sale_id
    AND s.org_id = v_org_id;

  SELECT p.id
    INTO v_party_id
  FROM parties p
  WHERE p.org_id = v_org_id
    AND lower(trim(p.name)) = lower(trim(v_dispatch.party_name))
  ORDER BY p.created_at
  LIMIT 1;

  v_receipt_status := CASE
    WHEN ABS(v_received - v_dispatch.qty_meters_sent) <= 0.01 THEN 'matched'
    ELSE 'difference_reported'
  END;

  UPDATE dispatches
  SET status = 'delivered',
      qty_meters_received = v_received,
      received_meters = v_received,
      received_note = NULLIF(btrim(COALESCE(p_receipt_note, received_note, '')), ''),
      receipt_status = v_receipt_status,
      received_at = NOW()
  WHERE id = p_dispatch_id;

  IF v_sale.id IS NOT NULL THEN
    UPDATE fabric_stock_sales
    SET dispatch_status = CASE
      WHEN pending_dispatch_meters > 0.01 THEN 'partially_dispatched'
      WHEN EXISTS (
        SELECT 1
        FROM dispatches d
        WHERE d.org_id = v_org_id
          AND d.stock_sale_id = v_sale.id
          AND d.id <> p_dispatch_id
          AND d.status <> 'delivered'
      ) THEN 'dispatched'
      ELSE 'received'
    END
    WHERE id = v_sale.id;
  END IF;

  v_remaining := v_received;

  FOR rec IN
    SELECT dpl.id, dpl.package_id, dpl.package_no, dpl.qty_meters_sent
    FROM dispatch_package_lines dpl
    WHERE dpl.dispatch_id = p_dispatch_id
    ORDER BY dpl.created_at, dpl.package_no
  LOOP
    IF v_remaining <= 0 THEN
      v_line_received := 0;
    ELSIF v_remaining >= rec.qty_meters_sent THEN
      v_line_received := rec.qty_meters_sent;
    ELSE
      v_line_received := v_remaining;
    END IF;

    v_line_shortage := rec.qty_meters_sent - v_line_received;

    UPDATE dispatch_package_lines
    SET qty_meters_received = v_line_received
    WHERE id = rec.id;

    UPDATE fabric_packages
    SET stock_state = CASE
        WHEN v_line_shortage > 0.01 THEN 'claimed'
        ELSE 'dispatched'
      END,
      updated_at = NOW()
    WHERE id = rec.package_id;

    IF v_line_shortage > 0.01 AND v_party_id IS NOT NULL THEN
      UPDATE party_dispatch_claims
      SET
        claim_status = 'open',
        shortage_meters = v_line_shortage,
        notes = 'Short receipt on package ' || rec.package_no
      WHERE dispatch_id = p_dispatch_id
        AND package_line_id = rec.id
        AND claim_type = 'shortage';

      IF NOT FOUND THEN
        INSERT INTO party_dispatch_claims (
          org_id, party_id, order_id, dispatch_id, package_id, package_line_id,
          claim_type, claim_status, claim_date, shortage_meters, amount, notes, created_by
        ) VALUES (
          v_org_id, v_party_id, NULL, p_dispatch_id, rec.package_id, rec.id,
          'shortage', 'open', CURRENT_DATE, v_line_shortage, NULL,
          'Short receipt on package ' || rec.package_no, v_user_id
        );
      END IF;
    END IF;

    v_remaining := v_remaining - rec.qty_meters_sent;
    IF ABS(v_remaining) <= 0.01 THEN
      v_remaining := 0;
    END IF;
  END LOOP;

  v_shortage := v_dispatch.qty_meters_sent - v_received;

  IF ABS(v_shortage) > 0.01 THEN
    INSERT INTO stock_discrepancies (
      org_id, dispatch_id, stock_sale_id, market_run_id, order_id, quality_label,
      expected_meters, actual_dispatched_meters, actual_received_meters, difference_meters,
      discrepancy_type, source_reference, discrepancy_date, notes, status, created_by
    ) VALUES (
      v_org_id, p_dispatch_id, v_sale.id, NULL, NULL, v_sale.quality_label,
      v_dispatch.qty_meters_sent, v_received, v_received, v_received - v_dispatch.qty_meters_sent,
      CASE WHEN v_received < v_dispatch.qty_meters_sent THEN 'shortage' ELSE 'excess' END,
      'dispatch_receipt', CURRENT_DATE,
      CASE WHEN v_received < v_dispatch.qty_meters_sent THEN 'Shortage found during dispatch reconciliation.' ELSE 'Excess found during dispatch reconciliation.' END,
      'needs_review', v_user_id
    )
    ON CONFLICT (dispatch_id, source_reference)
      WHERE source_reference = 'dispatch_receipt'
    DO UPDATE SET
      stock_sale_id = EXCLUDED.stock_sale_id,
      expected_meters = EXCLUDED.expected_meters,
      actual_dispatched_meters = EXCLUDED.actual_dispatched_meters,
      actual_received_meters = EXCLUDED.actual_received_meters,
      difference_meters = EXCLUDED.difference_meters,
      discrepancy_type = EXCLUDED.discrepancy_type,
      status = 'needs_review',
      notes = EXCLUDED.notes;
  END IF;

  RETURN QUERY
  SELECT v_received, v_shortage;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_stock_sale_dispatch_receipt_v1(UUID, NUMERIC, TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION confirm_fabric_dispatch_receipt(
  p_dispatch_id UUID,
  p_tracking_token TEXT,
  p_qty_received NUMERIC
)
RETURNS TABLE (
  qty_received NUMERIC,
  shortage_meters NUMERIC
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_dispatch RECORD;
  v_order RECORD;
  v_received NUMERIC(10,2);
  v_remaining NUMERIC(10,2);
  v_line_received NUMERIC(10,2);
  v_line_shortage NUMERIC(10,2);
  v_shortage NUMERIC(10,2);
  v_party_id UUID;
  v_receipt_status TEXT;
  rec RECORD;
BEGIN
  SELECT d.id, d.org_id, d.order_id, d.status, d.qty_meters_sent, d.qty_meters_received
    INTO v_dispatch
  FROM dispatches d
  JOIN orders o ON o.id = d.order_id
  WHERE d.id = p_dispatch_id
    AND o.tracking_token = p_tracking_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid tracking link';
  END IF;

  v_received := COALESCE(p_qty_received, v_dispatch.qty_meters_sent);
  IF v_received <= 0 THEN
    RAISE EXCEPTION 'Enter a valid received quantity greater than 0';
  END IF;

  IF v_dispatch.status <> 'in_transit' THEN
    IF v_dispatch.status = 'delivered'
      AND v_dispatch.qty_meters_received IS NOT NULL
      AND ABS(v_dispatch.qty_meters_received - v_received) <= 0.01 THEN
      RETURN QUERY
      SELECT v_dispatch.qty_meters_received, v_dispatch.qty_meters_sent - v_dispatch.qty_meters_received;
      RETURN;
    END IF;

    RAISE EXCEPTION 'This batch has already been confirmed';
  END IF;

  SELECT o.id, o.party_id, o.party_name, o.market_run_id, o.quality_label
    INTO v_order
  FROM orders o
  WHERE o.id = v_dispatch.order_id;

  v_party_id := v_order.party_id;
  IF v_party_id IS NULL THEN
    SELECT p.id
      INTO v_party_id
    FROM parties p
    WHERE p.org_id = v_dispatch.org_id
      AND lower(trim(p.name)) = lower(trim(v_order.party_name))
    ORDER BY p.created_at
    LIMIT 1;
  END IF;

  v_receipt_status := CASE
    WHEN ABS(v_received - v_dispatch.qty_meters_sent) <= 0.01 THEN 'matched'
    ELSE 'difference_reported'
  END;

  UPDATE dispatches
  SET status = 'delivered',
      qty_meters_received = v_received,
      received_meters = v_received,
      receipt_status = v_receipt_status,
      received_at = NOW()
  WHERE id = p_dispatch_id;

  v_remaining := v_received;

  FOR rec IN
    SELECT dpl.id, dpl.package_id, dpl.package_no, dpl.qty_meters_sent
    FROM dispatch_package_lines dpl
    WHERE dpl.dispatch_id = p_dispatch_id
    ORDER BY dpl.created_at, dpl.package_no
  LOOP
    IF v_remaining <= 0 THEN
      v_line_received := 0;
    ELSIF v_remaining >= rec.qty_meters_sent THEN
      v_line_received := rec.qty_meters_sent;
    ELSE
      v_line_received := v_remaining;
    END IF;

    v_line_shortage := rec.qty_meters_sent - v_line_received;

    UPDATE dispatch_package_lines
    SET qty_meters_received = v_line_received
    WHERE id = rec.id;

    UPDATE fabric_packages
    SET stock_state = CASE
        WHEN v_line_shortage > 0.01 THEN 'claimed'
        ELSE 'dispatched'
      END,
      updated_at = NOW()
    WHERE id = rec.package_id;

    IF v_line_shortage > 0.01 AND v_party_id IS NOT NULL THEN
      UPDATE party_dispatch_claims
      SET
        claim_status = 'open',
        shortage_meters = v_line_shortage,
        notes = 'Short receipt on package ' || rec.package_no
      WHERE dispatch_id = p_dispatch_id
        AND package_line_id = rec.id
        AND claim_type = 'shortage';

      IF NOT FOUND THEN
        INSERT INTO party_dispatch_claims (
          org_id, party_id, order_id, dispatch_id, package_id, package_line_id,
          claim_type, claim_status, claim_date, shortage_meters, amount, notes, created_by
        ) VALUES (
          v_dispatch.org_id, v_party_id, v_dispatch.order_id, p_dispatch_id, rec.package_id, rec.id,
          'shortage', 'open', CURRENT_DATE, v_line_shortage, NULL,
          'Short receipt on package ' || rec.package_no, NULL
        );
      END IF;
    END IF;

    v_remaining := v_remaining - rec.qty_meters_sent;
    IF ABS(v_remaining) <= 0.01 THEN
      v_remaining := 0;
    END IF;
  END LOOP;

  v_shortage := v_dispatch.qty_meters_sent - v_received;

  IF ABS(v_shortage) > 0.01 THEN
    INSERT INTO stock_discrepancies (
      org_id, dispatch_id, market_run_id, order_id, quality_label,
      expected_meters, actual_dispatched_meters, actual_received_meters, difference_meters,
      discrepancy_type, source_reference, discrepancy_date, notes, status, created_by
    ) VALUES (
      v_dispatch.org_id, p_dispatch_id, v_order.market_run_id, v_dispatch.order_id, v_order.quality_label,
      v_dispatch.qty_meters_sent, v_received, v_received, v_received - v_dispatch.qty_meters_sent,
      CASE WHEN v_received < v_dispatch.qty_meters_sent THEN 'shortage' ELSE 'excess' END,
      'dispatch_receipt', CURRENT_DATE,
      CASE WHEN v_received < v_dispatch.qty_meters_sent THEN 'Shortage found during dispatch reconciliation.' ELSE 'Excess found during dispatch reconciliation.' END,
      'needs_review', NULL
    )
    ON CONFLICT (dispatch_id, source_reference)
      WHERE source_reference = 'dispatch_receipt'
    DO UPDATE SET
      expected_meters = EXCLUDED.expected_meters,
      actual_dispatched_meters = EXCLUDED.actual_dispatched_meters,
      actual_received_meters = EXCLUDED.actual_received_meters,
      difference_meters = EXCLUDED.difference_meters,
      discrepancy_type = EXCLUDED.discrepancy_type,
      status = 'needs_review',
      notes = EXCLUDED.notes;
  END IF;

  RETURN QUERY
  SELECT v_received, v_shortage;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_fabric_dispatch_receipt(UUID, TEXT, NUMERIC)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION sync_stock_sale_dispatch_receipt_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stock_sale_id IS NOT NULL AND NEW.status = 'delivered' THEN
    UPDATE fabric_stock_sales s
    SET dispatch_status = CASE
      WHEN s.pending_dispatch_meters > 0.01 THEN 'partially_dispatched'
      WHEN EXISTS (
        SELECT 1
        FROM dispatches d
        WHERE d.org_id = s.org_id
          AND d.stock_sale_id = s.id
          AND d.id <> NEW.id
          AND d.status <> 'delivered'
      ) THEN 'dispatched'
      ELSE 'received'
    END
    WHERE s.id = NEW.stock_sale_id
      AND s.org_id = NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;
