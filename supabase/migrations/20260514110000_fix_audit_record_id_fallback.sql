-- ============================================================
-- MIGRATION: Audit record-id fallback for org-keyed tables
-- ============================================================
-- payroll_configs is keyed by org_id and intentionally has no id column.
-- The shared audit trigger must therefore choose a stable record_id from
-- id when present, otherwise org_id. This keeps payroll config changes
-- auditable without blocking onboarding saves.

CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_record_id TEXT;
    v_actor_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        BEGIN
            v_org_id := OLD.org_id;
        EXCEPTION WHEN OTHERS THEN
            v_org_id := NULL;
        END;

        v_record_id := COALESCE(to_jsonb(OLD)->>'id', to_jsonb(OLD)->>'org_id');
    ELSE
        BEGIN
            v_org_id := NEW.org_id;
        EXCEPTION WHEN OTHERS THEN
            v_org_id := NULL;
        END;

        v_record_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'org_id');
    END IF;

    BEGIN
        v_actor_id := COALESCE(NULLIF(current_setting('app.actor_id', true), '')::UUID, auth.uid());
    EXCEPTION WHEN OTHERS THEN
        v_actor_id := auth.uid();
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (org_id, table_name, record_id, action, new_data, changed_by)
        VALUES (v_org_id, TG_TABLE_NAME, v_record_id, 'INSERT', to_jsonb(NEW), v_actor_id);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (org_id, table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (v_org_id, TG_TABLE_NAME, v_record_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_actor_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (org_id, table_name, record_id, action, old_data, changed_by)
        VALUES (v_org_id, TG_TABLE_NAME, v_record_id, 'DELETE', to_jsonb(OLD), v_actor_id);
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
