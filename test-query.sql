WITH daily_logs AS (
    SELECT 
        pl.id,
        pl.meters,
        pl.machine_id,
        m.name as machine_name,
        pl.worker_id,
        w.name as worker_name,
        w.payment_type
    FROM production_logs pl
    JOIN machines m ON pl.machine_id = m.id
    JOIN workers w ON pl.worker_id = w.id
    WHERE pl.org_id = 'YOUR_ORG_ID' AND pl.date = '2026-02-26'
)
SELECT * FROM daily_logs;
