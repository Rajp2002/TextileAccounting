-- Migration: Refine Grievance Types for Security/Unlock Requests
-- Created: 2026-04-27 19:30:00

-- Using single-statement ALTER to avoid mid-recreation data risks
ALTER TABLE grievances 
  DROP CONSTRAINT IF EXISTS grievances_grievance_type_check,
  ADD CONSTRAINT grievances_grievance_type_check 
    CHECK (grievance_type IN ('DATA_PRIVACY', 'OPERATIONAL', 'OTHER', 'UNLOCK_REQUEST'));

COMMENT ON COLUMN grievances.grievance_type IS 'Distinguishes between DPDP data privacy concerns, general operational issues, and critical security unlock requests.';
