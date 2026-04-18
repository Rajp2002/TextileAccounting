-- Migration: 20260419040000_machine_breakdown_notes.sql
-- Adds breakdown tracking to shift assignments for the Unified Supervisor Dashboard.

-- Add columns to shift_assignments
ALTER TABLE shift_assignments 
ADD COLUMN IF NOT EXISTS breakdown_category text,
ADD COLUMN IF NOT EXISTS breakdown_notes text;

-- Add a comment for clarity
COMMENT ON COLUMN shift_assignments.breakdown_category IS 'Common breakdown types (warp_break, mechanical, electrical)';
COMMENT ON COLUMN shift_assignments.breakdown_notes IS 'Free-text details about machine downtime or issues.';
