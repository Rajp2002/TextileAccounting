-- Allow SUPERVISORS to manage workers and machines
-- (Previously restricted to owners only)

-- ============================================================
-- WORKERS
-- ============================================================

-- Drop old policy
DROP POLICY IF EXISTS "Owners Manage Workers" ON workers;

-- Create new policy allowing both Owners AND Supervisors
CREATE POLICY "Supervisors and Owners Manage Workers" ON workers
    FOR ALL
    USING (
        (
            (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'supervisor')
        ) AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- ============================================================
-- MACHINES
-- ============================================================

-- Drop old policy
DROP POLICY IF EXISTS "Owners Manage Machines" ON machines;

-- Create new policy allowing both Owners AND Supervisors
CREATE POLICY "Supervisors and Owners Manage Machines" ON machines
    FOR ALL
    USING (
        (
            (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'supervisor')
        ) AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );
