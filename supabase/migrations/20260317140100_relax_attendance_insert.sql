-- Relax the insert policy for attendance to match production_logs
-- This allows client-side upserts to succeed for past dates after the UI has verified the owner access code.
-- The application UI enforces the access code requirement for past dates.

DROP POLICY IF EXISTS "Supervisor/Owner Insert Attendance Today" ON attendance;
DROP POLICY IF EXISTS "Supervisor/Owner Insert Attendance" ON attendance;

CREATE POLICY "Supervisor/Owner Insert Attendance" ON attendance
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );
