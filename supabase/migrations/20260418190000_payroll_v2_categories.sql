-- ============================================================
-- MIGRATION: Payroll V2 Schema Evolution (Part 1)
-- 1. Create payroll_adjustment_categories with deletion guard
-- 2. Seed default categories idempotently
-- ============================================================

-- 1. Create the categories table
CREATE TABLE IF NOT EXISTS payroll_adjustment_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    slug TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bonus', 'fine')),
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure slug is unique per org
    UNIQUE(org_id, slug)
);

-- Enable RLS
ALTER TABLE payroll_adjustment_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation" ON payroll_adjustment_categories
    FOR SELECT USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Owners Manage Categories" ON payroll_adjustment_categories
    FOR ALL USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner' AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- 2. Hard Deletion Guard Trigger
CREATE OR REPLACE FUNCTION protect_default_categories()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_default THEN
        RAISE EXCEPTION 'Cannot delete a system-default category.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_default_categories
BEFORE DELETE ON payroll_adjustment_categories
FOR EACH ROW EXECUTE FUNCTION protect_default_categories();

-- 3. Idempotent Seeding for existing organizations
-- This ensures every existing factory gets the core categories immediately
DO $$
DECLARE
    v_org RECORD;
BEGIN
    FOR v_org IN SELECT id FROM organizations LOOP
        INSERT INTO payroll_adjustment_categories (org_id, is_default, slug, type, label)
        VALUES 
            (v_org.id, true, 'yarn_wastage', 'fine', 'Yarn Wastage'),
            (v_org.id, true, 'machine_damage', 'fine', 'Machine Damage'),
            (v_org.id, true, 'attendance_fine', 'fine', 'Attendance Penalty'),
            (v_org.id, true, 'diwali_inam', 'bonus', 'Diwali Bonus'),
            (v_org.id, true, 'eid_bonus', 'bonus', 'Eid Bonus'),
            (v_org.id, true, 'production_incentive', 'bonus', 'Production Incentive')
        ON CONFLICT (org_id, slug) DO NOTHING;
    END LOOP;
END $$;
