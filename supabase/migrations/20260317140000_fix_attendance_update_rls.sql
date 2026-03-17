-- Migration to allow both owners and supervisors to update attendance
-- This aligns attendance with production logs, allowing the supervisor UI to use the "unlocked" upsert flow

DROP POLICY IF EXISTS "Owner Update Attendance" ON attendance;

CREATE POLICY "Supervisor/Owner Update Attendance" ON attendance
    FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );
