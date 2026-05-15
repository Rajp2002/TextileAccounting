-- Phase 1 market-run stock workflow:
-- production creates expected godown ledger stock; dispatch checks reality.

CREATE TABLE IF NOT EXISTS stock_discrepancies (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dispatch_id                UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  market_run_id              UUID REFERENCES market_runs(id) ON DELETE SET NULL,
  order_id                   UUID REFERENCES orders(id) ON DELETE SET NULL,
  stock_lot_id               UUID REFERENCES fabric_stock_lots(id) ON DELETE SET NULL,
  quality_label              TEXT,
  expected_meters            NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_dispatched_meters   NUMERIC(12,2) NOT NULL DEFAULT 0,
  difference_meters          NUMERIC(12,2) NOT NULL DEFAULT 0,
  discrepancy_type           TEXT NOT NULL DEFAULT 'shortage'
                               CHECK (discrepancy_type IN ('shortage','excess')),
  source_reference           TEXT,
  supervisor_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  machine_id                 UUID REFERENCES machines(id) ON DELETE SET NULL,
  discrepancy_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  notes                      TEXT,
  status                     TEXT NOT NULL DEFAULT 'needs_review'
                               CHECK (status IN ('needs_review','resolved','written_off')),
  resolved_at                TIMESTAMPTZ,
  resolved_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_discrepancies_org_status
  ON stock_discrepancies(org_id, status, discrepancy_date DESC);

CREATE INDEX IF NOT EXISTS idx_stock_discrepancies_dispatch
  ON stock_discrepancies(dispatch_id)
  WHERE dispatch_id IS NOT NULL;

ALTER TABLE stock_discrepancies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_discrepancies_owner_select" ON stock_discrepancies;
CREATE POLICY "stock_discrepancies_owner_select"
  ON stock_discrepancies FOR SELECT
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "stock_discrepancies_owner_insert" ON stock_discrepancies;
CREATE POLICY "stock_discrepancies_owner_insert"
  ON stock_discrepancies FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "stock_discrepancies_owner_update" ON stock_discrepancies;
CREATE POLICY "stock_discrepancies_owner_update"
  ON stock_discrepancies FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

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
  v_status TEXT;
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

  IF v_source_type = 'market_run' THEN
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
        v_org_id, v_source_type, v_order.market_run_id, p_order_id, NULL, v_quality_label,
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
        v_org_id, v_quality_label, v_godown, 'market_run', v_order.market_run_id, p_order_id, NULL,
        v_unit_count, v_unit_count, v_meters_per_unit, v_unit_label,
        v_meters, v_meters, 'sellable', v_cost_per_meter,
        p_source_date, p_source_date, p_source_shift,
        'Expected stock from production ledger; not physically inward-confirmed.',
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
      quote_id = NULL,
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
    RETURN;
  END IF;

  INSERT INTO fabric_stock_inward_drafts (
    org_id, source_type, market_run_id, order_id, quote_id, quality_label,
    source_date, source_shift, suggested_meters, suggested_unit_count,
    meters_per_unit, unit_label, cost_per_meter, suggested_godown, created_by
  ) VALUES (
    v_org_id, v_source_type, v_order.market_run_id, p_order_id, v_quote_id, v_quality_label,
    p_source_date, p_source_shift, v_meters, v_unit_count,
    v_meters_per_unit, v_unit_label, v_cost_per_meter, v_godown, auth.uid()
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
  rec RECORD;
BEGIN
  SELECT d.id, d.org_id, d.order_id, d.status, d.qty_meters_sent
    INTO v_dispatch
  FROM dispatches d
  JOIN orders o ON o.id = d.order_id
  WHERE d.id = p_dispatch_id
    AND o.tracking_token = p_tracking_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid tracking link';
  END IF;

  IF v_dispatch.status <> 'in_transit' THEN
    RAISE EXCEPTION 'This batch has already been confirmed';
  END IF;

  v_received := COALESCE(p_qty_received, v_dispatch.qty_meters_sent);
  IF v_received < 0 THEN
    RAISE EXCEPTION 'Enter a valid received quantity';
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

  UPDATE dispatches
  SET status = 'delivered',
      qty_meters_received = v_received,
      received_at = NOW()
  WHERE id = p_dispatch_id;

  v_remaining := v_received;

  FOR rec IN
    SELECT dpl.id, dpl.package_id, dpl.package_no, dpl.qty_meters_sent
    FROM dispatch_package_lines dpl
    WHERE dpl.dispatch_id = p_dispatch_id
    ORDER BY dpl.created_at, dpl.package_no
  LOOP
    v_line_received := LEAST(rec.qty_meters_sent, GREATEST(v_remaining, 0));
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
      INSERT INTO party_dispatch_claims (
        org_id, party_id, order_id, dispatch_id, package_id, package_line_id,
        claim_type, claim_status, claim_date, shortage_meters, amount, notes, created_by
      ) VALUES (
        v_dispatch.org_id, v_party_id, v_dispatch.order_id, p_dispatch_id, rec.package_id, rec.id,
        'shortage', 'open', CURRENT_DATE, v_line_shortage, NULL,
        'Short receipt on package ' || rec.package_no, NULL
      );
    END IF;

    v_remaining := GREATEST(v_remaining - rec.qty_meters_sent, 0);
  END LOOP;

  v_shortage := v_dispatch.qty_meters_sent - v_received;

  IF ABS(v_shortage) > 0.01 THEN
    INSERT INTO stock_discrepancies (
      org_id, dispatch_id, market_run_id, order_id, quality_label,
      expected_meters, actual_dispatched_meters, difference_meters,
      discrepancy_type, source_reference, discrepancy_date, notes, status, created_by
    ) VALUES (
      v_dispatch.org_id, p_dispatch_id, v_order.market_run_id, v_dispatch.order_id, v_order.quality_label,
      v_dispatch.qty_meters_sent, v_received, v_received - v_dispatch.qty_meters_sent,
      CASE WHEN v_received < v_dispatch.qty_meters_sent THEN 'shortage' ELSE 'excess' END,
      'dispatch_receipt', CURRENT_DATE,
      CASE WHEN v_received < v_dispatch.qty_meters_sent THEN 'Shortage found during dispatch reconciliation.' ELSE 'Excess found during dispatch reconciliation.' END,
      'needs_review', NULL
    );
  END IF;

  RETURN QUERY
  SELECT v_received, v_shortage;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_fabric_dispatch_receipt(UUID, TEXT, NUMERIC) TO authenticated, service_role;
