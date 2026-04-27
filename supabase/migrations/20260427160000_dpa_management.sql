-- ============================================================
-- MIGRATION: DPA Management (DPDP 2026)
-- ============================================================

-- 1. Create DPAs table (Agreement Templates)
CREATE TABLE IF NOT EXISTS dpas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_string TEXT NOT NULL UNIQUE,
    content_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Organization DPAs table (Signatures)
CREATE TABLE IF NOT EXISTS organization_dpas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    dpa_id UUID NOT NULL REFERENCES dpas(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'signed', 'expired')),
    signed_at TIMESTAMPTZ,
    signed_by UUID REFERENCES profiles(id),
    proof_url TEXT, -- Link to scanned DPA or digital signature record
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, dpa_id)
);

-- 3. Enable RLS
ALTER TABLE dpas ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_dpas ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Admin Access

-- DPAs: Admins manage all
CREATE POLICY "Admins manage dpas" ON dpas
    FOR ALL
    USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- DPAs: Everyone can view active ones (though mainly for admin/owner visibility)
CREATE POLICY "View active dpas" ON dpas
    FOR SELECT
    USING (is_active = true OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Organization DPAs: Admins manage all
CREATE POLICY "Admins manage organization_dpas" ON organization_dpas
    FOR ALL
    USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Organization DPAs: Owners can view their own
CREATE POLICY "Owners view their own dpas" ON organization_dpas
    FOR SELECT
    USING (
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- 5. Audit Logging for DPA actions
-- (Handled via application logic/server actions)

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dpas_updated_at BEFORE UPDATE ON dpas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_organization_dpas_updated_at BEFORE UPDATE ON organization_dpas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 7. Insert initial DPA template
INSERT INTO dpas (version_string, content_text, is_active)
VALUES ('v1.0', 'This Data Processing Agreement ("DPA") is entered into between Weavly (the "Processor") and the Factory Owner (the "Fiduciary"). The Processor shall process worker data (names, WhatsApp numbers, wages) solely on behalf of the Fiduciary and in accordance with the Digital Personal Data Protection Act (DPDP), 2026.', true)
ON CONFLICT DO NOTHING;
