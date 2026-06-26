-- Batch 1B-B / AUTH-016: locked-tenant write enforcement.
--
-- Intent:
-- - Locked organizations can still be read for investigation and unlock workflow.
-- - Tenant users cannot mutate protected pilot business data while locked.
-- - Enforcement is layered through RLS, central server-action guards, and explicit
--   SECURITY DEFINER RPC guards. No trigger is used as the primary control.
--
-- Safety:
-- - No production data is deleted, truncated, backfilled, or mass-updated.
-- - Existing rows are not modified.
-- - This migration only changes functions, policies, and function privileges.

-- ---------------------------------------------------------------------------
-- Lockdown helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_org_lockdown(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT o.is_locked_down
    FROM public.organizations o
    WHERE o.id = p_org_id
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.assert_org_not_locked(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'organization context is required'
      USING ERRCODE = '42501';
  END IF;

  IF public.check_org_lockdown(p_org_id) THEN
    RAISE EXCEPTION 'organization is locked; business writes are disabled'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_org_lockdown(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_org_not_locked(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_org_lockdown(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assert_org_not_locked(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS policy hardening for protected pilot write tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_stock_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_stock_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_package_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_dispatch_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_float_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- production_logs: org members can insert/update production; only owners delete.
DROP POLICY IF EXISTS "Supervisor/Owner Insert" ON public.production_logs;
DROP POLICY IF EXISTS "Supervisor/Owner Insert (Lockdown Aware)" ON public.production_logs;
DROP POLICY IF EXISTS "Owner Update" ON public.production_logs;
DROP POLICY IF EXISTS "Owner Update (Lockdown Aware)" ON public.production_logs;
DROP POLICY IF EXISTS "Supervisor/Owner Update" ON public.production_logs;
DROP POLICY IF EXISTS "Owner Delete" ON public.production_logs;

CREATE POLICY "production_logs_insert_when_unlocked"
  ON public.production_logs FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

CREATE POLICY "production_logs_update_when_unlocked"
  ON public.production_logs FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

CREATE POLICY "production_logs_delete_when_unlocked"
  ON public.production_logs FOR DELETE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

-- worker/master rows used by production and payroll.
DROP POLICY IF EXISTS "Owners Manage Workers" ON public.workers;
DROP POLICY IF EXISTS "Owners Manage Workers (Lockdown Aware)" ON public.workers;
DROP POLICY IF EXISTS "Supervisors and Owners Manage Workers" ON public.workers;
DROP POLICY IF EXISTS "Supervisors and Owners Insert Workers" ON public.workers;
DROP POLICY IF EXISTS "Supervisors and Owners Update Workers" ON public.workers;
DROP POLICY IF EXISTS "Owner Delete Workers" ON public.workers;

CREATE POLICY "workers_insert_when_unlocked"
  ON public.workers FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

CREATE POLICY "workers_update_when_unlocked"
  ON public.workers FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

CREATE POLICY "workers_delete_when_unlocked"
  ON public.workers FOR DELETE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

DROP POLICY IF EXISTS "Owners Manage Fixed Workers" ON public.fixed_workers;
DROP POLICY IF EXISTS "Supervisors and Owners Insert Fixed Workers" ON public.fixed_workers;
DROP POLICY IF EXISTS "Supervisors and Owners Update Fixed Workers" ON public.fixed_workers;
DROP POLICY IF EXISTS "Owner Delete Fixed Workers" ON public.fixed_workers;

CREATE POLICY "fixed_workers_insert_when_unlocked"
  ON public.fixed_workers FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

CREATE POLICY "fixed_workers_update_when_unlocked"
  ON public.fixed_workers FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

CREATE POLICY "fixed_workers_delete_when_unlocked"
  ON public.fixed_workers FOR DELETE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

-- attendance.
DROP POLICY IF EXISTS "Supervisor/Owner Insert Attendance" ON public.attendance;
DROP POLICY IF EXISTS "Supervisor/Owner Insert Attendance Today" ON public.attendance;
DROP POLICY IF EXISTS "Anyone in org can log attendance (Lockdown Aware)" ON public.attendance;
DROP POLICY IF EXISTS "Owner Insert Attendance Any Date" ON public.attendance;
DROP POLICY IF EXISTS "Owner Update Attendance" ON public.attendance;
DROP POLICY IF EXISTS "Supervisor/Owner Update Attendance" ON public.attendance;
DROP POLICY IF EXISTS "Owner Delete Attendance" ON public.attendance;

CREATE POLICY "attendance_insert_when_unlocked"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

CREATE POLICY "attendance_update_when_unlocked"
  ON public.attendance FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

CREATE POLICY "attendance_delete_when_unlocked"
  ON public.attendance FOR DELETE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'owner'
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

-- machine and assignment setup affects production routing.
DROP POLICY IF EXISTS "Owners Manage Machines" ON public.machines;
DROP POLICY IF EXISTS "Supervisors and Owners Manage Machines" ON public.machines;
DROP POLICY IF EXISTS "Supervisors and Owners Insert Machines" ON public.machines;
DROP POLICY IF EXISTS "Supervisors and Owners Update Machines" ON public.machines;
DROP POLICY IF EXISTS "Owner Delete Machines" ON public.machines;

CREATE POLICY "machines_write_when_unlocked"
  ON public.machines FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

DROP POLICY IF EXISTS "Owners Manage Assignments" ON public.machine_assignments;
DROP POLICY IF EXISTS "Owners and Supervisors Manage Assignments" ON public.machine_assignments;

CREATE POLICY "machine_assignments_write_when_unlocked"
  ON public.machine_assignments FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

DROP POLICY IF EXISTS "Org Members Insert Shift Assignments" ON public.shift_assignments;
DROP POLICY IF EXISTS "Org Members Update Shift Assignments" ON public.shift_assignments;
DROP POLICY IF EXISTS "Owners Delete Shift Assignments" ON public.shift_assignments;

CREATE POLICY "shift_assignments_write_when_unlocked"
  ON public.shift_assignments FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor')
    AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid
    AND NOT public.check_org_lockdown(org_id)
  );

-- Owner-only business write tables. Existing SELECT policies remain unchanged.
DROP POLICY IF EXISTS "Owners Manage Orders" ON public.orders;
CREATE POLICY "orders_owner_writes_when_unlocked"
  ON public.orders FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "dispatches_org_insert" ON public.dispatches;
DROP POLICY IF EXISTS "dispatches_org_update" ON public.dispatches;
CREATE POLICY "dispatches_write_when_unlocked"
  ON public.dispatches FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "fabric_stock_lots_owner_insert" ON public.fabric_stock_lots;
DROP POLICY IF EXISTS "fabric_stock_lots_owner_update" ON public.fabric_stock_lots;
CREATE POLICY "fabric_stock_lots_owner_writes_when_unlocked"
  ON public.fabric_stock_lots FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "fabric_stock_sales_owner_insert" ON public.fabric_stock_sales;
CREATE POLICY "fabric_stock_sales_owner_writes_when_unlocked"
  ON public.fabric_stock_sales FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "fabric_stock_movements_owner_insert" ON public.fabric_stock_movements;
CREATE POLICY "fabric_stock_movements_owner_writes_when_unlocked"
  ON public.fabric_stock_movements FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "fabric_packages_org_insert" ON public.fabric_packages;
DROP POLICY IF EXISTS "fabric_packages_org_update" ON public.fabric_packages;
CREATE POLICY "fabric_packages_write_when_unlocked"
  ON public.fabric_packages FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "dispatch_package_lines_org_insert" ON public.dispatch_package_lines;
DROP POLICY IF EXISTS "dispatch_package_lines_org_update" ON public.dispatch_package_lines;
CREATE POLICY "dispatch_package_lines_write_when_unlocked"
  ON public.dispatch_package_lines FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "party_dispatch_claims_org_insert" ON public.party_dispatch_claims;
DROP POLICY IF EXISTS "party_dispatch_claims_owner_update" ON public.party_dispatch_claims;
CREATE POLICY "party_dispatch_claims_owner_writes_when_unlocked"
  ON public.party_dispatch_claims FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "stock_discrepancies_owner_insert" ON public.stock_discrepancies;
DROP POLICY IF EXISTS "stock_discrepancies_owner_update" ON public.stock_discrepancies;
CREATE POLICY "stock_discrepancies_owner_writes_when_unlocked"
  ON public.stock_discrepancies FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "Owners Manage Settlements" ON public.payroll_settlements;
CREATE POLICY "payroll_settlements_owner_writes_when_unlocked"
  ON public.payroll_settlements FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "Owners Create Advances" ON public.worker_advances;
DROP POLICY IF EXISTS "Owners Update Advances" ON public.worker_advances;
DROP POLICY IF EXISTS "Owners Delete Advances" ON public.worker_advances;
CREATE POLICY "worker_advances_owner_writes_when_unlocked"
  ON public.worker_advances FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "Owners Manage Adjustments" ON public.payroll_adjustments;
CREATE POLICY "payroll_adjustments_owner_writes_when_unlocked"
  ON public.payroll_adjustments FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "Owners Manage All Floats" ON public.supervisor_float_transactions;
CREATE POLICY "supervisor_float_owner_writes_when_unlocked"
  ON public.supervisor_float_transactions FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "commercial_receivables_owner_insert" ON public.commercial_receivables;
DROP POLICY IF EXISTS "commercial_receivables_owner_update" ON public.commercial_receivables;
CREATE POLICY "commercial_receivables_owner_writes_when_unlocked"
  ON public.commercial_receivables FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "commercial_payment_receipts_owner_insert" ON public.commercial_payment_receipts;
CREATE POLICY "commercial_payment_receipts_owner_writes_when_unlocked"
  ON public.commercial_payment_receipts FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "parties_owner_insert" ON public.parties;
DROP POLICY IF EXISTS "parties_owner_update" ON public.parties;
DROP POLICY IF EXISTS "parties_owner_delete" ON public.parties;
CREATE POLICY "parties_owner_writes_when_unlocked"
  ON public.parties FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "party_invoices_owner_insert" ON public.party_invoices;
DROP POLICY IF EXISTS "party_invoices_owner_update" ON public.party_invoices;
CREATE POLICY "party_invoices_owner_writes_when_unlocked"
  ON public.party_invoices FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "party_receipts_owner_insert" ON public.party_receipts;
CREATE POLICY "party_receipts_owner_writes_when_unlocked"
  ON public.party_receipts FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "party_adjustments_owner_insert" ON public.party_adjustments;
CREATE POLICY "party_adjustments_owner_writes_when_unlocked"
  ON public.party_adjustments FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

DROP POLICY IF EXISTS "payment_allocations_owner_insert" ON public.payment_allocations;
CREATE POLICY "payment_allocations_owner_writes_when_unlocked"
  ON public.payment_allocations FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id))
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'owner' AND org_id = NULLIF(auth.jwt() ->> 'org_id', '')::uuid AND NOT public.check_org_lockdown(org_id));

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER RPC guards
-- ---------------------------------------------------------------------------
--
-- These RPCs bypass RLS, so the locked-tenant invariant must be checked inside
-- each function. To avoid re-copying large business functions and drifting their
-- existing logic, this migration rewrites the currently installed function
-- definitions and injects a single explicit public.assert_org_not_locked(...)
-- call at the top of each mutating RPC.

CREATE OR REPLACE FUNCTION pg_temp.weavly_inject_lockdown_guard(
  p_function_identity TEXT,
  p_pattern TEXT,
  p_replacement TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_oid OID;
  v_definition TEXT;
  v_hardened TEXT;
BEGIN
  v_oid := to_regprocedure(p_function_identity);

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'expected RPC % was not found', p_function_identity;
  END IF;

  v_definition := pg_get_functiondef(v_oid);

  IF v_definition ILIKE '%assert_org_not_locked%' THEN
    RETURN;
  END IF;

  v_hardened := regexp_replace(v_definition, p_pattern, p_replacement, 'i');

  IF v_hardened = v_definition OR v_hardened NOT ILIKE '%assert_org_not_locked%' THEN
    RAISE EXCEPTION 'could not inject lockdown guard into %', p_function_identity;
  END IF;

  EXECUTE v_hardened;
END;
$$;

-- RPCs with v_org_id derived from the authenticated JWT.
SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.replace_shift_production_logs(jsonb,boolean,boolean)',
  '(v_org_id[[:space:]]*:=[[:space:]]*[^;]+;[[:space:]]*)',
  E'\\1  PERFORM public.assert_org_not_locked(v_org_id);\n\n  '
);

SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.record_fabric_stock_sale(uuid,numeric,numeric,date,text)',
  '(v_org_id[[:space:]]*:=[[:space:]]*[^;]+;[[:space:]]*)',
  E'\\1  PERFORM public.assert_org_not_locked(v_org_id);\n\n  '
);

SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.adjust_fabric_stock_lot(uuid,text,numeric,text)',
  '(v_org_id[[:space:]]*:=[[:space:]]*[^;]+;[[:space:]]*)',
  E'\\1  PERFORM public.assert_org_not_locked(v_org_id);\n\n  '
);

SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.create_market_run_sale(uuid,uuid,numeric,numeric,date,text,text,date)',
  '(v_org_id[[:space:]]*:=[[:space:]]*[^;]+;[[:space:]]*)',
  E'\\1    PERFORM public.assert_org_not_locked(v_org_id);\n\n    '
);

SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.create_party_stock_sale_dispatch_v1(text,uuid,text,text,text,text,numeric,numeric,numeric,integer,date,boolean,numeric,date,text,text,text,text,uuid)',
  '(v_org_id[[:space:]]*:=[[:space:]]*[^;]+;[[:space:]]*)',
  E'\\1  PERFORM public.assert_org_not_locked(v_org_id);\n\n  '
);

SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.confirm_party_stock_sale_dispatch_v1(uuid,date,text,text,text,numeric,numeric,text)',
  '(v_org_id[[:space:]]*:=[[:space:]]*[^;]+;[[:space:]]*)',
  E'\\1  PERFORM public.assert_org_not_locked(v_org_id);\n\n  '
);

SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.confirm_party_stock_sale_received_v1(uuid,date,text,text,text,numeric,text)',
  '(v_org_id[[:space:]]*:=[[:space:]]*[^;]+;[[:space:]]*)',
  E'\\1  PERFORM public.assert_org_not_locked(v_org_id);\n\n  '
);

SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.confirm_stock_sale_dispatch_receipt_v1(uuid,numeric)',
  '(v_org_id[[:space:]]*:=[[:space:]]*[^;]+;[[:space:]]*)',
  E'\\1  PERFORM public.assert_org_not_locked(v_org_id);\n\n  '
);

SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.record_commercial_payment_v1(uuid,numeric,date,text,text,text,date,text,text)',
  '(v_org_id[[:space:]]*:=[[:space:]]*[^;]+;[[:space:]]*)',
  E'\\1  PERFORM public.assert_org_not_locked(v_org_id);\n\n  '
);

SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.convert_accepted_quote_to_order(uuid,numeric,date,text,text)',
  '(v_org_id[[:space:]]*:=[[:space:]]*[^;]+;[[:space:]]*)',
  E'\\1  PERFORM public.assert_org_not_locked(v_org_id);\n\n  '
);

-- RPCs whose organization is passed directly.
SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.create_stock_sale_dispatch(uuid,uuid,uuid[],numeric[],numeric[],date,text,text,text,text,text,numeric,timestamp with time zone,uuid)',
  '(\nBEGIN[[:space:]]*)',
  E'\\1  PERFORM public.assert_org_not_locked(p_org_id);\n\n  '
);

SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.settle_worker_payroll(uuid,text,bigint,date,numeric,boolean,numeric,uuid,text)',
  '(\nBEGIN[[:space:]]*)',
  E'\\1    PERFORM public.assert_org_not_locked(p_org_id);\n\n    '
);

SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.unsettle_worker_payroll(uuid,text,bigint,text,uuid)',
  '(\nBEGIN[[:space:]]*)',
  E'\\1    PERFORM public.assert_org_not_locked(p_org_id);\n\n    '
);

-- RPCs that derive org from an input record.
SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.create_or_refresh_stock_inward_draft(uuid,date,text)',
  '(\nBEGIN[[:space:]]*)',
  E'\\1  PERFORM public.assert_org_not_locked((SELECT o.org_id FROM public.orders o WHERE o.id = p_order_id));\n\n  '
);

SELECT pg_temp.weavly_inject_lockdown_guard(
  'public.confirm_fabric_dispatch_receipt_by_number(integer,text,numeric)',
  '(IF v_dispatch_id IS NULL THEN[[:space:]]*RAISE EXCEPTION ''Invalid tracking link'';[[:space:]]*END IF;[[:space:]]*)',
  E'\\1  PERFORM public.assert_org_not_locked((SELECT d.org_id FROM public.dispatches d WHERE d.id = v_dispatch_id));\n\n  '
);
