-- PURGE ALL DATA SCRIPT
-- WARNING: This will delete ALL users, profiles, organizations, and related data.

-- Disable RLS temporarily to ensure deletion works
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- Delete all profiles (cascades to nothing usually, but good to be sure)
DELETE FROM profiles;

-- Delete all organizations (cascades to workers, machines, logs)
DELETE FROM organizations;

-- Delete from auth.users (cascades to identities, etc.)
-- Note: We can't delete from auth.users directly via SQL Editor usually due to permissions,
-- so we rely on the Supabase Admin API to do this part, OR if we are superuser.
-- For the local dev environment or service role, we can delete from auth.users via RPC or direct query if enabled.

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
