-- ============================================================
-- MIGRATION: Base Plan Onboarding State & Versioning
-- Stores base_onboarding draft and completion status per organization.
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS base_onboarding JSONB DEFAULT NULL;

COMMENT ON COLUMN public.organizations.base_onboarding IS
  'Base plan factory setup onboarding state: version, completed steps, timestamps, and draft.';
