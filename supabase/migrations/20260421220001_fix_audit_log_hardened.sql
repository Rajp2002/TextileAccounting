-- ============================================================
-- MIGRATION: Fix Audit Log Hardened
-- 1. Relax check constraint on audit_log.action
-- 2. Fix log_audit_event column name (created_at -> changed_at)
-- ============================================================

-- 1. Relax check constraint
-- The 'action' column was restricted to ('INSERT', 'UPDATE', 'DELETE').
-- We need to allow custom actions like 'payroll.settle' for manual logging.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;

-- 2. Correct the log_audit_event variant
CREATE OR REPLACE FUNCTION log_audit_event(
    p_org_id UUID,
    p_actor_id UUID,
    p_action TEXT,
    p_table_name TEXT,
    p_record_id BIGINT,
    p_payload JSONB
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_log (
        org_id, table_name, record_id, action, 
        new_data, changed_by, changed_at
    )
    VALUES (
        p_org_id, p_table_name, p_record_id::TEXT, p_action, 
        p_payload, p_actor_id, now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
