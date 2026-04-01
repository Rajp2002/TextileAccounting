-- ============================================================
-- MIGRATION: get_daily_brief_stats RPC
-- ============================================================
-- Called by the send-daily-brief edge function at 20:00 IST.
-- Returns a single JSON object with today's production summary
-- for a given org. All column names verified against current schema.
-- ============================================================

CREATE OR REPLACE FUNCTION get_daily_brief_stats(p_org_id UUID, p_date DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_meters       NUMERIC := 0;
    v_active_orders      INT     := 0;
    v_avg_efficiency     NUMERIC := 100;
    v_estimated_loss_inr NUMERIC := 0;
    v_piece_rate_wages   NUMERIC := 0;
BEGIN
    -- ─── Today's production totals ────────────────────────────
    -- Wages = meters × workers.rate_per_meter (rate lives on workers table)
    -- production_logs.date is the correct column name
    SELECT
        COALESCE(SUM(pl.meters), 0),
        COALESCE(SUM(pl.meters * COALESCE(w.rate_per_meter, 0)), 0)
    INTO v_total_meters, v_piece_rate_wages
    FROM production_logs pl
    LEFT JOIN workers w ON w.id = pl.worker_id
    WHERE pl.org_id = p_org_id
      AND pl.date = p_date;

    -- ─── Active orders count ──────────────────────────────────
    SELECT COUNT(*)
    INTO v_active_orders
    FROM orders
    WHERE org_id = p_org_id
      AND status = 'active';

    -- ─── Average yield efficiency across active batches ───────
    -- Uses (total_weight_kg - leftover_weight_kg) as net usable yarn weight
    -- This matches the logic in get_batch_yield_report (correct per 20260320000200)
    SELECT
        COALESCE(
            AVG(
                CASE
                    WHEN ((yb.total_weight_kg - COALESCE(yb.leftover_weight_kg, 0)) * q.target_yield) > 0 THEN
                        (COALESCE(actual.meters, 0) /
                            ((yb.total_weight_kg - COALESCE(yb.leftover_weight_kg, 0)) * q.target_yield)
                        ) * 100
                    ELSE 100
                END
            ),
            100
        )
    INTO v_avg_efficiency
    FROM yarn_batches yb
    JOIN qualities q ON q.id = yb.quality_id
    LEFT JOIN (
        SELECT yarn_batch_id, SUM(meters) AS meters
        FROM production_logs
        WHERE org_id = p_org_id
        GROUP BY yarn_batch_id
    ) actual ON actual.yarn_batch_id = yb.id
    WHERE yb.org_id = p_org_id
      AND yb.status = 'active';

    -- ─── Estimated monetary loss (only when efficiency < 95%) ─
    -- avg_sale_price_per_m is the correct qualities column name
    IF v_avg_efficiency < 95 THEN
        SELECT
            COALESCE(SUM(
                GREATEST(0,
                    (((yb.total_weight_kg - COALESCE(yb.leftover_weight_kg, 0)) * q.target_yield)
                        - COALESCE(actual.meters, 0))
                    * q.avg_sale_price_per_m
                )
            ), 0)
        INTO v_estimated_loss_inr
        FROM yarn_batches yb
        JOIN qualities q ON q.id = yb.quality_id
        LEFT JOIN (
            SELECT yarn_batch_id, SUM(meters) AS meters
            FROM production_logs
            WHERE org_id = p_org_id
            GROUP BY yarn_batch_id
        ) actual ON actual.yarn_batch_id = yb.id
        WHERE yb.org_id = p_org_id
          AND yb.status = 'active'
          AND ((yb.total_weight_kg - COALESCE(yb.leftover_weight_kg, 0)) * q.target_yield)
              > COALESCE(actual.meters, 0);
    END IF;

    RETURN json_build_object(
        'total_meters',       v_total_meters,
        'active_orders',      v_active_orders,
        'avg_efficiency',     ROUND(v_avg_efficiency, 1),
        'estimated_loss_inr', ROUND(v_estimated_loss_inr, 0),
        'piece_rate_wages',   ROUND(v_piece_rate_wages, 2)
    );
END;
$$;

-- Grant execute to service_role (used by edge functions)
GRANT EXECUTE ON FUNCTION get_daily_brief_stats(UUID, DATE) TO service_role;
