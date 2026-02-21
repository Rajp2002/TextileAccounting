-- ==============================================================================
-- ⚠️ DANGER: THIS SCRIPT DELETES ALL DATA ⚠️
-- Run this in your Supabase Dashboard -> SQL Editor to reset the database.
-- ==============================================================================

-- 1. Truncate application tables (Cascade deletes dependent rows)
TRUNCATE TABLE production_logs CASCADE;
TRUNCATE TABLE machine_assignments CASCADE;
TRUNCATE TABLE machines CASCADE; -- machines are created by owners
TRUNCATE TABLE workers CASCADE;
TRUNCATE TABLE profiles CASCADE;
TRUNCATE TABLE organizations CASCADE;

-- 2. Delete all Auth Users (This allows you to sign up again with the same email)
-- Note: This requires the Postgres role to have permission to delete from auth.users
-- If this fails, you can delete users from Authentication -> Users in the dashboard.
DELETE FROM auth.users;

-- 3. (Optional) Reset Migrations if you want to re-run them cleanly (Advanced)
-- DELETE FROM supabase_migrations; 
