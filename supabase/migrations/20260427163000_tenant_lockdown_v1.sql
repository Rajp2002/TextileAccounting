-- ============================================================
-- MIGRATION: Per-Tenant Lockdown & Breach Reporting (DPDP 2026)
-- ============================================================

-- 1. Update organizations table with lockdown metadata
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_locked_down BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS lockdown_reason TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS lockdown_severity TEXT CHECK (lockdown_severity IN ('low', 'medium', 'high', 'critical'));

-- 2. Create breach_reports table
CREATE TABLE IF NOT EXISTS breach_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    report_type TEXT NOT NULL DEFAULT 'DPDP_BREACH_V1',
    severity TEXT NOT NULL,
    description TEXT,
    affected_users_count INTEGER,
    measures_taken TEXT,
    auto_generated_data JSONB, -- Stores the DPDP template payload
    filed_at TIMESTAMPTZ DEFAULT now(),
    filed_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on breach_reports
ALTER TABLE breach_reports ENABLE ROW LEVEL SECURITY;

-- Admins can see all reports
CREATE POLICY "Admins view all breach reports" ON breach_reports
    FOR SELECT
    USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Owners can see their own reports
CREATE POLICY "Owners view own breach reports" ON breach_reports
    FOR SELECT
    USING (
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()) AND
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
    );

-- 3. Lockdown Helper Function
CREATE OR REPLACE FUNCTION check_org_lockdown(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organizations 
        WHERE id = p_org_id AND is_locked_down = TRUE
    );
END;
$$;

-- 4. Lockdown/Unlock RPCs
CREATE OR REPLACE FUNCTION lockdown_tenant(
    p_org_id UUID,
    p_reason TEXT,
    p_severity TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_affected_count INTEGER;
BEGIN
    -- Authorization: Only platform admins can lockdown a tenant
    IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can trigger tenant isolation.';
    END IF;

    -- Update organization status
    UPDATE organizations
    SET is_locked_down = TRUE,
        locked_at = now(),
        locked_by = auth.uid(),
        lockdown_reason = p_reason,
        lockdown_severity = p_severity
    WHERE id = p_org_id;

    -- Calculate affected users (Workers + Profiles)
    SELECT count(*) INTO v_affected_count
    FROM (
        SELECT id FROM workers WHERE org_id = p_org_id
        UNION ALL
        SELECT id FROM profiles WHERE org_id = p_org_id
    ) AS all_users;

    -- Generate initial breach report record
    INSERT INTO breach_reports (
        org_id,
        severity,
        description,
        affected_users_count,
        filed_by,
        auto_generated_data
    ) VALUES (
        p_org_id,
        p_severity,
        p_reason,
        v_affected_count,
        auth.uid(),
        jsonb_build_object(
            'detection_date', now(),
            'affected_count', v_affected_count,
            'reason', p_reason,
            'severity', p_severity
        )
    );

    -- Log the event
    INSERT INTO audit_log (org_id, table_name, record_id, action, new_data, changed_by)
    VALUES (
        p_org_id,
        'organizations',
        p_org_id::TEXT,
        'UPDATE',
        jsonb_build_object('is_locked_down', true, 'reason', p_reason),
        auth.uid()
    );

    RETURN jsonb_build_object('success', true, 'locked_at', now(), 'affected_users', v_affected_count);
END;
$$;

CREATE OR REPLACE FUNCTION unlock_tenant(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Authorization
    IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can lift tenant isolation.';
    END IF;

    UPDATE organizations
    SET is_locked_down = FALSE,
        locked_at = NULL,
        locked_by = NULL,
        lockdown_reason = NULL,
        lockdown_severity = NULL
    WHERE id = p_org_id;

    -- Log the event
    INSERT INTO audit_log (org_id, table_name, record_id, action, new_data, changed_by)
    VALUES (
        p_org_id,
        'organizations',
        p_org_id::TEXT,
        'UPDATE',
        jsonb_build_object('is_locked_down', false, 'event', 'Isolation Lifted'),
        auth.uid()
    );

    RETURN jsonb_build_object('success', true, 'unlocked_at', now());
END;
$$;

-- 5. REINFORCE RLS POLICIES (Blocking Mutations during Lockdown)

-- Production Logs
DROP POLICY IF EXISTS "Supervisor/Owner Insert" ON production_logs;
CREATE POLICY "Supervisor/Owner Insert (Lockdown Aware)" ON production_logs
    FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()) AND
        NOT check_org_lockdown(org_id)
    );

DROP POLICY IF EXISTS "Owner Update" ON production_logs;
CREATE POLICY "Owner Update (Lockdown Aware)" ON production_logs
    FOR UPDATE
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner' AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()) AND
        NOT check_org_lockdown(org_id)
    );

-- Workers
DROP POLICY IF EXISTS "Owners Manage Workers" ON workers;
CREATE POLICY "Owners Manage Workers (Lockdown Aware)" ON workers
    FOR ALL
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner' AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()) AND
        NOT check_org_lockdown(org_id)
    );

-- Attendance
DROP POLICY IF EXISTS "Anyone in org can log attendance" ON attendance;
CREATE POLICY "Anyone in org can log attendance (Lockdown Aware)" ON attendance
    FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()) AND
        NOT check_org_lockdown(org_id)
    );

-- Note: We allow SELECT (Read) for investigation, but block all state changes.
