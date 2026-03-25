-- ============================================================
-- Audit Log — Tracks changes to sensitive tables
-- Required for Indian labour record retention (3 years)
-- and DPDP Act accountability
-- ============================================================

-- Create the audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    org_id UUID NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID,
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast org-scoped queries
CREATE INDEX idx_audit_log_org_id ON audit_log(org_id);
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at DESC);

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only owners can view their org's audit logs
CREATE POLICY "Owners view audit logs" ON audit_log
    FOR SELECT
    USING (
        org_id = (
            SELECT org_id FROM profiles WHERE id = auth.uid()
        )
        AND (
            SELECT role FROM profiles WHERE id = auth.uid()
        ) = 'owner'
    );

-- ============================================================
-- Shared audit trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (org_id, table_name, record_id, action, new_data, changed_by)
        VALUES (
            NEW.org_id,
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
            NEW.org_id,
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
            OLD.org_id,
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

-- ============================================================
-- Attach triggers to sensitive tables
-- ============================================================

-- Production logs
CREATE TRIGGER audit_production_logs
    AFTER INSERT OR UPDATE OR DELETE ON production_logs
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Payroll payments
CREATE TRIGGER audit_payroll_payments
    AFTER INSERT OR UPDATE OR DELETE ON payroll_payments
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Worker advances
CREATE TRIGGER audit_worker_advances
    AFTER INSERT OR UPDATE OR DELETE ON worker_advances
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
