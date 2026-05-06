-- Group reviewed production inward into the same stock lot when the
-- source and cost basis are identical. Individual reviews remain auditable
-- through fabric_stock_movements and fabric_stock_inward_drafts.

CREATE INDEX IF NOT EXISTS idx_fabric_stock_lots_source_group
  ON fabric_stock_lots (
    org_id,
    source_type,
    order_id,
    market_run_id,
    quote_id,
    lower(btrim(quality_label)),
    lower(btrim(godown)),
    meters_per_taka,
    lower(btrim(unit_label)),
    stock_purpose,
    cost_per_meter
  );

-- Consolidate existing duplicate production lots that were already created
-- before this behavior changed.
CREATE TEMP TABLE duplicate_stock_lot_groups ON COMMIT DROP AS
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY
        org_id,
        source_type,
        COALESCE(order_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(market_run_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(quote_id, '00000000-0000-0000-0000-000000000000'::uuid),
        lower(btrim(quality_label)),
        lower(btrim(godown)),
        meters_per_taka,
        lower(btrim(unit_label)),
        stock_purpose,
        cost_per_meter
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id
  FROM fabric_stock_lots
  WHERE source_type IN ('order', 'market_run');

CREATE TEMP TABLE duplicate_stock_lot_totals ON COMMIT DROP AS
  SELECT
    dl.canonical_id,
    SUM(l.original_taka_count) AS original_taka_count,
    SUM(l.available_taka_count) AS available_taka_count,
    SUM(l.original_meters) AS original_meters,
    SUM(l.available_meters) AS available_meters,
    MIN(l.received_date) AS received_date,
    MIN(l.source_date) AS source_date,
    CASE WHEN COUNT(DISTINCT l.source_shift) = 1 THEN MIN(l.source_shift) ELSE NULL END AS source_shift
  FROM duplicate_stock_lot_groups dl
  JOIN fabric_stock_lots l ON l.id = dl.id
  GROUP BY dl.canonical_id
  HAVING COUNT(*) > 1;

UPDATE fabric_stock_sales s
SET stock_lot_id = dl.canonical_id
FROM duplicate_stock_lot_groups dl
WHERE s.stock_lot_id = dl.id
  AND dl.id <> dl.canonical_id;

UPDATE fabric_stock_movements m
SET stock_lot_id = dl.canonical_id
FROM duplicate_stock_lot_groups dl
WHERE m.stock_lot_id = dl.id
  AND dl.id <> dl.canonical_id;

UPDATE fabric_stock_inward_drafts d
SET confirmed_stock_lot_id = dl.canonical_id
FROM duplicate_stock_lot_groups dl
WHERE d.confirmed_stock_lot_id = dl.id
  AND dl.id <> dl.canonical_id;

UPDATE fabric_stock_lots l
SET
  original_taka_count = ct.original_taka_count,
  available_taka_count = ct.available_taka_count,
  original_meters = ct.original_meters,
  available_meters = ct.available_meters,
  received_date = ct.received_date,
  source_date = ct.source_date,
  source_shift = ct.source_shift,
  updated_at = NOW()
FROM duplicate_stock_lot_totals ct
WHERE l.id = ct.canonical_id;

DELETE FROM fabric_stock_lots l
USING duplicate_stock_lot_groups dl
WHERE l.id = dl.id
  AND dl.id <> dl.canonical_id;

CREATE OR REPLACE FUNCTION confirm_stock_inward_draft(
  p_draft_id UUID,
  p_actual_unit_count NUMERIC,
  p_meters_per_unit NUMERIC,
  p_godown TEXT,
  p_unit_label TEXT,
  p_notes TEXT
)
RETURNS TABLE (
  stock_lot_id UUID,
  original_meters NUMERIC,
  original_unit_count NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_role TEXT;
  v_draft fabric_stock_inward_drafts%ROWTYPE;
  v_stock_lot_id UUID;
  v_meters NUMERIC;
  v_unit_label TEXT;
  v_godown TEXT;
  v_stock_purpose TEXT;
  v_notes TEXT;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  v_role := auth.jwt() ->> 'user_role';

  IF v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can confirm stock inward';
  END IF;

  IF p_actual_unit_count IS NULL OR p_actual_unit_count <= 0 THEN
    RAISE EXCEPTION 'Unit count must be greater than zero';
  END IF;

  IF p_meters_per_unit IS NULL OR p_meters_per_unit <= 0 THEN
    RAISE EXCEPTION 'Meters per unit must be greater than zero';
  END IF;

  SELECT *
    INTO v_draft
  FROM fabric_stock_inward_drafts
  WHERE id = p_draft_id
    AND org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending inward not found';
  END IF;

  IF v_draft.status <> 'pending' THEN
    RAISE EXCEPTION 'This inward has already been %', v_draft.status;
  END IF;

  v_unit_label := COALESCE(NULLIF(BTRIM(p_unit_label), ''), v_draft.unit_label, 'taka');
  v_godown := COALESCE(NULLIF(BTRIM(p_godown), ''), v_draft.suggested_godown, 'Main Godown');
  v_meters := ROUND(p_actual_unit_count * p_meters_per_unit, 2);
  v_stock_purpose := CASE WHEN v_draft.source_type = 'market_run' THEN 'sellable' ELSE 'order_reserved' END;
  v_notes := NULLIF(BTRIM(COALESCE(p_notes, '')), '');

  PERFORM pg_advisory_xact_lock(
    hashtext(v_org_id::text),
    hashtext(concat_ws(
      '|',
      v_draft.source_type,
      COALESCE(v_draft.order_id::text, ''),
      COALESCE(v_draft.market_run_id::text, ''),
      COALESCE(v_draft.quote_id::text, ''),
      lower(btrim(v_draft.quality_label)),
      lower(btrim(v_godown)),
      p_meters_per_unit::text,
      lower(btrim(v_unit_label)),
      v_stock_purpose,
      v_draft.cost_per_meter::text
    ))
  );

  SELECT l.id
    INTO v_stock_lot_id
  FROM fabric_stock_lots l
  WHERE l.org_id = v_org_id
    AND l.source_type = v_draft.source_type
    AND l.order_id IS NOT DISTINCT FROM v_draft.order_id
    AND l.market_run_id IS NOT DISTINCT FROM v_draft.market_run_id
    AND l.quote_id IS NOT DISTINCT FROM v_draft.quote_id
    AND lower(btrim(l.quality_label)) = lower(btrim(v_draft.quality_label))
    AND lower(btrim(l.godown)) = lower(btrim(v_godown))
    AND l.meters_per_taka = p_meters_per_unit
    AND lower(btrim(l.unit_label)) = lower(btrim(v_unit_label))
    AND l.stock_purpose = v_stock_purpose
    AND l.cost_per_meter = v_draft.cost_per_meter
  ORDER BY l.created_at ASC, l.id ASC
  LIMIT 1
  FOR UPDATE;

  IF v_stock_lot_id IS NULL THEN
    INSERT INTO fabric_stock_lots (
      org_id,
      quality_label,
      godown,
      source_type,
      market_run_id,
      order_id,
      quote_id,
      original_taka_count,
      available_taka_count,
      meters_per_taka,
      unit_label,
      original_meters,
      available_meters,
      stock_purpose,
      cost_per_meter,
      received_date,
      source_date,
      source_shift,
      notes,
      created_by
    ) VALUES (
      v_org_id,
      v_draft.quality_label,
      v_godown,
      v_draft.source_type,
      v_draft.market_run_id,
      v_draft.order_id,
      v_draft.quote_id,
      p_actual_unit_count,
      p_actual_unit_count,
      p_meters_per_unit,
      v_unit_label,
      v_meters,
      v_meters,
      v_stock_purpose,
      v_draft.cost_per_meter,
      v_draft.source_date,
      v_draft.source_date,
      v_draft.source_shift,
      v_notes,
      auth.uid()
    )
    RETURNING id INTO v_stock_lot_id;
  ELSE
    UPDATE fabric_stock_lots
    SET
      original_taka_count = original_taka_count + p_actual_unit_count,
      available_taka_count = available_taka_count + p_actual_unit_count,
      original_meters = original_meters + v_meters,
      available_meters = available_meters + v_meters,
      received_date = LEAST(received_date, v_draft.source_date),
      source_date = LEAST(COALESCE(source_date, v_draft.source_date), v_draft.source_date),
      source_shift = CASE
        WHEN source_shift IS NULL THEN NULL
        WHEN source_shift = v_draft.source_shift THEN source_shift
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE id = v_stock_lot_id;
  END IF;

  INSERT INTO fabric_stock_movements (
    org_id,
    stock_lot_id,
    movement_type,
    movement_date,
    taka_delta,
    meters_delta,
    reference,
    notes,
    created_by
  ) VALUES (
    v_org_id,
    v_stock_lot_id,
    'inward',
    v_draft.source_date,
    p_actual_unit_count,
    v_meters,
    'Confirmed production inward',
    v_notes,
    auth.uid()
  );

  UPDATE fabric_stock_inward_drafts
  SET
    status = 'confirmed',
    confirmed_stock_lot_id = v_stock_lot_id,
    confirmed_by = auth.uid(),
    confirmed_at = NOW(),
    notes = v_notes
  WHERE id = p_draft_id;

  RETURN QUERY SELECT v_stock_lot_id, v_meters, p_actual_unit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_stock_inward_draft(UUID, NUMERIC, NUMERIC, TEXT, TEXT, TEXT)
  TO authenticated, service_role;
