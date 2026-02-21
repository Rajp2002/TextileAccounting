-- Update machine_assignments RLS to allow supervisors to manage assignments

-- Drop existing policy
DROP POLICY IF EXISTS "Owners Manage Assignments" ON machine_assignments;

-- Create new policy for Owners and Supervisors to INSERT/UPDATE/DELETE assignments
CREATE POLICY "Owners and Supervisors Manage Assignments" ON machine_assignments
    FOR ALL
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'supervisor') AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- Add DELETE policy for machines (Owner only) - was missing or implicit in "Owners Manage Machines" ALL policy, checking just in case
-- The existing policy "Owners Manage Machines" is FOR ALL, so it covers DELETE.
-- However, we verified in the plan that we'd check this. The previous migration had:
-- CREATE POLICY "Owners Manage Machines" ON machines FOR ALL ...
-- So we don't need to add it again, but good to be sure.

-- Explicitly ensure machines is Owner only for ALL operations (redundant but safe)
-- DROP POLICY IF EXISTS "Owners Manage Machines" ON machines;
-- CREATE POLICY "Owners Manage Machines" ON machines
--     FOR ALL
--     USING (
--         (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner' AND
--         org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
--     );
