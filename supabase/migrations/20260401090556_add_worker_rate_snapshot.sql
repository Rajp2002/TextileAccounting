-- Add worker_rate_snapshot to production_logs
ALTER TABLE production_logs
ADD COLUMN IF NOT EXISTS worker_rate_snapshot DECIMAL NOT NULL DEFAULT 0;


-- Backfill the snapshot for existing logs based on the current quality rate
UPDATE production_logs pl
SET worker_rate_snapshot = q.default_worker_rate_per_m
FROM yarn_batches yb
JOIN qualities q ON q.id = yb.quality_id
WHERE pl.yarn_batch_id = yb.id;
