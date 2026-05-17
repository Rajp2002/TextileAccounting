-- ============================================================
-- MIGRATION: Production logging strictness / forgiveness rules
-- ============================================================
-- Core rule:
--   meters > 0  → strict:   worker + quality/work anchor + rate > 0
--   meters = 0  → forgiving: reason required, worker/order/rate optional
--
-- Changes:
--   1. Allow NULL worker_id / order_id for 0m status rows
--   2. Reject meters > 0 without worker/order/rate
--   3. Reject meters = 0 without reason
--   4. Remove COALESCE(worker_rate_snapshot, 1.5) fallback

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

  -- ── Basic batch validation ───────────────────────────────────────────
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

  -- ── Entity validation ────────────────────────────────────────────────
  -- Machine must always belong to org
  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN machines m ON m.id = l.machine_id AND m.org_id = v_org_id
    WHERE m.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Machine not found for this organization.';
  END IF;

  -- Worker must belong to org (only validate non-NULL worker_id rows)
  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN workers w ON w.id = l.worker_id AND w.org_id = v_org_id
    WHERE l.worker_id IS NOT NULL AND w.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Worker not found for this organization.';
  END IF;

  -- Order must belong to org (only validate non-NULL order_id rows)
  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN orders o ON o.id = l.order_id AND o.org_id = v_org_id
    WHERE l.order_id IS NOT NULL AND o.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Order not found for this organization.';
  END IF;

  -- ── Strictness: production rows (meters > 0) ────────────────────────
  -- Must have worker, quality/work anchor (order_id), and valid rate
  IF EXISTS (
    SELECT 1 FROM weavly_shift_logs
    WHERE meters > 0
      AND (worker_id IS NULL OR order_id IS NULL OR COALESCE(worker_rate_snapshot, 0) <= 0)
  ) THEN
    RAISE EXCEPTION 'Production logs with meters > 0 require worker, order, and a valid rate.';
  END IF;

  -- ── Forgiveness: status rows (meters = 0) ──────────────────────────
  -- Must have a reason
  IF EXISTS (
    SELECT 1 FROM weavly_shift_logs
    WHERE meters = 0
      AND (zero_meter_reason IS NULL OR BTRIM(zero_meter_reason) = '')
  ) THEN
    RAISE EXCEPTION 'Zero-meter logs require a reason.';
  END IF;

  -- ── Duplicate detection ──────────────────────────────────────────────
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

  -- ── Insert validated logs ────────────────────────────────────────────
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

  RETURN QUERY SELECT v_inserted_count, v_replaced_count;
END;
$$;

GRANT EXECUTE ON FUNCTION replace_shift_production_logs(JSONB, BOOLEAN, BOOLEAN)
  TO authenticated, service_role;
