-- ============================================================
-- OSHWC Incidents Table
-- Tracks workplace accidents and safety incidents as mandated 
-- by the OSHWC Code (India)
-- ============================================================

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
    reported_by UUID NOT NULL REFERENCES auth.users(id),
    worker_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX idx_incidents_org_id ON incidents(org_id);
CREATE INDEX idx_incidents_date ON incidents(date DESC);

-- Enable RLS
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Owner policies (Full access to own org)
CREATE POLICY "Owners can view own org incidents" ON incidents
    FOR SELECT USING (
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
    );

CREATE POLICY "Owners can insert incidents" ON incidents
    FOR INSERT WITH CHECK (
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
    );

CREATE POLICY "Owners can update incidents" ON incidents
    FOR UPDATE USING (
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
    );

CREATE POLICY "Owners can delete incidents" ON incidents
    FOR DELETE USING (
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
    );

-- Supervisor policies (Can insert and select, but not update/delete)
CREATE POLICY "Supervisors can view own org incidents" ON incidents
    FOR SELECT USING (
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'supervisor'
    );

CREATE POLICY "Supervisors can insert incidents" ON incidents
    FOR INSERT WITH CHECK (
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'supervisor'
    );
