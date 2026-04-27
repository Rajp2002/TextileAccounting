-- ============================================================
-- MIGRATION: Grievance Target Tracking (DPDP 2026)
-- ============================================================

-- 1. Add Target Entity and Grievance Type to track who the grievance is filed against
ALTER TABLE grievances 
    ADD COLUMN IF NOT EXISTS target_entity TEXT NOT NULL DEFAULT 'FACTORY_OWNER' CHECK (target_entity IN ('WEAVLY', 'FACTORY_OWNER')),
    ADD COLUMN IF NOT EXISTS grievance_type TEXT NOT NULL DEFAULT 'OPERATIONAL' CHECK (grievance_type IN ('DATA_PRIVACY', 'OPERATIONAL', 'OTHER')),
    ADD COLUMN IF NOT EXISTS filed_by_role TEXT NOT NULL DEFAULT 'worker' CHECK (filed_by_role IN ('worker', 'supervisor', 'owner', 'admin'));

-- 2. Update comments for auditability
COMMENT ON COLUMN grievances.target_entity IS 'Specifies if the grievance is against Weavly (Processor) or the Factory Owner (Fiduciary).';
COMMENT ON COLUMN grievances.grievance_type IS 'Distinguishes between DPDP data privacy concerns and general operational/labor issues.';

-- 3. Add index for efficient filtering in Admin dashboard
CREATE INDEX IF NOT EXISTS idx_grievances_target_type ON grievances(target_entity, grievance_type);
