-- ============================================================
-- MIGRATION: Compliance V3 Refinement — Multi-language Support
-- ============================================================

-- 1. Refine notice_registry for multi-language support
ALTER TABLE notice_registry DROP CONSTRAINT IF EXISTS notice_registry_version_string_key;

ALTER TABLE notice_registry 
    ADD COLUMN IF NOT EXISTS language_code TEXT NOT NULL DEFAULT 'en',
    RENAME COLUMN content_text TO body_text,
    RENAME COLUMN translation_text TO english_transcript;

-- Ensure version + language is unique
ALTER TABLE notice_registry 
    ADD CONSTRAINT notice_registry_version_lang_unique UNIQUE (version_string, language_code);

-- 2. Refine worker_consent_artifacts for Erasure (Anonymization)
ALTER TABLE worker_consent_artifacts 
    ALTER COLUMN worker_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS erased_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS granular_consent JSONB; -- e.g. {"A": true, "B": true}

-- 3. Create language_requests table for 22-language rule
CREATE TABLE IF NOT EXISTS language_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    language_code TEXT NOT NULL,
    worker_name_hint TEXT, -- To help owner know who requested it
    requested_at TIMESTAMPTZ DEFAULT now()
);

-- Index for owner dashboard
CREATE INDEX IF NOT EXISTS idx_language_requests_org ON language_requests(org_id);

-- 4. Initial Seed for "Surat Trio" (Example)
-- Updated with explicit purposes to avoid "Dark Pattern" audits (DPDP 2026)
INSERT INTO notice_registry (version_string, notice_type, language_code, body_text, english_transcript, content_hash, is_active)
VALUES 
('v1.0', 'consent', 'en', 'I hereby consent to the collection and processing of my wage data for (A) Payroll calculation and (B) Statutory deductions like Professional Tax (PT).', 'I hereby consent to wage data processing for payroll and PT deductions.', 'hash_en_v1', true),
('v1.0', 'consent', 'hi', 'मैं एतद्द्वारा (A) पेरोल गणना और (B) प्रोफेशनल टैक्स (PT) जैसी वैधानिक कटौती के लिए अपने वेतन डेटा के संग्रह और प्रसंस्करण के लिए अपनी सहमति देता हूं।', 'I hereby consent to wage data processing for payroll and PT deductions.', 'hash_hi_v1', true),
('v1.0', 'consent', 'gu', 'હું આથી (A) પેરોલ ગણતરી અને (B) પ્રોફેશનલ ટેક્સ (PT) જેવી વૈધાનિક કપાત માટે મારા પગારના ડેટાના સંગ્રહ અને પ્રક્રિયા માટે મારી સંમતિ આપું છું.', 'I hereby consent to wage data processing for payroll and PT deductions.', 'hash_gu_v1', true)
ON CONFLICT DO NOTHING;
