-- Add shift column to production_logs
-- Required so day-shift and night-shift entries for the same machine+date
-- can coexist and be distinguished independently.
ALTER TABLE production_logs
    ADD COLUMN IF NOT EXISTS shift TEXT CHECK (shift IN ('day', 'night')) DEFAULT 'day';
