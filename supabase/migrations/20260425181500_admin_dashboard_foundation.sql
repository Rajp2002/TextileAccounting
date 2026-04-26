-- ============================================================
-- MIGRATION: Admin Dashboard Foundation (DPDP 2026)
-- ============================================================

-- 1. Update profiles role check to include 'admin'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('owner', 'supervisor', 'admin'));

-- 2. Update audit_log action check to include 'EXPORT'
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'EXPORT'));

-- 3. Create compliance_settings table (singleton)
CREATE TABLE IF NOT EXISTS compliance_settings (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE,
    gro_name TEXT NOT NULL DEFAULT 'Grievance Officer',
    gro_email TEXT NOT NULL DEFAULT 'privacy@weavly.app',
    gro_phone TEXT,
    active_notice_id UUID REFERENCES notice_registry(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES profiles(id),
    CONSTRAINT single_row CHECK (id = TRUE)
);

INSERT INTO compliance_settings (id, gro_name, gro_email)
VALUES (TRUE, 'Grievance Officer', 'privacy@weavly.app')
ON CONFLICT DO NOTHING;

-- 4. RLS Policies for Admin Access

-- Grievances: Admins can see all
CREATE POLICY "Admins view all grievances" ON grievances
    FOR SELECT
    USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins manage all grievances" ON grievances
    FOR ALL
    USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Notice Registry: Admins manage
CREATE POLICY "Admins manage notice registry" ON notice_registry
    FOR ALL
    USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Audit Log: Admins see all
CREATE POLICY "Admins view all audit logs" ON audit_log
    FOR SELECT
    USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Compliance Settings: Admins manage
ALTER TABLE compliance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view GRO details" ON compliance_settings
    FOR SELECT
    USING (true);

CREATE POLICY "Admins manage compliance settings" ON compliance_settings
    FOR ALL
    USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- 5. Helper function for Export Logging
CREATE OR REPLACE FUNCTION log_export_event(
    p_org_id UUID,
    p_table_name TEXT,
    p_record_id TEXT,
    p_description TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO audit_log (org_id, table_name, record_id, action, new_data, changed_by)
    VALUES (
        p_org_id,
        p_table_name,
        p_record_id,
        'EXPORT',
        jsonb_build_object('description', p_description, 'timestamp', now()),
        auth.uid()
    );
END;
$$;
