-- Add last_code_plain to organizations to support manual forwarding when WhatsApp is down
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS last_code_plain TEXT;
