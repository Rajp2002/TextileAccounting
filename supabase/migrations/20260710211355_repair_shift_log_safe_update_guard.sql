-- ROOT-PRODUCTION-ACTIVATION-SHIFT-LOG
-- Forward-only repair for the production safe-update rejection introduced by
-- 20260709080948. The function intentionally normalizes every row in its
-- transaction-local temp table; an explicit predicate preserves that behavior
-- while satisfying the deployed safe-update guard.

CREATE OR REPLACE FUNCTION public.replace_shift_production_logs(
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
    NULLIF(order_id, '')::uuid AS order_id,
    meters::numeric AS meters,
    opening_meter_reading::numeric AS opening_meter_reading,
    closing_meter_reading::numeric AS closing_meter_reading,
    COALESCE(counter_was_reset, FALSE)::boolean AS counter_was_reset,
    shift::text AS shift,
    date::date AS date,
    worker_rate_snapshot::numeric AS worker_rate_snapshot,
    NULLIF(operator_assignment_id, '')::uuid AS operator_assignment_id,
    NULLIF(operator_worker_type, '')::text AS operator_worker_type,
    meter_worker_id::bigint AS meter_worker_id,
    fixed_worker_id::bigint AS fixed_worker_id,
    NULLIF(operator_pay_mode_snapshot, '')::text AS operator_pay_mode_snapshot,
    operator_rate_snapshot::numeric AS operator_rate_snapshot,
    NULLIF(machine_type_snapshot, '')::text AS machine_type_snapshot,
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
    operator_assignment_id text,
    operator_worker_type text,
    meter_worker_id bigint,
    fixed_worker_id bigint,
    operator_pay_mode_snapshot text,
    operator_rate_snapshot numeric,
    machine_type_snapshot text,
    submitted_at timestamptz,
    client_ip text,
    zero_meter_reason text
  );

  UPDATE weavly_shift_logs
  SET
    meter_worker_id = COALESCE(meter_worker_id, worker_id),
    operator_worker_type = CASE
      WHEN operator_worker_type IS NOT NULL THEN operator_worker_type
      WHEN COALESCE(worker_id, meter_worker_id) IS NOT NULL THEN 'meter_worker'
      WHEN fixed_worker_id IS NOT NULL THEN 'fixed_worker'
      ELSE NULL
    END,
    operator_pay_mode_snapshot = COALESCE(operator_pay_mode_snapshot, CASE WHEN COALESCE(worker_id, meter_worker_id) IS NOT NULL THEN 'per_meter' END),
    operator_rate_snapshot = COALESCE(operator_rate_snapshot, worker_rate_snapshot),
    machine_type_snapshot = COALESCE(machine_type_snapshot, 'other')
  WHERE TRUE;

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

  IF EXISTS (SELECT 1 FROM weavly_shift_logs WHERE meters IS NULL) THEN
    RAISE EXCEPTION 'Production meters are required.';
  END IF;

  IF EXISTS (SELECT 1 FROM weavly_shift_logs WHERE meters < 0) THEN
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
    LEFT JOIN public.workers w ON w.id = l.meter_worker_id AND w.org_id = v_org_id
    WHERE l.meter_worker_id IS NOT NULL AND w.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Worker not found for this organization.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs l
    LEFT JOIN public.fixed_workers fw ON fw.id = l.fixed_worker_id AND fw.org_id = v_org_id
    WHERE l.fixed_worker_id IS NOT NULL AND fw.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Fixed worker not found for this organization.';
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
    FROM weavly_shift_logs l
    LEFT JOIN public.machine_operator_assignments moa
      ON moa.id = l.operator_assignment_id
     AND moa.org_id = v_org_id
     AND moa.machine_id = l.machine_id
     AND moa.shift = l.shift
     AND moa.worker_type = l.operator_worker_type
     AND COALESCE(moa.meter_worker_id, -1) = COALESCE(l.meter_worker_id, -1)
     AND COALESCE(moa.fixed_worker_id, -1) = COALESCE(l.fixed_worker_id, -1)
     AND moa.pay_mode = l.operator_pay_mode_snapshot
     AND moa.active IS TRUE
     AND moa.effective_from <= l.date
     AND (moa.effective_to IS NULL OR moa.effective_to >= l.date)
    WHERE l.operator_assignment_id IS NOT NULL
      AND moa.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Operator assignment not found or inactive for this production shift.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    WHERE meters > 0
      AND (
        order_id IS NULL
        OR operator_worker_type IS NULL
        OR operator_pay_mode_snapshot IS NULL
        OR COALESCE(operator_rate_snapshot, worker_rate_snapshot, 0) <= 0
        OR (
          operator_assignment_id IS NULL
          AND COALESCE(worker_id, meter_worker_id) IS NULL
        )
        OR (
          operator_assignment_id IS NOT NULL
          AND (
            (operator_worker_type = 'meter_worker' AND meter_worker_id IS NULL)
            OR (operator_worker_type = 'fixed_worker' AND fixed_worker_id IS NULL)
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Production logs with meters > 0 require operator assignment, order, and a valid rate.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    WHERE operator_worker_type = 'fixed_worker'
      AND operator_pay_mode_snapshot = 'per_meter'
  ) THEN
    RAISE EXCEPTION 'Fixed machine operator logs cannot use per-meter pay mode.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM weavly_shift_logs
    WHERE operator_worker_type = 'meter_worker'
      AND operator_pay_mode_snapshot <> 'per_meter'
  ) THEN
    RAISE EXCEPTION 'Meter worker logs must use per-meter pay mode.';
  END IF;

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
    operator_assignment_id,
    operator_worker_type,
    meter_worker_id,
    fixed_worker_id,
    operator_pay_mode_snapshot,
    operator_rate_snapshot,
    machine_type_snapshot,
    created_by,
    updated_by,
    submitted_at,
    client_ip,
    zero_meter_reason
  )
  SELECT
    v_org_id,
    machine_id,
    CASE WHEN operator_worker_type = 'meter_worker' THEN meter_worker_id ELSE NULL END,
    order_id,
    meters,
    opening_meter_reading,
    closing_meter_reading,
    counter_was_reset,
    shift,
    date,
    CASE WHEN operator_worker_type = 'meter_worker' THEN COALESCE(operator_rate_snapshot, worker_rate_snapshot, 0) ELSE 0 END,
    operator_assignment_id,
    operator_worker_type,
    CASE WHEN operator_worker_type = 'meter_worker' THEN meter_worker_id ELSE NULL END,
    CASE WHEN operator_worker_type = 'fixed_worker' THEN fixed_worker_id ELSE NULL END,
    operator_pay_mode_snapshot,
    COALESCE(operator_rate_snapshot, worker_rate_snapshot, 0),
    machine_type_snapshot,
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
  'Machine Operator Payroll v2 production replacement RPC: accepts assignment snapshots and prevents fixed operator logs from producing meter wages.';

GRANT EXECUTE ON FUNCTION public.replace_shift_production_logs(JSONB, BOOLEAN, BOOLEAN)
  TO authenticated, service_role;
