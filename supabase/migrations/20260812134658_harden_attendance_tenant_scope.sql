-- Keep attendance identity inside the tenant boundary. The original unique
-- key allowed a service-role upsert keyed only by worker ID and date to
-- resolve a row belonging to another organization.
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_fixed_worker_id_date_key;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_org_id_fixed_worker_id_date_key
  UNIQUE (org_id, fixed_worker_id, date);

-- Direct authenticated writes must also prove that the worker belongs to the
-- caller's organization. The server action performs the same check because
-- service_role bypasses RLS.
DROP POLICY IF EXISTS "Supervisor Insert Attendance Today" ON public.attendance;
CREATE POLICY "Supervisor Insert Attendance Today"
  ON public.attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'supervisor'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND date = (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND fixed_worker_id IN (
      SELECT fw.id
      FROM public.fixed_workers AS fw
      WHERE fw.org_id = (SELECT p.org_id FROM public.profiles AS p WHERE p.id = auth.uid())
    )
    AND NOT public.check_org_lockdown(org_id)
  );

DROP POLICY IF EXISTS "Supervisor Update Attendance Today" ON public.attendance;
CREATE POLICY "Supervisor Update Attendance Today"
  ON public.attendance
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'supervisor'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND date = (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND fixed_worker_id IN (
      SELECT fw.id
      FROM public.fixed_workers AS fw
      WHERE fw.org_id = (SELECT p.org_id FROM public.profiles AS p WHERE p.id = auth.uid())
    )
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'supervisor'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND date = (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND fixed_worker_id IN (
      SELECT fw.id
      FROM public.fixed_workers AS fw
      WHERE fw.org_id = (SELECT p.org_id FROM public.profiles AS p WHERE p.id = auth.uid())
    )
    AND NOT public.check_org_lockdown(org_id)
  );

DROP POLICY IF EXISTS "Owner Insert Attendance Past/Today" ON public.attendance;
CREATE POLICY "Owner Insert Attendance Past/Today"
  ON public.attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND date <= (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND fixed_worker_id IN (
      SELECT fw.id
      FROM public.fixed_workers AS fw
      WHERE fw.org_id = (SELECT p.org_id FROM public.profiles AS p WHERE p.id = auth.uid())
    )
    AND NOT public.check_org_lockdown(org_id)
  );

DROP POLICY IF EXISTS "Owner Update Attendance Past/Today" ON public.attendance;
CREATE POLICY "Owner Update Attendance Past/Today"
  ON public.attendance
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND date <= (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND fixed_worker_id IN (
      SELECT fw.id
      FROM public.fixed_workers AS fw
      WHERE fw.org_id = (SELECT p.org_id FROM public.profiles AS p WHERE p.id = auth.uid())
    )
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND date <= (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND fixed_worker_id IN (
      SELECT fw.id
      FROM public.fixed_workers AS fw
      WHERE fw.org_id = (SELECT p.org_id FROM public.profiles AS p WHERE p.id = auth.uid())
    )
    AND NOT public.check_org_lockdown(org_id)
  );
