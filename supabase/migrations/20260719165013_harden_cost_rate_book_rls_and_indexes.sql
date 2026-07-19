-- Cache JWT claims once per statement inside the rate-book policies and add
-- covering indexes for the audit/user foreign keys reported by the database
-- advisor after the shared costing foundation migration.

DROP POLICY IF EXISTS "Owners manage cost rate book" ON public.cost_rate_book;
CREATE POLICY "Owners manage cost rate book" ON public.cost_rate_book
  FOR ALL TO authenticated
  USING (
    ((SELECT auth.jwt()) ->> 'user_role') = 'owner'
    AND org_id = (((SELECT auth.jwt()) ->> 'org_id')::uuid)
  )
  WITH CHECK (
    ((SELECT auth.jwt()) ->> 'user_role') = 'owner'
    AND org_id = (((SELECT auth.jwt()) ->> 'org_id')::uuid)
  );

DROP POLICY IF EXISTS "Owners read cost rate history" ON public.cost_rate_history;
CREATE POLICY "Owners read cost rate history" ON public.cost_rate_history
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.jwt()) ->> 'user_role') = 'owner'
    AND org_id = (((SELECT auth.jwt()) ->> 'org_id')::uuid)
  );

DROP POLICY IF EXISTS "Owners append cost rate history" ON public.cost_rate_history;
CREATE POLICY "Owners append cost rate history" ON public.cost_rate_history
  FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT auth.jwt()) ->> 'user_role') = 'owner'
    AND org_id = (((SELECT auth.jwt()) ->> 'org_id')::uuid)
  );

CREATE INDEX IF NOT EXISTS cost_rate_book_created_by_idx
  ON public.cost_rate_book(created_by);
CREATE INDEX IF NOT EXISTS cost_rate_book_updated_by_idx
  ON public.cost_rate_book(updated_by);
CREATE INDEX IF NOT EXISTS cost_rate_history_org_idx
  ON public.cost_rate_history(org_id);
CREATE INDEX IF NOT EXISTS cost_rate_history_changed_by_idx
  ON public.cost_rate_history(changed_by);
