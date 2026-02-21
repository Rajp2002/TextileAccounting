-- ============================================================
-- MIGRATION: Access Code System + RLS Policy Fixes
-- ============================================================
-- 1. Add access_code columns to organizations
-- 2. Fix attendance RLS (supervisors: today only, past dates need code)
-- 3. Fix production_logs INSERT to require role check
-- 4. Fix workers/machines: supervisors lose DELETE
-- ============================================================

-- 1. Add owner access code columns to organizations
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS access_code_hash TEXT,
    ADD COLUMN IF NOT EXISTS access_code_expires_at TIMESTAMPTZ;

-- ============================================================
-- 2. ATTENDANCE RLS FIXES
-- ============================================================

-- Drop all existing attendance write policies
DROP POLICY IF EXISTS "Supervisor/Owner Insert Attendance" ON attendance;
DROP POLICY IF EXISTS "Supervisor/Owner Update Attendance" ON attendance;
DROP POLICY IF EXISTS "Owner Delete Attendance" ON attendance;

-- INSERT: Supervisors and Owners can insert attendance for TODAY only
-- Past dates require an access code — enforced at app layer (server action)
CREATE POLICY "Supervisor/Owner Insert Attendance Today" ON attendance
    FOR INSERT
    WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'supervisor') AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()) AND
        date = CURRENT_DATE
    );

-- INSERT (past dates): Only owners can insert for past dates directly via DB
-- Past date inserts from supervisors go through the server action after code validation
CREATE POLICY "Owner Insert Attendance Any Date" ON attendance
    FOR INSERT
    WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner' AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- UPDATE: Only owners can UPDATE attendance (supervisors use today's insert/upsert)
CREATE POLICY "Owner Update Attendance" ON attendance
    FOR UPDATE
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner' AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- DELETE: Only owners can delete attendance records
CREATE POLICY "Owner Delete Attendance" ON attendance
    FOR DELETE
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner' AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- ============================================================
-- 3. PRODUCTION LOGS INSERT ROLE CHECK
-- ============================================================

DROP POLICY IF EXISTS "Supervisor/Owner Insert" ON production_logs;

CREATE POLICY "Supervisor/Owner Insert" ON production_logs
    FOR INSERT
    WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'supervisor') AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- ============================================================
-- 4. WORKERS — Remove supervisor DELETE, keep INSERT/UPDATE
-- ============================================================

DROP POLICY IF EXISTS "Supervisors and Owners Manage Workers" ON workers;

-- Supervisors and Owners: INSERT
CREATE POLICY "Supervisors and Owners Insert Workers" ON workers
    FOR INSERT
    WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'supervisor') AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- Supervisors and Owners: UPDATE
CREATE POLICY "Supervisors and Owners Update Workers" ON workers
    FOR UPDATE
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'supervisor') AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- DELETE: Only owners (access-code validated delete from supervisors goes through server action with service role)
CREATE POLICY "Owner Delete Workers" ON workers
    FOR DELETE
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner' AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- ============================================================
-- 5. MACHINES — Remove supervisor DELETE, keep INSERT/UPDATE
-- ============================================================

DROP POLICY IF EXISTS "Supervisors and Owners Manage Machines" ON machines;

-- Supervisors and Owners: INSERT
CREATE POLICY "Supervisors and Owners Insert Machines" ON machines
    FOR INSERT
    WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'supervisor') AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- Supervisors and Owners: UPDATE
CREATE POLICY "Supervisors and Owners Update Machines" ON machines
    FOR UPDATE
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'supervisor') AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );

-- DELETE: Only owners (access-code validated delete from supervisors goes through server action)
CREATE POLICY "Owner Delete Machines" ON machines
    FOR DELETE
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner' AND
        org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    );
