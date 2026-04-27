-- ============================================================
-- MIGRATION: Compliance Refinement V2 (DPDP 2026)
-- ============================================================

-- 1. Update grievances table with SLA tracking
ALTER TABLE grievances ADD COLUMN IF NOT EXISTS sla_applies BOOLEAN DEFAULT FALSE;

-- Update existing grievances logic
CREATE OR REPLACE FUNCTION handle_grievance_target_date()
RETURNS TRIGGER AS $$
BEGIN
    -- Derive if SLA applies: Strictly WEAVLY + DATA_PRIVACY (DPDP 7-day rule)
    IF NEW.target_entity = 'WEAVLY' AND NEW.grievance_type = 'DATA_PRIVACY' THEN
        NEW.sla_applies := TRUE;
    ELSE
        NEW.sla_applies := FALSE;
    END IF;

    -- Only set target resolution date if SLA applies and it's acknowledged
    IF NEW.sla_applies AND NEW.acknowledged_at IS NOT NULL AND (OLD.acknowledged_at IS NULL OR NEW.acknowledged_at != OLD.acknowledged_at) THEN
        NEW.target_resolution_date := (NEW.acknowledged_at AT TIME ZONE 'UTC')::DATE + 7;
    ELSIF NOT NEW.sla_applies THEN
        NEW.target_resolution_date := NULL; -- No strict SLA clock for operational disputes
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Update DPA RLS for Self-Service
-- Allow owners to sign their own DPAs
DROP POLICY IF EXISTS "Owners sign their own dpas" ON organization_dpas;
CREATE POLICY "Owners sign their own dpas" ON organization_dpas
    FOR INSERT
    WITH CHECK (
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()) AND
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
    );

DROP POLICY IF EXISTS "Owners update their own dpas" ON organization_dpas;
CREATE POLICY "Owners update their own dpas" ON organization_dpas
    FOR UPDATE
    USING (
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()) AND
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
    )
    WITH CHECK (
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()) AND
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
    );

-- 3. Update comments for clarity
COMMENT ON COLUMN grievances.sla_applies IS 'Indicates if the DPDP 7-day resolution SLA applies (only for WEAVLY + DATA_PRIVACY).';
