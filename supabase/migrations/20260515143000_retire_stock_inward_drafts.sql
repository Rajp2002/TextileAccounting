-- Retire stock inward drafts as an owner-facing workflow.
-- Production continues to create expected godown stock, but no owner review queue is created.

UPDATE fabric_stock_inward_drafts
SET
  status = 'dismissed',
  notes = COALESCE(notes, 'Retired stock inward workflow; expected stock is handled by production ledger.'),
  updated_at = NOW()
WHERE status = 'pending';

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
  v_draft fabric_stock_inward_drafts%ROWTYPE;
  v_draft_id UUID;
  v_stock_lot_id UUID;
  v_unit_count NUMERIC;
  v_previous_meters NUMERIC := 0;
  v_delta_meters NUMERIC := 0;
  v_delta_units NUMERIC := 0;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  v_role := auth.jwt() ->> 'user_role';

  IF v_role NOT IN ('owner','supervisor') THEN
    RAISE EXCEPTION 'Only owners or supervisors can prepare expected stock';
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
  v_meters_per_unit := COALESCE(v_order.stock_meters_per_unit, 100);
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
      v_meters_per_unit := COALESCE(v_market_run.stock_meters_per_unit, v_meters_per_unit, 100);
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

  v_unit_count := ROUND(v_meters / NULLIF(v_meters_per_unit, 0), 2);

  SELECT *
    INTO v_draft
  FROM fabric_stock_inward_drafts
  WHERE org_id = v_org_id
    AND order_id = p_order_id
    AND source_date = p_source_date
    AND source_shift = p_source_shift
  FOR UPDATE;

  IF FOUND THEN
    v_draft_id := v_draft.id;
    v_previous_meters := COALESCE(v_draft.suggested_meters, 0);
    v_stock_lot_id := v_draft.confirmed_stock_lot_id;
  ELSE
    INSERT INTO fabric_stock_inward_drafts (
      org_id, source_type, market_run_id, order_id, quote_id, quality_label,
      source_date, source_shift, suggested_meters, suggested_unit_count,
      meters_per_unit, unit_label, cost_per_meter, suggested_godown,
      status, confirmed_by, confirmed_at, created_by
    ) VALUES (
      v_org_id, v_source_type, v_order.market_run_id, p_order_id, v_quote_id, v_quality_label,
      p_source_date, p_source_shift, v_meters, v_unit_count,
      v_meters_per_unit, v_unit_label, v_cost_per_meter, v_godown,
      'confirmed', auth.uid(), NOW(), auth.uid()
    )
    RETURNING id, confirmed_stock_lot_id
    INTO v_draft_id, v_stock_lot_id;
  END IF;

  v_delta_meters := ROUND(v_meters - v_previous_meters, 2);
  v_delta_units := ROUND(v_delta_meters / NULLIF(v_meters_per_unit, 0), 2);

  IF v_stock_lot_id IS NULL THEN
    INSERT INTO fabric_stock_lots (
      org_id, quality_label, godown, source_type, market_run_id, order_id, quote_id,
      original_taka_count, available_taka_count, meters_per_taka, unit_label,
      original_meters, available_meters, stock_purpose, cost_per_meter,
      received_date, source_date, source_shift, notes, created_by
    ) VALUES (
      v_org_id, v_quality_label, v_godown, v_source_type, v_order.market_run_id, p_order_id, v_quote_id,
      v_unit_count, v_unit_count, v_meters_per_unit, v_unit_label,
      v_meters, v_meters,
      CASE WHEN v_source_type = 'market_run' THEN 'sellable' ELSE 'order_reserved' END,
      v_cost_per_meter,
      p_source_date, p_source_date, p_source_shift,
      'Expected stock from production ledger; physical stock is checked at dispatch.',
      auth.uid()
    )
    RETURNING id INTO v_stock_lot_id;

    v_delta_meters := v_meters;
    v_delta_units := v_unit_count;
  ELSIF ABS(v_delta_meters) > 0.01 THEN
    UPDATE fabric_stock_lots
    SET
      original_taka_count = GREATEST(0, original_taka_count + v_delta_units),
      available_taka_count = GREATEST(0, available_taka_count + v_delta_units),
      original_meters = GREATEST(0, original_meters + v_delta_meters),
      available_meters = GREATEST(0, available_meters + v_delta_meters),
      updated_at = NOW()
    WHERE id = v_stock_lot_id
      AND org_id = v_org_id;
  END IF;

  UPDATE fabric_stock_inward_drafts
  SET
    source_type = v_source_type,
    market_run_id = v_order.market_run_id,
    quote_id = v_quote_id,
    quality_label = v_quality_label,
    suggested_meters = v_meters,
    suggested_unit_count = v_unit_count,
    meters_per_unit = v_meters_per_unit,
    unit_label = v_unit_label,
    cost_per_meter = v_cost_per_meter,
    suggested_godown = v_godown,
    status = 'confirmed',
    confirmed_stock_lot_id = v_stock_lot_id,
    confirmed_by = COALESCE(confirmed_by, auth.uid()),
    confirmed_at = COALESCE(confirmed_at, NOW()),
    notes = 'Expected stock from production ledger; physical stock is checked at dispatch.',
    updated_at = NOW()
  WHERE id = v_draft_id;

  IF ABS(v_delta_meters) > 0.01 THEN
    INSERT INTO fabric_stock_movements (
      org_id, stock_lot_id, movement_type, movement_date, taka_delta,
      meters_delta, reference, notes, created_by
    ) VALUES (
      v_org_id, v_stock_lot_id,
      CASE WHEN v_delta_meters >= 0 THEN 'inward' ELSE 'adjustment_subtract' END,
      p_source_date, v_delta_units, v_delta_meters,
      'Expected production ledger',
      'Production created expected stock; physical reconciliation happens at dispatch.',
      auth.uid()
    );
  END IF;

  RETURN QUERY SELECT v_draft_id, v_meters, 'expected_stock'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION create_or_refresh_stock_inward_draft(UUID, DATE, TEXT)
  TO authenticated, service_role;
