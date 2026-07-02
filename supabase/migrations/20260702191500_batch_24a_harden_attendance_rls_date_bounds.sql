-- Migration to harden attendance RLS date boundaries (PAY-006)
-- Enforces that:
-- 1. Supervisors can only INSERT/UPDATE attendance for today (in Asia/Kolkata timezone context).
-- 2. Owners can INSERT/UPDATE attendance for today or past dates, but not future dates.
-- 3. All direct future writes are blocked at the RLS boundary.

-- Drop legacy permissive policies on public.attendance
DROP POLICY IF EXISTS "Supervisor/Owner Insert Attendance" ON public.attendance;
DROP POLICY IF EXISTS "Supervisor/Owner Update Attendance" ON public.attendance;
DROP POLICY IF EXISTS "Owner Insert Attendance Any Date" ON public.attendance;
DROP POLICY IF EXISTS "Owner Update Attendance" ON public.attendance;

-- Create hardened policies

-- 1. Supervisor Insert: Today only
CREATE POLICY "Supervisor Insert Attendance Today" ON public.attendance
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') = 'supervisor' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid AND
        date = (now() AT TIME ZONE 'Asia/Kolkata')::date
    );

-- 2. Supervisor Update: Today only
CREATE POLICY "Supervisor Update Attendance Today" ON public.attendance
    FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') = 'supervisor' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid AND
        date = (now() AT TIME ZONE 'Asia/Kolkata')::date
    )
    WITH CHECK (
        (auth.jwt() ->> 'user_role') = 'supervisor' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid AND
        date = (now() AT TIME ZONE 'Asia/Kolkata')::date
    );

-- 3. Owner Insert: Today or past only
CREATE POLICY "Owner Insert Attendance Past/Today" ON public.attendance
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid AND
        date <= (now() AT TIME ZONE 'Asia/Kolkata')::date
    );

-- 4. Owner Update: Today or past only
CREATE POLICY "Owner Update Attendance Past/Today" ON public.attendance
    FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid AND
        date <= (now() AT TIME ZONE 'Asia/Kolkata')::date
    )
    WITH CHECK (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid AND
        date <= (now() AT TIME ZONE 'Asia/Kolkata')::date
    );
