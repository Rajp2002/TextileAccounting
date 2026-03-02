-- Add updated_by column to production_logs
-- This tracks which user last edited a production entry (used when a supervisor
-- unlocks a saved entry via access code and re-submits it).
ALTER TABLE production_logs
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id);
