-- ============================================================
-- MIGRATION: Audit Search Indices
-- Improves performance for record_id and actor searching
-- ============================================================

-- 1. Index for changed_by (Actor)
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON audit_log(changed_by);

-- 2. Index for record_id (Entity ID Search)
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);

-- 3. GIN index for JSONB search (Optional but recommended for large datasets)
-- Using jsonb_path_ops for faster containment queries (@>)
-- CREATE INDEX IF NOT EXISTS idx_audit_log_new_data_gin ON audit_log USING GIN (new_data jsonb_path_ops);
-- CREATE INDEX IF NOT EXISTS idx_audit_log_old_data_gin ON audit_log USING GIN (old_data jsonb_path_ops);
