-- Batch 3 dispatch-number RETURNING contract fix.
-- Replaces the active stock-sale dispatch RPCs after the tracking-token fix so
-- PL/pgSQL output parameters named dispatch_number do not collide with columns.

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
      CASE WHEN v_idempotency_key IS NULL THEN NULL ELSE v_idempotency_key || ':dispatch' END
    )
    RETURNING dispatches.id, dispatches.dispatch_number INTO v_dispatch_id, v_dispatch_number;

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
    v_idempotency_key
  )
  RETURNING dispatches.id, dispatches.dispatch_number INTO v_dispatch_id, v_dispatch_number;

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

CREATE OR REPLACE FUNCTION confirm_party_stock_sale_received_v1(
  p_sale_id UUID,
  p_dispatch_date DATE,
  p_transport_name TEXT,
  p_vehicle_number TEXT,
  p_challan_number TEXT,
  p_received_meters NUMERIC,
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

  IF v_sale.dispatch_id IS NOT NULL THEN
    RAISE EXCEPTION 'Sale has already been dispatched';
  END IF;

  -- 2. Calculate new due date starting from dispatch_date
  v_due_date := p_dispatch_date + COALESCE(v_sale.credit_days, 0);

  -- 3. Calculate GST and E-way bill requirement
  v_gst_amount := ROUND((v_sale.meters_sold * v_sale.price_per_meter) * v_gst_percent / 100, 2);
  v_total_invoice_value := ROUND(v_sale.meters_sold * v_sale.price_per_meter, 2) + v_gst_amount;
  v_eway_required := v_total_invoice_value > 50000;

  -- 4. Get next dispatch number for non-order dispatches
  SELECT COALESCE(MAX(d.dispatch_number), 0) + 1
    INTO v_dispatch_number
  FROM dispatches d
  WHERE d.org_id = v_org_id
    AND d.order_id IS NULL;

  -- 5. Insert dispatch (status = 'delivered', qty_meters_received = p_received_meters)
  INSERT INTO dispatches (
    org_id,
    order_id,
    stock_sale_id,
    dispatch_number,
    qty_meters_sent,
    qty_meters_received,
    receipt_confirmed_by_owner,
    receipt_confirmed_by,
    received_at,
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
    v_sale.meters_sold,
    p_received_meters,
    true,
    v_user_id,
    NOW(),
    'delivered',
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    p_dispatch_date::timestamptz,
    v_user_id,
    ROUND(v_sale.meters_sold * v_sale.price_per_meter, 2),
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

  -- 6. Insert package for tracking
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
    'SS-' || upper(left(replace(v_sale.id::text, '-', ''), 8)),
    'bulk',
    GREATEST(1, v_sale.taka_sold::integer),
    v_sale.meters_sold,
    'Sold',
    'pass',
    'dispatched',
    v_sale.godown,
    v_sale.sale_date,
    'stock-sale:' || v_sale.id::text,
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
    qty_meters_sent,
    qty_meters_received
  ) VALUES (
    v_org_id,
    v_dispatch_id,
    v_package_id,
    v_sale.order_id,
    'SS-' || upper(left(replace(v_sale.id::text, '-', ''), 8)),
    'bulk',
    GREATEST(1, v_sale.taka_sold::integer),
    'Sold',
    'pass',
    v_sale.godown,
    v_sale.meters_sold,
    p_received_meters
  );

  -- 7. Update sale details (dispatch_status = 'received', dispatched_meters = sold_meters)
  UPDATE fabric_stock_sales
  SET
    dispatch_id = v_dispatch_id,
    dispatch_status = 'received',
    dispatched_meters = v_sale.meters_sold,
    pending_dispatch_meters = 0,
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

GRANT EXECUTE ON FUNCTION confirm_party_stock_sale_received_v1(UUID, DATE, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated, service_role;
