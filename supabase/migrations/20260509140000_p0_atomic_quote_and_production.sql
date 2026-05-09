-- ============================================================
-- P0 Pilot Readiness: Atomic quote conversion + production logs
-- ============================================================

-- Quote conversion needs a database-level backlink so one quote can only ever
-- create one order, even when two requests race.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES estimator_quotes(id) ON DELETE SET NULL;

UPDATE orders o
SET quote_id = q.id
FROM estimator_quotes q
WHERE q.order_id = o.id
  AND o.quote_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_quote_id_unique
  ON orders(quote_id)
  WHERE quote_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_estimator_quotes_order_id_unique
  ON estimator_quotes(order_id)
  WHERE order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION convert_accepted_quote_to_order(
  p_quote_id UUID,
  p_total_target_meters NUMERIC,
  p_deadline DATE,
  p_notes TEXT DEFAULT '',
  p_tracking_token TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, order_id UUID, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_role TEXT;
  v_quote estimator_quotes%ROWTYPE;
  v_order_id UUID;
  v_updated_count INT;
BEGIN
  v_org_id := NULLIF(auth.jwt() ->> 'org_id', '')::uuid;
  v_role := auth.jwt() ->> 'user_role';

  IF v_role <> 'owner' OR v_org_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, 'Permission denied';
    RETURN;
  END IF;

  IF p_total_target_meters IS NULL OR p_total_target_meters <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, 'Order quantity must be greater than 0.';
    RETURN;
  END IF;

  SELECT *
  INTO v_quote
  FROM estimator_quotes
  WHERE id = p_quote_id
    AND org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, 'Quote not found.';
    RETURN;
  END IF;

  IF v_quote.status IS DISTINCT FROM 'accepted' THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, 'Only accepted quotes can be converted into orders.';
    RETURN;
  END IF;

  IF v_quote.order_id IS NOT NULL
     OR EXISTS (
       SELECT 1
       FROM orders o
       WHERE o.quote_id = p_quote_id
         AND o.org_id = v_org_id
     ) THEN
    RETURN QUERY SELECT FALSE, COALESCE(v_quote.order_id, (
      SELECT o.id FROM orders o WHERE o.quote_id = p_quote_id AND o.org_id = v_org_id LIMIT 1
    )), 'This quote has already been converted into an order.';
    RETURN;
  END IF;

  INSERT INTO orders (
    org_id,
    quote_id,
    party_name,
    quality_label,
    warp_instruction,
    weft_instruction,
    total_target_meters,
    start_date,
    deadline,
    status,
    worker_rate_per_m,
    notes,
    tracking_token
  )
  VALUES (
    v_org_id,
    v_quote.id,
    v_quote.party_name,
    v_quote.quality_label,
    COALESCE(v_quote.warp_instruction, ''),
    COALESCE(v_quote.weft_instruction, ''),
    p_total_target_meters,
    CURRENT_DATE,
    p_deadline,
    'active',
    v_quote.worker_rate_per_m,
    COALESCE(BTRIM(p_notes), ''),
    p_tracking_token
  )
  RETURNING id INTO v_order_id;

  UPDATE estimator_quotes
  SET order_id = v_order_id
  WHERE id = v_quote.id
    AND org_id = v_org_id
    AND order_id IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'This quote has already been converted into an order.';
  END IF;

  RETURN QUERY SELECT TRUE, v_order_id, NULL::text;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, 'This quote has already been converted into an order.';
END;
$$;

GRANT EXECUTE ON FUNCTION convert_accepted_quote_to_order(UUID, NUMERIC, DATE, TEXT, TEXT)
  TO authenticated;

-- One machine/date/shift has one authoritative production log. Corrections
-- intentionally replace rows inside replace_shift_production_logs().
WITH ranked_logs AS (
  SELECT
    pl.*,
    ROW_NUMBER() OVER (
      PARTITION BY pl.org_id, pl.machine_id, pl.date, pl.shift
      ORDER BY pl.submitted_at DESC NULLS LAST, pl.id DESC
    ) AS rn
  FROM production_logs pl
),
duplicate_groups AS (
  SELECT
    org_id,
    machine_id,
    date,
    shift,
    JSONB_AGG(TO_JSONB(ranked_logs) ORDER BY submitted_at DESC NULLS LAST, id DESC) AS duplicate_logs
  FROM ranked_logs
  WHERE rn > 1
  GROUP BY org_id, machine_id, date, shift
)
INSERT INTO audit_log (org_id, table_name, record_id, action, old_data, new_data, changed_by)
SELECT
  org_id,
  'production_logs',
  machine_id::text || ':' || date::text || ':' || shift,
  'shift_self_correction',
  duplicate_logs,
  JSONB_BUILD_OBJECT('kept_latest_authoritative_log', TRUE),
  NULL
FROM duplicate_groups;

WITH ranked_logs AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY org_id, machine_id, date, shift
      ORDER BY submitted_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM production_logs
)
DELETE FROM production_logs pl
USING ranked_logs r
WHERE pl.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_production_logs_one_machine_shift
  ON production_logs(org_id, machine_id, date, shift);

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
BEGIN
  v_org_id := NULLIF(auth.jwt() ->> 'org_id', '')::uuid;
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
    COALESCE(worker_rate_snapshot, 1.5)::numeric AS worker_rate_snapshot,
    COALESCE(submitted_at, now())::timestamptz AS submitted_at,
    COALESCE(client_ip, 'unknown')::text AS client_ip
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
    client_ip text
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
    WHERE w.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Worker not found for this organization.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN orders o ON o.id = l.order_id AND o.org_id = v_org_id
    WHERE o.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Order not found for this organization.';
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
    client_ip
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
    client_ip
  FROM weavly_shift_logs;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RETURN QUERY SELECT v_inserted_count, v_replaced_count;
END;
$$;

GRANT EXECUTE ON FUNCTION replace_shift_production_logs(JSONB, BOOLEAN, BOOLEAN)
  TO authenticated;
