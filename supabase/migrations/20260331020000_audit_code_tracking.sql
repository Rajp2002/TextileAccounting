-- ============================================================
-- MIGRATION: Access Code Audit Tracking
-- ============================================================

-- 1. Add column to audit_log
ALTER TABLE audit_log 
    ADD COLUMN IF NOT EXISTS is_access_code_used BOOLEAN DEFAULT false;

-- 2. Update log_audit_event to check session variable
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_is_access_code_used BOOLEAN := false;
BEGIN
    -- Check if session variable is set (string 'true')
    BEGIN
        v_is_access_code_used := current_setting('app.access_code_used', true) = 'true';
    EXCEPTION WHEN OTHERS THEN
        v_is_access_code_used := false;
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (org_id, table_name, record_id, action, new_data, changed_by, is_access_code_used)
        VALUES (
            NEW.org_id,
            TG_TABLE_NAME,
            NEW.id::TEXT,
            'INSERT',
            to_jsonb(NEW),
            auth.uid(),
            v_is_access_code_used
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (org_id, table_name, record_id, action, old_data, new_data, changed_by, is_access_code_used)
        VALUES (
            NEW.org_id,
            TG_TABLE_NAME,
            NEW.id::TEXT,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            auth.uid(),
            v_is_access_code_used
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (org_id, table_name, record_id, action, old_data, changed_by, is_access_code_used)
        VALUES (
            OLD.org_id,
            TG_TABLE_NAME,
            OLD.id::TEXT,
            'DELETE',
            to_jsonb(OLD),
            auth.uid(),
            v_is_access_code_used
        );
        -- Reset session variable after use for safety (optional, but good practice if not using transactions carefully)
        -- Actually we don't want to reset it here if multiple rows are being deleted in one query.
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
