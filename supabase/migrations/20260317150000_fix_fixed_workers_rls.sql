-- MIGRATION: Fix Fixed Workers RLS and Constraints (SEC-005)
-- Relaxes RLS to allow supervisors to add/edit fixed workers and ensures custom roles work.

-- 1. DROP the restrictive "FOR ALL" policy
DROP POLICY IF EXISTS "Owners Manage Fixed Workers" ON fixed_workers;

-- 2. CREATE explicit policies for INSERT and UPDATE (allow both owners and supervisors)
-- Using auth.jwt() claims for performance consistency with other tables.
CREATE POLICY "Supervisors and Owners Insert Fixed Workers" ON fixed_workers
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

CREATE POLICY "Supervisors and Owners Update Fixed Workers" ON fixed_workers
    FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- 3. CREATE explicit policy for DELETE (owner only)
CREATE POLICY "Owner Delete Fixed Workers" ON fixed_workers
    FOR DELETE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- 4. Ensure the role check constraint is truly gone (support custom roles like "plumber")
ALTER TABLE fixed_workers DROP CONSTRAINT IF EXISTS fixed_workers_role_check;
ALTER TABLE fixed_workers DROP CONSTRAINT IF EXISTS fixed_workers_role_check1;
