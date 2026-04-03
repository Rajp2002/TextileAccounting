-- ============================================================
-- MIGRATION: Daily Brief v2 RPC Update
-- Replaces old yield-tracking daily stats with flat metrics
-- ============================================================

CREATE OR REPLACE FUNCTION get_daily_brief_stats_v2(
    p_org_id UUID,
    p_date DATE
) RETURNS TABLE (
    total_meters DECIMAL,
    active_orders INT,
    top_machine_name TEXT,
    top_machine_meters DECIMAL,
    labor_liability_inr DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH daily_logs AS (
        SELECT 
            pl.machine_id,
            pl.meters,
            (pl.meters * pl.worker_rate_snapshot) as wages,
            m.name as machine_name
        FROM production_logs pl
        JOIN machines m ON m.id = pl.machine_id
        WHERE pl.org_id = p_org_id 
          AND pl.date = p_date
    ),
    machine_totals AS (
        SELECT 
            machine_name,
            SUM(meters) as total_m
        FROM daily_logs
        GROUP BY machine_name
        ORDER BY total_m DESC
        LIMIT 1
    )
    SELECT 
        COALESCE((SELECT SUM(meters) FROM daily_logs), 0)::DECIMAL as total_meters,
        (SELECT count(*)::INT FROM orders WHERE org_id = p_org_id AND status = 'active')::INT as active_orders,
        COALESCE((SELECT machine_name FROM machine_totals), 'None')::TEXT as top_machine_name,
        COALESCE((SELECT total_m FROM machine_totals), 0)::DECIMAL as top_machine_meters,
        COALESCE((SELECT SUM(wages) FROM daily_logs), 0)::DECIMAL as labor_liability_inr;
END;
$$;
