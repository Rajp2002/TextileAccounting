-- ============================================================
-- MIGRATION: Update order_progress_summary to include worker_rate_per_m
-- ============================================================

DROP VIEW IF EXISTS order_progress_summary;

CREATE OR REPLACE VIEW order_progress_summary AS
SELECT
    o.id AS order_id,
    o.org_id,
    o.party_name,
    o.total_target_meters,
    o.start_date,
    o.deadline,
    o.status,
    o.quality_id,
    o.quality_label,
    o.warp_instruction,
    o.weft_instruction,
    o.notes,
    o.worker_rate_per_m,
    COALESCE(o.quality_label, q.name, 'Unnamed') AS display_quality_name,
    q.theoretical_meters_per_day,

    -- Total meters produced for this order
    COALESCE(SUM(pl.meters), 0) AS total_meters_produced,

    -- Progress %
    CASE
        WHEN o.total_target_meters > 0 THEN
            LEAST(100, (COALESCE(SUM(pl.meters), 0) / o.total_target_meters) * 100)
        ELSE 0
    END AS progress_percent,

    -- Time Elapsed %
    CASE
        WHEN (o.deadline - o.start_date) > 0 THEN
            GREATEST(0, LEAST(100, (CURRENT_DATE - o.start_date)::decimal / (o.deadline - o.start_date)::decimal * 100))
        WHEN CURRENT_DATE >= o.deadline THEN 100
        ELSE 0
    END AS time_elapsed_percent,

    -- Pace Index
    CASE
        WHEN (o.deadline - o.start_date) > 0 AND (CURRENT_DATE - o.start_date) > 0 THEN
            ((COALESCE(SUM(pl.meters), 0) / o.total_target_meters)) /
            ((CURRENT_DATE - o.start_date)::decimal / (o.deadline - o.start_date)::decimal)
        ELSE 1.0
    END AS pace_index,

    -- Assigned machines count
    (SELECT COUNT(*)::int FROM machines m WHERE m.current_order_id = o.id) AS assigned_machines_count

FROM orders o
LEFT JOIN qualities q ON q.id = o.quality_id
LEFT JOIN production_logs pl ON pl.order_id = o.id
GROUP BY o.id, o.org_id, o.party_name, o.total_target_meters, o.start_date,
         o.deadline, o.status, o.quality_id, o.quality_label, o.warp_instruction,
         o.weft_instruction, o.notes, o.worker_rate_per_m, q.name, q.theoretical_meters_per_day;
