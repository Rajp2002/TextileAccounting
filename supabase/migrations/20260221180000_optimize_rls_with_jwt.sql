-- ============================================================
-- MIGRATION: Optimize RLS with JWT Claims (PERF-001 Complete)
-- ============================================================
-- Replaces (SELECT org_id FROM profiles) AND (SELECT role FROM profiles)
-- subqueries with auth.jwt() claims for massive performance gains.
-- ============================================================

-- 1. ORGANIZATIONS
DROP POLICY IF EXISTS "Tenant Isolation" ON organizations;
CREATE POLICY "Tenant Isolation" ON organizations
    FOR SELECT
    USING (id = (auth.jwt() ->> 'org_id')::uuid);

-- 2. PROFILES
DROP POLICY IF EXISTS "Tenant Isolation" ON profiles;
CREATE POLICY "Tenant Isolation" ON profiles
    FOR SELECT
    USING (
        id = auth.uid() OR
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- 3. WORKERS
DROP POLICY IF EXISTS "Tenant Isolation" ON workers;
CREATE POLICY "Tenant Isolation" ON workers
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

DROP POLICY IF EXISTS "Supervisors and Owners Insert Workers" ON workers;
CREATE POLICY "Supervisors and Owners Insert Workers" ON workers
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

DROP POLICY IF EXISTS "Supervisors and Owners Update Workers" ON workers;
CREATE POLICY "Supervisors and Owners Update Workers" ON workers
    FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

DROP POLICY IF EXISTS "Owner Delete Workers" ON workers;
CREATE POLICY "Owner Delete Workers" ON workers
    FOR DELETE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- 4. MACHINES
DROP POLICY IF EXISTS "Tenant Isolation" ON machines;
CREATE POLICY "Tenant Isolation" ON machines
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

DROP POLICY IF EXISTS "Supervisors and Owners Insert Machines" ON machines;
CREATE POLICY "Supervisors and Owners Insert Machines" ON machines
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

DROP POLICY IF EXISTS "Supervisors and Owners Update Machines" ON machines;
CREATE POLICY "Supervisors and Owners Update Machines" ON machines
    FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

DROP POLICY IF EXISTS "Owner Delete Machines" ON machines;
CREATE POLICY "Owner Delete Machines" ON machines
    FOR DELETE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- 5. PRODUCTION LOGS
DROP POLICY IF EXISTS "Tenant Isolation Select" ON production_logs;
CREATE POLICY "Tenant Isolation Select" ON production_logs
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

DROP POLICY IF EXISTS "Supervisor/Owner Insert" ON production_logs;
CREATE POLICY "Supervisor/Owner Insert" ON production_logs
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

DROP POLICY IF EXISTS "Owner Update" ON production_logs;
CREATE POLICY "Owner Update" ON production_logs
    FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

DROP POLICY IF EXISTS "Owner Delete" ON production_logs;
CREATE POLICY "Owner Delete" ON production_logs
    FOR DELETE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- 6. ATTENDANCE
DROP POLICY IF EXISTS "Tenant Isolation" ON attendance;
CREATE POLICY "Tenant Isolation" ON attendance
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

DROP POLICY IF EXISTS "Supervisor/Owner Insert Attendance Today" ON attendance;
CREATE POLICY "Supervisor/Owner Insert Attendance Today" ON attendance
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid AND
        date = CURRENT_DATE
    );

DROP POLICY IF EXISTS "Owner Insert Attendance Any Date" ON attendance;
CREATE POLICY "Owner Insert Attendance Any Date" ON attendance
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

DROP POLICY IF EXISTS "Owner Update Attendance" ON attendance;
CREATE POLICY "Owner Update Attendance" ON attendance
    FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

DROP POLICY IF EXISTS "Owner Delete Attendance" ON attendance;
CREATE POLICY "Owner Delete Attendance" ON attendance
    FOR DELETE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- 7. FIXED WORKERS
DROP POLICY IF EXISTS "Tenant Isolation" ON fixed_workers;
CREATE POLICY "Tenant Isolation" ON fixed_workers
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

DROP POLICY IF EXISTS "Owners Manage Fixed Workers" ON fixed_workers;
CREATE POLICY "Owners Manage Fixed Workers" ON fixed_workers
    FOR ALL
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- 8. PAYROLL PAYMENTS
DROP POLICY IF EXISTS "Tenant Isolation" ON payroll_payments;
CREATE POLICY "Tenant Isolation" ON payroll_payments
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

DROP POLICY IF EXISTS "Owners Manage Payroll" ON payroll_payments;
CREATE POLICY "Owners Manage Payroll" ON payroll_payments
    FOR ALL
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- 9. MACHINE ASSIGNMENTS
DROP POLICY IF EXISTS "Tenant Isolation" ON machine_assignments;
CREATE POLICY "Tenant Isolation" ON machine_assignments
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

DROP POLICY IF EXISTS "Owners and Supervisors Manage Assignments" ON machine_assignments;
CREATE POLICY "Owners and Supervisors Manage Assignments" ON machine_assignments
    FOR ALL
    USING (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );
