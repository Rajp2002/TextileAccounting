-- Batch 22: production/order boundary hardening.
--
-- The application already validates normal supervisor submissions, but the
-- lower database/RPC boundary must also reject impossible or mis-attributed
-- production if an authenticated caller bypasses the UI.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.production_logs'::regclass
      AND conname = 'production_logs_meters_nonnegative'
  ) THEN
    ALTER TABLE public.production_logs
      ADD CONSTRAINT production_logs_meters_nonnegative
      CHECK (meters >= 0)
      NOT VALID;
  END IF;
END;
$$;

COMMENT ON CONSTRAINT production_logs_meters_nonnegative ON public.production_logs IS
  'Batch 22 guard: new production writes must not persist negative meters; NOT VALID preserves existing history for separate audit/remediation.';

CREATE OR REPLACE FUNCTION public.enforce_production_log_order_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_machine RECORD;
  v_existing_total NUMERIC := 0;
  v_guard_order_id UUID;
  v_guard_machine_id UUID;
  v_requires_order_guard BOOLEAN;
BEGIN
  IF NEW.meters IS NULL THEN
    RAISE EXCEPTION 'Production meters are required.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.meters < 0 THEN
    RAISE EXCEPTION 'Production meters cannot be negative.'
      USING ERRCODE = '23514';
  END IF;

  v_requires_order_guard := NEW.order_id IS NOT NULL;

  IF TG_OP = 'UPDATE'
     AND OLD.order_id IS NOT NULL THEN
    v_requires_order_guard := TRUE;
  END IF;

  IF NOT v_requires_order_guard THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_guard_order_id := COALESCE(NEW.order_id, OLD.order_id);
    v_guard_machine_id := COALESCE(NEW.machine_id, OLD.machine_id);
  ELSE
    v_guard_order_id := NEW.order_id;
    v_guard_machine_id := NEW.machine_id;
  END IF;

  IF v_guard_order_id IS NULL OR v_guard_machine_id IS NULL THEN
    RAISE EXCEPTION 'Order-attributed production requires an order and loom.'
      USING ERRCODE = '23514';
  END IF;

  SELECT o.id, o.status, o.total_target_meters
  INTO v_order
  FROM public.orders o
  WHERE o.id = v_guard_order_id
    AND o.org_id = NEW.org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for this organization.'
      USING ERRCODE = '23514';
  END IF;

  IF v_order.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Production can only be logged or corrected for active orders.'
      USING ERRCODE = '23514';
  END IF;

  SELECT m.id, m.status, m.current_order_id
  INTO v_machine
  FROM public.machines m
  WHERE m.id = v_guard_machine_id
    AND m.org_id = NEW.org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Machine not found for this organization.'
      USING ERRCODE = '23514';
  END IF;

  IF v_machine.status IS DISTINCT FROM 'active'
     OR v_machine.current_order_id IS DISTINCT FROM v_guard_order_id THEN
    RAISE EXCEPTION 'Production can only be logged for the active order currently assigned to this loom.'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(NEW.meters, 0) > 0 THEN
    SELECT COALESCE(SUM(CASE WHEN pl.meters > 0 THEN pl.meters ELSE 0 END), 0)
    INTO v_existing_total
    FROM public.production_logs pl
    WHERE pl.org_id = NEW.org_id
      AND pl.order_id = v_guard_order_id
      AND pl.id IS DISTINCT FROM NEW.id;

    IF ROUND(v_existing_total + NEW.meters, 2) > COALESCE(v_order.total_target_meters, 0) + 0.01 THEN
      RAISE EXCEPTION 'Production would exceed order target.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_production_log_order_boundary() IS
  'Batch 22 guard: blocks negative meters, non-active order writes, unassigned loom/order writes, and over-target production at the table boundary.';

DROP TRIGGER IF EXISTS trg_block_production_on_completed_order ON public.production_logs;
DROP TRIGGER IF EXISTS trg_check_order_target_before_log ON public.production_logs;
DROP TRIGGER IF EXISTS trg_production_log_order_boundary ON public.production_logs;

