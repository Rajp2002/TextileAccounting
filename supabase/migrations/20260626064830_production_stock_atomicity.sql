-- Batch 2: production replacement and generated stock reconciliation must
-- commit or roll back together. The deterministic generated-stock grain is
-- fabric_stock_inward_drafts(org_id, order_id, source_date, source_shift).

CREATE OR REPLACE FUNCTION reconcile_generated_stock_for_production_grain(
  p_org_id UUID,
  p_order_id UUID,
  p_source_date DATE,
  p_source_shift TEXT,
  p_actor_id UUID
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
  v_order RECORD;
  v_quote RECORD;
  v_market_run RECORD;
  v_draft fabric_stock_inward_drafts%ROWTYPE;
  v_lot fabric_stock_lots%ROWTYPE;
  v_draft_id UUID;
  v_stock_lot_id UUID;
  v_source_type TEXT;
  v_stock_purpose TEXT;
  v_quality_label TEXT;
  v_quote_id UUID;
  v_cost_per_meter NUMERIC := 0;
  v_meters_per_unit NUMERIC;
  v_unit_label TEXT;
  v_godown TEXT;
  v_meters NUMERIC := 0;
  v_unit_count NUMERIC := 0;
  v_previous_meters NUMERIC := 0;
  v_delta_meters NUMERIC := 0;
  v_delta_units NUMERIC := 0;
  v_sold_meters NUMERIC := 0;
  v_dispatched_meters NUMERIC := 0;
  v_has_dispatch BOOLEAN := FALSE;
  v_next_available_meters NUMERIC := 0;
  v_next_available_units NUMERIC := 0;
  v_next_original_meters NUMERIC := 0;
  v_next_original_units NUMERIC := 0;
  v_status TEXT;
BEGIN
  PERFORM public.assert_org_not_locked(p_org_id);

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
    AND o.org_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for generated stock reconciliation';
  END IF;

  SELECT ROUND(COALESCE(SUM(CASE WHEN pl.meters > 0 THEN pl.meters ELSE 0 END), 0), 2)
    INTO v_meters
  FROM production_logs pl
  WHERE pl.org_id = p_org_id
    AND pl.order_id = p_order_id
    AND pl.date = p_source_date
    AND pl.shift = p_source_shift;

  v_source_type := CASE WHEN v_order.market_run_id IS NOT NULL THEN 'market_run' ELSE 'order' END;
  v_stock_purpose := CASE WHEN v_source_type = 'market_run' THEN 'sellable' ELSE 'order_reserved' END;
  v_quality_label := COALESCE(NULLIF(BTRIM(v_order.quality_label), ''), NULLIF(BTRIM(v_order.party_name), ''), 'Produced Fabric');
  v_meters_per_unit := COALESCE(v_order.stock_meters_per_unit, 100);
  v_unit_label := COALESCE(NULLIF(BTRIM(v_order.stock_unit_label), ''), 'taka');
  v_godown := COALESCE(NULLIF(BTRIM(v_order.default_godown), ''), 'Main Godown');

  IF v_order.market_run_id IS NOT NULL THEN
    SELECT mr.cost_per_meter, mr.stock_meters_per_unit, mr.stock_unit_label, mr.default_godown
      INTO v_market_run
    FROM market_runs mr
    WHERE mr.id = v_order.market_run_id
      AND mr.org_id = p_org_id;

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
      AND q.org_id = p_org_id
    ORDER BY q.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_quote_id := v_quote.id;
      v_cost_per_meter := COALESCE(v_quote.landed_cost_per_meter, 0);
    END IF;
  END IF;

  v_unit_count := CASE
    WHEN v_meters > 0 THEN ROUND(v_meters / NULLIF(v_meters_per_unit, 0), 2)
    ELSE 0
  END;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_org_id::text || ':' || p_order_id::text || ':' || p_source_date::text || ':' || p_source_shift, 0)
  );

  SELECT *
    INTO v_draft
  FROM fabric_stock_inward_drafts
  WHERE org_id = p_org_id
    AND order_id = p_order_id
    AND source_date = p_source_date
    AND source_shift = p_source_shift
  FOR UPDATE;

  IF FOUND THEN
    v_draft_id := v_draft.id;
    v_stock_lot_id := v_draft.confirmed_stock_lot_id;
    v_previous_meters := CASE WHEN v_draft.status = 'confirmed' THEN COALESCE(v_draft.suggested_meters, 0) ELSE 0 END;
  ELSIF v_meters <= 0 THEN
    RETURN;
  ELSE
    INSERT INTO fabric_stock_inward_drafts (
      org_id, source_type, market_run_id, order_id, quote_id, quality_label,
      source_date, source_shift, suggested_meters, suggested_unit_count,
      meters_per_unit, unit_label, cost_per_meter, suggested_godown,
      status, confirmed_by, confirmed_at, created_by
    ) VALUES (
      p_org_id, v_source_type, v_order.market_run_id, p_order_id, v_quote_id, v_quality_label,
      p_source_date, p_source_shift, v_meters, v_unit_count,
      v_meters_per_unit, v_unit_label, v_cost_per_meter, v_godown,
      'confirmed', p_actor_id, NOW(), p_actor_id
    )
    RETURNING id, confirmed_stock_lot_id
    INTO v_draft_id, v_stock_lot_id;

    v_previous_meters := 0;
  END IF;

  IF v_stock_lot_id IS NOT NULL THEN
    SELECT *
      INTO v_lot
    FROM fabric_stock_lots
    WHERE id = v_stock_lot_id
      AND org_id = p_org_id
    FOR UPDATE;

    IF FOUND THEN
      SELECT
        COALESCE(SUM(s.meters_sold), 0),
        COALESCE(SUM(COALESCE(s.dispatched_meters, 0)), 0),
        COALESCE(BOOL_OR(
          COALESCE(s.dispatched_meters, 0) > 0
          OR s.dispatch_id IS NOT NULL
          OR s.dispatch_status IN ('partially_dispatched','dispatched','received','discrepancy')
          OR EXISTS (
            SELECT 1
            FROM dispatches d
            WHERE d.stock_sale_id = s.id
          )
        ), FALSE)
      INTO v_sold_meters, v_dispatched_meters, v_has_dispatch
      FROM fabric_stock_sales s
      WHERE s.stock_lot_id = v_lot.id
        AND s.org_id = p_org_id;
    ELSE
      v_stock_lot_id := NULL;
    END IF;
  END IF;

  v_delta_meters := ROUND(v_meters - v_previous_meters, 2);
  v_delta_units := ROUND(v_delta_meters / NULLIF(v_meters_per_unit, 0), 2);

  IF v_stock_lot_id IS NULL AND v_meters > 0 THEN
    INSERT INTO fabric_stock_lots (
      org_id, quality_label, godown, source_type, market_run_id, order_id, quote_id,
      original_taka_count, available_taka_count, meters_per_taka, unit_label,
      original_meters, available_meters, stock_purpose, cost_per_meter,
      received_date, source_date, source_shift, notes, created_by
    ) VALUES (
      p_org_id, v_quality_label, v_godown, v_source_type, v_order.market_run_id, p_order_id, v_quote_id,
      v_unit_count, v_unit_count, v_meters_per_unit, v_unit_label,
      v_meters, v_meters, v_stock_purpose, v_cost_per_meter,
      p_source_date, p_source_date, p_source_shift,
      'Expected stock from production ledger; physical stock is checked at dispatch.',
      p_actor_id
    )
    RETURNING id INTO v_stock_lot_id;

    v_delta_meters := v_meters;
    v_delta_units := v_unit_count;
  ELSIF v_stock_lot_id IS NOT NULL AND ABS(v_delta_meters) > 0.01 THEN
    IF v_has_dispatch THEN
      RAISE EXCEPTION 'Generated stock for this production has already been dispatched or received. Use an owner-authorized stock adjustment/manual resolution before changing production.';
    END IF;

    IF v_meters + 0.01 < v_sold_meters THEN
      RAISE EXCEPTION 'Generated stock for this production has already been sold/dispatched. Corrected production would be % m but % m is already sold; use owner adjustment/manual resolution.',
        v_meters, v_sold_meters;
    END IF;

    v_next_available_meters := ROUND(v_lot.available_meters + v_delta_meters, 2);
    v_next_available_units := ROUND(v_lot.available_taka_count + v_delta_units, 2);
    v_next_original_meters := ROUND(v_lot.original_meters + v_delta_meters, 2);
    v_next_original_units := ROUND(v_lot.original_taka_count + v_delta_units, 2);

    IF v_next_available_meters < 0 OR v_next_available_units < 0 OR v_next_original_meters < 0 OR v_next_original_units < 0 THEN
      RAISE EXCEPTION 'Generated stock for this production has already been sold/dispatched or adjusted. Use owner adjustment/manual resolution before changing production.';
    END IF;

    UPDATE fabric_stock_lots
    SET
      original_taka_count = v_next_original_units,
      available_taka_count = v_next_available_units,
      original_meters = v_next_original_meters,
      available_meters = v_next_available_meters,
      received_date = LEAST(received_date, p_source_date),
      source_date = p_source_date,
      source_shift = p_source_shift,
      updated_at = NOW()
    WHERE id = v_stock_lot_id
      AND org_id = p_org_id;
  END IF;

  IF v_draft_id IS NOT NULL THEN
    IF v_meters > 0 THEN
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
        confirmed_by = COALESCE(confirmed_by, p_actor_id),
        confirmed_at = COALESCE(confirmed_at, NOW()),
        notes = 'Expected stock from production ledger; physical stock is checked at dispatch.',
        updated_at = NOW()
      WHERE id = v_draft_id;

      v_status := 'expected_stock';
    ELSE
      UPDATE fabric_stock_inward_drafts
      SET
        status = 'dismissed',
        notes = 'Expected production stock reversed because current valid production for this order/date/shift is zero.',
        updated_at = NOW()
      WHERE id = v_draft_id;

      v_status := 'reversed';
    END IF;
  END IF;

  IF v_stock_lot_id IS NOT NULL AND ABS(v_delta_meters) > 0.01 THEN
    INSERT INTO fabric_stock_movements (
      org_id, stock_lot_id, movement_type, movement_date, taka_delta,
      meters_delta, reference, notes, created_by
    ) VALUES (
      p_org_id, v_stock_lot_id,
      CASE WHEN v_delta_meters >= 0 THEN 'inward' ELSE 'adjustment_subtract' END,
      p_source_date, v_delta_units, v_delta_meters,
      'Expected production ledger',
      CASE
        WHEN v_delta_meters >= 0 THEN 'Production created expected stock in the same transaction as production logs.'
        ELSE 'Production correction reversed generated expected stock in the same transaction as production logs.'
      END,
      p_actor_id
    );
  END IF;

  RETURN QUERY SELECT v_draft_id, v_meters, COALESCE(v_status, 'no_stock')::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION reconcile_generated_stock_for_production_grain(UUID, UUID, DATE, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION reconcile_generated_stock_for_production_grain(UUID, UUID, DATE, TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION reconcile_generated_stock_for_production_grain(UUID, UUID, DATE, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION reconcile_generated_stock_for_production_grain(UUID, UUID, DATE, TEXT, UUID) TO service_role;

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
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  PERFORM public.assert_org_not_locked(v_org_id);

  v_role := auth.jwt() ->> 'user_role';

  IF v_role NOT IN ('owner','supervisor') THEN
    RAISE EXCEPTION 'Only owners or supervisors can prepare expected stock';
  END IF;

  RETURN QUERY
  SELECT r.draft_id, r.suggested_meters, r.status
  FROM reconcile_generated_stock_for_production_grain(
    v_org_id,
    p_order_id,
    p_source_date,
    p_source_shift,
    auth.uid()
  ) AS r;
END;
$$;

GRANT EXECUTE ON FUNCTION create_or_refresh_stock_inward_draft(UUID, DATE, TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION replace_shift_production_logs(
  p_logs JSONB,
  p_allow_overwrite BOOLEAN DEFAULT FALSE,
  p_access_code_used BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(inserted_count INT, replaced_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_role TEXT;
  v_date DATE;
  v_shift TEXT;
  v_replaced_count INT := 0;
  v_inserted_count INT := 0;
  v_grain RECORD;
BEGIN
  v_org_id := NULLIF(auth.jwt() ->> 'org_id', '')::uuid;
  PERFORM public.assert_org_not_locked(v_org_id);

  v_role := auth.jwt() ->> 'user_role';

  IF v_role NOT IN ('owner', 'supervisor') OR v_org_id IS NULL THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF JSONB_TYPEOF(p_logs) IS DISTINCT FROM 'array' OR JSONB_ARRAY_LENGTH(p_logs) = 0 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  DROP TABLE IF EXISTS pg_temp.weavly_shift_logs;
  CREATE TEMP TABLE weavly_shift_logs ON COMMIT DROP AS
  SELECT
    machine_id::uuid AS machine_id,
    worker_id::bigint AS worker_id,
    order_id::uuid AS order_id,
    meters::numeric AS meters,
    opening_meter_reading::numeric AS opening_meter_reading,
    closing_meter_reading::numeric AS closing_meter_reading,
    COALESCE(counter_was_reset, FALSE)::boolean AS counter_was_reset,
    shift::text AS shift,
    date::date AS date,
    worker_rate_snapshot::numeric AS worker_rate_snapshot,
    COALESCE(submitted_at, now())::timestamptz AS submitted_at,
    COALESCE(client_ip, 'unknown')::text AS client_ip,
    NULLIF(BTRIM(COALESCE(zero_meter_reason, '')), '')::text AS zero_meter_reason
  FROM JSONB_TO_RECORDSET(p_logs) AS x(
    machine_id text,
    worker_id bigint,
    order_id text,
    meters numeric,
    opening_meter_reading numeric,
    closing_meter_reading numeric,
    counter_was_reset boolean,
    shift text,
    date date,
    worker_rate_snapshot numeric,
    submitted_at timestamptz,
    client_ip text,
    zero_meter_reason text
  );

  SELECT MIN(date), MIN(shift)
  INTO v_date, v_shift
  FROM weavly_shift_logs;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    WHERE date IS DISTINCT FROM v_date
       OR shift IS DISTINCT FROM v_shift
  ) THEN
    RAISE EXCEPTION 'All production logs in one submission must share date and shift.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    GROUP BY machine_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate machine entries in one production submission.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':' || v_date::text || ':' || v_shift, 0)
  );

  DROP TABLE IF EXISTS pg_temp.weavly_affected_production_grains;
  CREATE TEMP TABLE weavly_affected_production_grains (
    org_id UUID NOT NULL,
    order_id UUID NOT NULL,
    source_date DATE NOT NULL,
    source_shift TEXT NOT NULL,
    PRIMARY KEY (org_id, order_id, source_date, source_shift)
  ) ON COMMIT DROP;

  INSERT INTO weavly_affected_production_grains (org_id, order_id, source_date, source_shift)
  SELECT DISTINCT pl.org_id, pl.order_id, pl.date, pl.shift
  FROM production_logs pl
  JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
  WHERE pl.org_id = v_org_id
    AND pl.date = v_date
    AND pl.shift = v_shift
    AND pl.order_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN machines m ON m.id = l.machine_id AND m.org_id = v_org_id
    WHERE m.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Machine not found for this organization.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN workers w ON w.id = l.worker_id AND w.org_id = v_org_id
    WHERE l.worker_id IS NOT NULL AND w.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Worker not found for this organization.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN orders o ON o.id = l.order_id AND o.org_id = v_org_id
    WHERE l.order_id IS NOT NULL AND o.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Order not found for this organization.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM weavly_shift_logs
    WHERE meters > 0
      AND (worker_id IS NULL OR order_id IS NULL OR COALESCE(worker_rate_snapshot, 0) <= 0)
  ) THEN
    RAISE EXCEPTION 'Production logs with meters > 0 require worker, order, and a valid rate.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM weavly_shift_logs
    WHERE meters = 0
      AND (zero_meter_reason IS NULL OR BTRIM(zero_meter_reason) = '')
  ) THEN
    RAISE EXCEPTION 'Zero-meter logs require a reason.';
  END IF;

  SELECT COUNT(*)
  INTO v_replaced_count
  FROM production_logs pl
  JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
  WHERE pl.org_id = v_org_id
    AND pl.date = v_date
    AND pl.shift = v_shift;

  IF v_replaced_count > 0 AND NOT p_allow_overwrite THEN
    RAISE EXCEPTION 'DUPLICATE_LOG_DETECTED';
  END IF;

  IF v_replaced_count > 0 THEN
    INSERT INTO audit_log (
      org_id,
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      is_access_code_used
    )
    SELECT
      v_org_id,
      'production_logs',
      v_date::text || ':' || v_shift,
      'shift_self_correction',
      JSONB_AGG(TO_JSONB(pl) ORDER BY pl.id),
      (SELECT JSONB_AGG(TO_JSONB(l) ORDER BY l.machine_id) FROM weavly_shift_logs l),
      auth.uid(),
      p_access_code_used
    FROM production_logs pl
    JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
    WHERE pl.org_id = v_org_id
      AND pl.date = v_date
      AND pl.shift = v_shift;

    DELETE FROM production_logs pl
    USING weavly_shift_logs l
    WHERE pl.org_id = v_org_id
      AND pl.date = v_date
      AND pl.shift = v_shift
      AND pl.machine_id = l.machine_id;
  END IF;

  INSERT INTO production_logs (
    org_id,
    machine_id,
    worker_id,
    order_id,
    meters,
    opening_meter_reading,
    closing_meter_reading,
    counter_was_reset,
    shift,
    date,
    worker_rate_snapshot,
    created_by,
    updated_by,
    submitted_at,
    client_ip,
    zero_meter_reason
  )
  SELECT
    v_org_id,
    machine_id,
    worker_id,
    order_id,
    meters,
    opening_meter_reading,
    closing_meter_reading,
    counter_was_reset,
    shift,
    date,
    worker_rate_snapshot,
    auth.uid(),
    auth.uid(),
    submitted_at,
    client_ip,
    CASE WHEN meters = 0 THEN zero_meter_reason ELSE NULL END
  FROM weavly_shift_logs;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  INSERT INTO weavly_affected_production_grains (org_id, order_id, source_date, source_shift)
  SELECT DISTINCT v_org_id, order_id, date, shift
  FROM weavly_shift_logs
  WHERE order_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  FOR v_grain IN
    SELECT org_id, order_id, source_date, source_shift
    FROM weavly_affected_production_grains
    ORDER BY source_date, source_shift, order_id
  LOOP
    PERFORM 1
    FROM reconcile_generated_stock_for_production_grain(
      v_grain.org_id,
      v_grain.order_id,
      v_grain.source_date,
      v_grain.source_shift,
      auth.uid()
    );
  END LOOP;

  RETURN QUERY SELECT v_inserted_count, v_replaced_count;
END;
$$;

GRANT EXECUTE ON FUNCTION replace_shift_production_logs(JSONB, BOOLEAN, BOOLEAN)
  TO authenticated, service_role;
