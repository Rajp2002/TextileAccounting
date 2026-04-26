-- ============================================================
-- MIGRATION: Fix Audit Log for Global/Admin Events
-- Allows org_id to be NULL in audit_log to support admin 
-- profiles and other global entities.
-- ============================================================

-- 1. Allow NULL in audit_log.org_id
ALTER TABLE audit_log ALTER COLUMN org_id DROP NOT NULL;

-- 2. Update log_audit_event to be more resilient
-- This ensures that even if a table doesn't have an org_id column 
-- (or it is null), the audit log still captures the change.
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- Capture org_id if it exists on the record
    -- We use a dynamic check to avoid errors on tables without org_id
    IF TG_OP = 'DELETE' THEN
        BEGIN
            v_org_id := OLD.org_id;
        EXCEPTION WHEN OTHERS THEN
            v_org_id := NULL;
        END;
    ELSE
        BEGIN
            v_org_id := NEW.org_id;
        EXCEPTION WHEN OTHERS THEN
            v_org_id := NULL;
        END;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (org_id, table_name, record_id, action, new_data, changed_by)
        VALUES (
            v_org_id,
            TG_TABLE_NAME,
            NEW.id::TEXT,
            'INSERT',
            to_jsonb(NEW),
            auth.uid()
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (org_id, table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (
            v_org_id,
            TG_TABLE_NAME,
            NEW.id::TEXT,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            auth.uid()
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (org_id, table_name, record_id, action, old_data, changed_by)
        VALUES (
            v_org_id,
            TG_TABLE_NAME,
            OLD.id::TEXT,
            'DELETE',
            to_jsonb(OLD),
            auth.uid()
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
