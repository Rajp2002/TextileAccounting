-- Migration: Add machine_status to machines table
-- Supports high-contrast badges for the new Supervisor Dashboard

ALTER TABLE IF EXISTS machines 
ADD COLUMN IF NOT EXISTS machine_status TEXT 
CHECK (machine_status IN ('running', 'idle', 'maintenance')) 
DEFAULT 'idle';

-- Optional: Migrate existing machines to 'running' if they are 'active'
-- (Though they start as 'idle' by default in the new unified dashboard)
-- UPDATE machines SET machine_status = 'running' WHERE status = 'active';
