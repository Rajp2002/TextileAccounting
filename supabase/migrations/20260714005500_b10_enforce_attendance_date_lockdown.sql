-- B10 / PAY-006: make attendance date rules authoritative at the RLS boundary.
--
-- The lockdown migration added broad permissive INSERT/UPDATE policies. Because
-- permissive policies are OR-combined, those policies bypassed the later
-- supervisor=today and owner<=today date policies. Replace the complete write
-- policy set with role-, tenant-, date-, and lockdown-aware policies.

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_insert_when_unlocked" ON public.attendance;
DROP POLICY IF EXISTS "attendance_update_when_unlocked" ON public.attendance;
DROP POLICY IF EXISTS "Supervisor Insert Attendance Today" ON public.attendance;
DROP POLICY IF EXISTS "Supervisor Update Attendance Today" ON public.attendance;
DROP POLICY IF EXISTS "Owner Insert Attendance Past/Today" ON public.attendance;
DROP POLICY IF EXISTS "Owner Update Attendance Past/Today" ON public.attendance;

CREATE POLICY "Supervisor Insert Attendance Today"
  ON public.attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'supervisor'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND date = (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND NOT public.check_org_lockdown(org_id)
  );

CREATE POLICY "Supervisor Update Attendance Today"
  ON public.attendance
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'supervisor'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND date = (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'supervisor'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND date = (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND NOT public.check_org_lockdown(org_id)
  );

CREATE POLICY "Owner Insert Attendance Past/Today"
  ON public.attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND date <= (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND NOT public.check_org_lockdown(org_id)
  );
CREATE POLICY "Owner Update Attendance Past/Today"
  ON public.attendance
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND date <= (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND date <= (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND NOT public.check_org_lockdown(org_id)
  );
