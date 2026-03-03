-- Migration to allow both owners and supervisors to update production_logs
-- This is necessary because the supervisor dashboard uses an `upsert` mechanism to save logs, which requires UPDATE privileges.

DROP POLICY IF EXISTS "Owner Update" ON production_logs;

CREATE POLICY "Supervisor/Owner Update" ON production_logs
    FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );
