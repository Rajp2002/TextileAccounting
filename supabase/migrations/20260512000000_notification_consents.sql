-- ============================================================
-- MIGRATION: WhatsApp Consent Readiness
-- ============================================================

-- Create notification_consents table
CREATE TABLE IF NOT EXISTS notification_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_type TEXT NOT NULL CHECK (person_type IN ('owner', 'supervisor', 'worker', 'party')),
    person_id TEXT NOT NULL,
    phone TEXT,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    consent_status TEXT NOT NULL CHECK (consent_status IN ('opted_in', 'opted_out')),
    consent_source TEXT, -- 'web', 'sms', 'manual'
    consent_text_version TEXT,
    consented_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    captured_by_user_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (org_id, person_type, person_id, channel)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_consents_org_id ON notification_consents(org_id);
CREATE INDEX IF NOT EXISTS idx_notification_consents_lookup ON notification_consents(person_type, person_id);
CREATE INDEX IF NOT EXISTS idx_notification_consents_channel_status ON notification_consents(channel, consent_status);

-- Enable RLS
ALTER TABLE notification_consents ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "notification_consents_select" ON notification_consents
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "notification_consents_insert" ON notification_consents
    FOR INSERT
    WITH CHECK (
        org_id = (auth.jwt() ->> 'org_id')::uuid
        AND (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    );

CREATE POLICY "notification_consents_update" ON notification_consents
    FOR UPDATE
    USING (
        org_id = (auth.jwt() ->> 'org_id')::uuid
        AND (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    )
    WITH CHECK (
        org_id = (auth.jwt() ->> 'org_id')::uuid
        AND (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    );

-- Update whatsapp_delivery_log status check constraint
-- PostgreSQL generates names like table_column_check if not specified.
-- We try to drop it if it exists.
ALTER TABLE whatsapp_delivery_log DROP CONSTRAINT IF EXISTS whatsapp_delivery_log_status_check;
ALTER TABLE whatsapp_delivery_log ADD CONSTRAINT whatsapp_delivery_log_status_check 
    CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'skipped_opted_out', 'skipped_missing_consent', 'skipped_missing_phone'));