CREATE TRIGGER trg_production_log_order_boundary
  BEFORE INSERT OR UPDATE ON public.production_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_production_log_order_boundary();

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

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    WHERE meters IS NULL
  ) THEN
    RAISE EXCEPTION 'Production meters are required.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    WHERE meters < 0
  ) THEN
    RAISE EXCEPTION 'Production meters cannot be negative.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_org_id::text || ':' || v_date::text || ':' || v_shift, 0)
  );

  PERFORM 1
  FROM public.orders o
  WHERE o.org_id = v_org_id
    AND o.id IN (
      SELECT DISTINCT order_id
      FROM weavly_shift_logs
      WHERE order_id IS NOT NULL
      UNION
      SELECT DISTINCT pl.order_id
      FROM public.production_logs pl
      JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
      WHERE pl.org_id = v_org_id
        AND pl.date = v_date
        AND pl.shift = v_shift
        AND pl.order_id IS NOT NULL
    )
  FOR UPDATE;

  PERFORM 1
  FROM public.machines m
  WHERE m.org_id = v_org_id
    AND m.id IN (
      SELECT DISTINCT machine_id
      FROM weavly_shift_logs
      WHERE machine_id IS NOT NULL
    )
  FOR UPDATE;

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
  FROM public.production_logs pl
  JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
  WHERE pl.org_id = v_org_id
    AND pl.date = v_date
    AND pl.shift = v_shift
    AND pl.order_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN public.machines m ON m.id = l.machine_id AND m.org_id = v_org_id
    WHERE m.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Machine not found for this organization.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN public.workers w ON w.id = l.worker_id AND w.org_id = v_org_id
    WHERE l.worker_id IS NOT NULL AND w.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Worker not found for this organization.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN public.orders o ON o.id = l.order_id AND o.org_id = v_org_id
    WHERE l.order_id IS NOT NULL AND o.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Order not found for this organization.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    WHERE meters > 0
      AND (worker_id IS NULL OR order_id IS NULL OR COALESCE(worker_rate_snapshot, 0) <= 0)
  ) THEN
    RAISE EXCEPTION 'Production logs with meters > 0 require worker, order, and a valid rate.';
  END IF;

  -- Order-attributed rows must belong to an active order still assigned to the
  -- same active loom. This closes direct RPC writes against cancelled or
  -- completed orders and stale machine/order assignments while preserving
  -- unanchored downtime/status rows.
  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    JOIN public.orders o ON o.id = l.order_id AND o.org_id = v_org_id
    JOIN public.machines m ON m.id = l.machine_id AND m.org_id = v_org_id
    WHERE l.order_id IS NOT NULL
      AND (
        o.status IS DISTINCT FROM 'active'
        OR m.status IS DISTINCT FROM 'active'
        OR m.current_order_id IS DISTINCT FROM l.order_id
      )
  ) THEN
    RAISE EXCEPTION 'Production can only be logged for the active order currently assigned to this loom.';
  END IF;

  -- Replacing existing order-attributed logs for a non-active order would
  -- rewrite closed history and, for positive rows, generated stock. Keep that
  -- blocked at the RPC boundary.
  IF EXISTS (
    SELECT 1
    FROM public.production_logs pl
    JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
    JOIN public.orders o ON o.id = pl.order_id AND o.org_id = v_org_id
    WHERE pl.org_id = v_org_id
      AND pl.date = v_date
      AND pl.shift = v_shift
      AND pl.order_id IS NOT NULL
      AND o.status IS DISTINCT FROM 'active'
  ) THEN
    RAISE EXCEPTION 'Production logs for non-active orders cannot be replaced.';
  END IF;

  -- Compute the post-replacement order totals before deleting any existing
  -- rows. This preserves Batch 2 stock atomicity while preventing over-target
  -- production from reaching stock, payroll, or progress read models.
  IF EXISTS (
    WITH submitted_order_totals AS (
      SELECT order_id, ROUND(COALESCE(SUM(meters), 0), 2) AS submitted_meters
      FROM weavly_shift_logs
      WHERE order_id IS NOT NULL
        AND meters > 0
      GROUP BY order_id
    ),
    affected_orders AS (
      SELECT order_id
      FROM submitted_order_totals
      UNION
      SELECT DISTINCT pl.order_id
      FROM public.production_logs pl
      JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
      WHERE pl.org_id = v_org_id
        AND pl.date = v_date
        AND pl.shift = v_shift
        AND pl.order_id IS NOT NULL
    ),
    weavly_order_totals_after_replacement AS (
      SELECT
        ao.order_id,
        ROUND(
          COALESCE((
            SELECT SUM(CASE WHEN pl.meters > 0 THEN pl.meters ELSE 0 END)
            FROM public.production_logs pl
            WHERE pl.org_id = v_org_id
              AND pl.order_id = ao.order_id
              AND NOT EXISTS (
                SELECT 1
                FROM weavly_shift_logs l
                WHERE l.machine_id = pl.machine_id
                  AND pl.date = v_date
                  AND pl.shift = v_shift
              )
          ), 0)
          + COALESCE(sot.submitted_meters, 0),
          2
        ) AS next_meters
      FROM affected_orders ao
      LEFT JOIN submitted_order_totals sot ON sot.order_id = ao.order_id
    )
    SELECT 1
    FROM weavly_order_totals_after_replacement totals
    JOIN public.orders o ON o.id = totals.order_id AND o.org_id = v_org_id
    WHERE totals.next_meters > COALESCE(o.total_target_meters, 0) + 0.01
  ) THEN
    RAISE EXCEPTION 'Production would exceed order target.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    WHERE meters = 0
      AND (zero_meter_reason IS NULL OR BTRIM(zero_meter_reason) = '')
  ) THEN
    RAISE EXCEPTION 'Zero-meter logs require a reason.';
  END IF;

  SELECT COUNT(*)
  INTO v_replaced_count
  FROM public.production_logs pl
  JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
  WHERE pl.org_id = v_org_id
    AND pl.date = v_date
    AND pl.shift = v_shift;

  IF v_replaced_count > 0 AND NOT p_allow_overwrite THEN
    RAISE EXCEPTION 'DUPLICATE_LOG_DETECTED';
  END IF;

  IF v_replaced_count > 0 THEN
    INSERT INTO public.audit_log (
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
    FROM public.production_logs pl
    JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id
    WHERE pl.org_id = v_org_id
      AND pl.date = v_date
      AND pl.shift = v_shift;

    DELETE FROM public.production_logs pl
    USING weavly_shift_logs l
    WHERE pl.org_id = v_org_id
      AND pl.date = v_date
      AND pl.shift = v_shift
      AND pl.machine_id = l.machine_id;
  END IF;

  INSERT INTO public.production_logs (
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
    FROM public.reconcile_generated_stock_for_production_grain(
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

COMMENT ON FUNCTION public.replace_shift_production_logs(JSONB, BOOLEAN, BOOLEAN) IS
  'Batch 22 hardened production replacement RPC: validates non-negative meters, active assigned order boundary, non-active correction blocking, and over-target totals before atomic stock reconciliation.';

GRANT EXECUTE ON FUNCTION replace_shift_production_logs(JSONB, BOOLEAN, BOOLEAN)
  TO authenticated, service_role;
