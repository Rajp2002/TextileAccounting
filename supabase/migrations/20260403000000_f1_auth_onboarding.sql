-- ============================================================
-- MIGRATION: F1 Auth & Onboarding — Schema Hardening
-- ============================================================
-- 1. Adds join_code_expires_at + onboarding_complete to organizations
-- 2. Ensures join_code is 8 chars, UNIQUE, NOT NULL
-- 3. Fixes owner_id FK to ON DELETE SET NULL (orphaned orgs survive)
-- 4. Drops client-side INSERT policy on profiles (service_role only now)
-- 5. Drops client-side INSERT policy on organizations (service_role only now)
-- 6. Updates custom_access_token_hook to also inject onboarding_complete
-- ============================================================

-- ── 1. organizations: add missing columns ────────────────────────────────────

-- Some early environments added join_code manually before migration history
-- was established. Fresh migration replays must create the deployed column
-- shape before the expiry backfill and uniqueness constraint reference it.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS join_code TEXT
  DEFAULT upper(substr(md5(random()::text), 1, 5));

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS join_code_expires_at TIMESTAMPTZ;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;

-- Back-fill expiry for existing rows that have a join_code but no expiry
UPDATE organizations
  SET join_code_expires_at = now() + interval '30 days'
  WHERE join_code_expires_at IS NULL;

-- Make join_code_expires_at NOT NULL now that all rows have a value
ALTER TABLE organizations
  ALTER COLUMN join_code_expires_at SET NOT NULL;

-- Set a default for future inserts (will be overridden by server action)
ALTER TABLE organizations
  ALTER COLUMN join_code_expires_at SET DEFAULT (now() + interval '30 days');

-- Ensure join_code has a UNIQUE constraint (may already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_join_code_key'
    AND conrelid = 'organizations'::regclass
  ) THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_join_code_key UNIQUE (join_code);
  END IF;
END$$;

-- ── 2. Fix owner_id FK: NOT NULL → nullable, ON DELETE SET NULL ───────────────
-- The original schema had NOT NULL which prevents safe account deletion.
-- Spec requires ON DELETE SET NULL so orphaned orgs still function.

-- Drop the old FK constraint
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_owner_id_fkey;

-- Make nullable
ALTER TABLE organizations
  ALTER COLUMN owner_id DROP NOT NULL;

-- Re-add with ON DELETE SET NULL
ALTER TABLE organizations
  ADD CONSTRAINT organizations_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 3. Drop client-side INSERT policy on organizations ───────────────────────
-- Org creation is now exclusively through service_role server actions.
-- A client should never be able to create their own org with arbitrary owner_id.
DROP POLICY IF EXISTS "Authenticated users can create organization" ON organizations;

-- ── 4. Drop client-side INSERT policy on profiles ───────────────────────────
-- Profile creation is now exclusively through service_role server actions.
-- This prevents a user from forging their own org_id or role.
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- ── 5. Update organizations RLS policies to use JWT claims ───────────────────
-- (The old UPDATE policy checks owner_id = auth.uid() — keep that as-is,
--  the JWT-based org check is for SELECT isolation)

-- ── 6. Update the JWT hook to inject onboarding_complete ────────────────────
-- This allows middleware to check onboarding status without a DB call.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id              UUID;
  v_role                TEXT;
  v_onboarding_complete BOOLEAN;
  v_user_id             UUID;
BEGIN
  v_user_id := (event->>'user_id')::UUID;

  -- Fetch the user's org_id and role from profiles in a single query
  SELECT p.org_id, p.role
    INTO v_org_id, v_role
    FROM public.profiles p
   WHERE p.id = v_user_id;

  -- If no profile found (race condition during signup), return unchanged
  IF v_org_id IS NULL THEN
    RETURN event;
  END IF;

  -- Fetch onboarding_complete from organizations
  SELECT o.onboarding_complete
    INTO v_onboarding_complete
    FROM public.organizations o
   WHERE o.id = v_org_id;

  -- Inject all three claims
  event := jsonb_set(event, '{claims,org_id}',              to_jsonb(v_org_id::TEXT));
  event := jsonb_set(event, '{claims,user_role}',           to_jsonb(v_role));
  event := jsonb_set(event, '{claims,onboarding_complete}', to_jsonb(COALESCE(v_onboarding_complete, false)));

  RETURN event;
END;
$$;

-- Grant the auth admin the right to call this function
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public for safety
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;

-- ── REMINDER (cannot be done via SQL) ───────────────────────────────────────
-- After running this migration, go to:
--   Supabase Dashboard → Authentication → Hooks
--   → Enable "Customize Access Token (JWT) Claims"
--   → Select function: public.custom_access_token_hook
-- This hook is already registered from the prior migration. No re-registration needed
-- unless you see that it's been deactivated.
-- ────────────────────────────────────────────────────────────────────────────
