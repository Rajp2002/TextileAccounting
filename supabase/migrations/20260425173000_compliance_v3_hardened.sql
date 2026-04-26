-- ============================================================
-- MIGRATION: Compliance V3 — DPDP 2026 & Gujarat IT Policy
-- ============================================================
-- 1. Platform Security & Emergency Lockdown
-- 2. DPDP Consent Provenance (Notice Registry)
-- 3. Grievance Redressal (7-day Resolution Clock)
-- 4. Local Value Proof (IP Logging)
-- ============================================================

-- ─── 1. PLATFORM SECURITY (The "Big Red Button") ──────────────
CREATE TABLE IF NOT EXISTS platform_security (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  is_locked_down BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  CONSTRAINT single_row CHECK (id = TRUE)
);

INSERT INTO platform_security (id, is_locked_down) 
VALUES (TRUE, FALSE) 
ON CONFLICT DO NOTHING;

-- Emergency Lockdown RPC
CREATE OR REPLACE FUNCTION emergency_lockdown()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- Authorization: Only owners can trigger a lockdown
    SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
    
    IF v_role != 'owner' THEN
        RAISE EXCEPTION 'Unauthorized: Only the Primary Fiduciary can trigger a platform lockdown.';
    END IF;

    UPDATE platform_security 
    SET is_locked_down = TRUE, 
        locked_at = now(),
        locked_by = auth.uid()
    WHERE id = TRUE;
      
    -- Log the event in the audit_log
    INSERT INTO audit_log (org_id, table_name, record_id, action, new_data, changed_by)
    VALUES (
        (SELECT org_id FROM profiles WHERE id = auth.uid()),
        'platform_security',
        'GLOBAL',
        'UPDATE',
        jsonb_build_object('is_locked_down', true, 'reason', 'Emergency Lockdown Triggered'),
        auth.uid()
    );

    RETURN jsonb_build_object('success', true, 'locked_at', now());
END;
$$;

-- ─── 2. DPDP CONSENT PROVENANCE ─────────────────────────────
-- Versioned registry of legal notices
CREATE TABLE IF NOT EXISTS notice_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_string TEXT NOT NULL UNIQUE, -- e.g. 'v1.0'
    notice_type TEXT NOT NULL CHECK (notice_type IN ('consent', 'privacy', 'erasure_notice')),
    content_text TEXT,
    translation_text TEXT, -- English transcript for regional notices (audit proof)
    content_audio_url TEXT, -- Link to audio notice for illiterate workers
    content_hash TEXT NOT NULL, -- Integrity proof for audits
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual worker consent artifacts
CREATE TABLE IF NOT EXISTS worker_consent_artifacts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id),
    worker_id BIGINT NOT NULL, -- Generic worker ID (handled via logic)
    notice_version_id UUID NOT NULL REFERENCES notice_registry(id),
    consent_given BOOLEAN NOT NULL DEFAULT false,
    ip_address TEXT, -- Proof of origin
    timestamp TIMESTAMPTZ DEFAULT now(),
    audit_hash TEXT NOT NULL -- Hash(worker_id + notice_id + timestamp + ip)
);

CREATE INDEX idx_worker_consent_worker ON worker_consent_artifacts(worker_id);

-- ─── 3. GRIEVANCE REDRESSAL (The 7-Day Clock) ───────────────
CREATE TABLE IF NOT EXISTS grievances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    worker_id BIGINT,
    subject TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'acknowledged', 'resolved', 'escalated')),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    target_resolution_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to maintain target_resolution_date (7-day clock)
-- We use a trigger because generated columns with TIMESTAMPTZ -> DATE casts are non-immutable in Postgres
CREATE OR REPLACE FUNCTION handle_grievance_target_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.acknowledged_at IS NOT NULL AND (OLD.acknowledged_at IS NULL OR NEW.acknowledged_at != OLD.acknowledged_at) THEN
        NEW.target_resolution_date := (NEW.acknowledged_at AT TIME ZONE 'UTC')::DATE + 7;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_grievance_acknowledged
    BEFORE INSERT OR UPDATE ON grievances
    FOR EACH ROW
    EXECUTE FUNCTION handle_grievance_target_date();

CREATE INDEX idx_grievances_org_status ON grievances(org_id, status);

-- ─── 4. LOCAL VALUE PROOF (IP Logging) ──────────────────────
-- Add ip_address to track provenance for Gujarat DST subsidies
ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS client_ip TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS client_ip TEXT;

COMMENT ON COLUMN production_logs.client_ip IS 'Required for Gujarat DST 15% OPEX subsidy audit proof.';
COMMENT ON COLUMN attendance.client_ip IS 'Required for Gujarat DST 15% OPEX subsidy audit proof.';

-- ─── 5. LOCKDOWN AWARE RLS (Example Update) ────────────────
-- We will need to update existing RLS policies to check platform_security.
-- This logic will be applied in subsequent policy refactors.
