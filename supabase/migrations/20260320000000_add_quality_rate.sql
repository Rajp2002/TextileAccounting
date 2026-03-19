-- Migration: Add default_worker_rate_per_m to qualities
ALTER TABLE qualities
    ADD COLUMN IF NOT EXISTS default_worker_rate_per_m DECIMAL NOT NULL DEFAULT 0;
