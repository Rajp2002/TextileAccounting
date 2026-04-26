-- Migration: Add is_configured flag to factory_cost_profile to track onboarding status
ALTER TABLE factory_cost_profile
  ADD COLUMN IF NOT EXISTS is_configured boolean NOT NULL DEFAULT false;

-- Mark existing profiles as configured to avoid breaking current users
UPDATE factory_cost_profile
SET is_configured = true
WHERE updated_at IS NOT NULL;
