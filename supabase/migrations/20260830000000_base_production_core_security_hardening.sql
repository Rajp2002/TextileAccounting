-- Keep the Base RLS predicate out of the exposed public schema. The settlement
-- RPC remains public because the owner UI calls it through PostgREST, but the
-- shared policy helper is an internal database implementation detail.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.base_production_core_access(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    p_org_id IS NOT NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS membership
      WHERE membership.id = (SELECT auth.uid())
        AND membership.org_id = p_org_id
        AND membership.role::text = 'owner'
    )
    AND public.org_has_subscription_tier(p_org_id, 'base');
$function$;

REVOKE ALL ON FUNCTION private.base_production_core_access(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.base_production_core_access(uuid)
  TO authenticated;

DROP POLICY IF EXISTS base_production_workers_owner_access
  ON public.base_production_workers;
DROP POLICY IF EXISTS base_production_jobs_owner_access
  ON public.base_production_jobs;
DROP POLICY IF EXISTS base_production_entries_owner_read
  ON public.base_production_entries;
DROP POLICY IF EXISTS base_production_entries_owner_insert
  ON public.base_production_entries;
DROP POLICY IF EXISTS base_worker_advances_owner_read
  ON public.base_worker_advances;
DROP POLICY IF EXISTS base_worker_advances_owner_insert
  ON public.base_worker_advances;
DROP POLICY IF EXISTS base_payroll_settlements_owner_read
  ON public.base_payroll_settlements;

CREATE POLICY base_production_workers_owner_access
  ON public.base_production_workers
  FOR ALL TO authenticated
  USING (private.base_production_core_access(org_id))
  WITH CHECK (private.base_production_core_access(org_id));

CREATE POLICY base_production_jobs_owner_access
  ON public.base_production_jobs
  FOR ALL TO authenticated
  USING (private.base_production_core_access(org_id))
  WITH CHECK (private.base_production_core_access(org_id));

CREATE POLICY base_production_entries_owner_read
  ON public.base_production_entries
  FOR SELECT TO authenticated
  USING (private.base_production_core_access(org_id));

CREATE POLICY base_production_entries_owner_insert
  ON public.base_production_entries
  FOR INSERT TO authenticated
  WITH CHECK (private.base_production_core_access(org_id));

CREATE POLICY base_worker_advances_owner_read
  ON public.base_worker_advances
  FOR SELECT TO authenticated
  USING (private.base_production_core_access(org_id));

CREATE POLICY base_worker_advances_owner_insert
  ON public.base_worker_advances
  FOR INSERT TO authenticated
  WITH CHECK (private.base_production_core_access(org_id));

CREATE POLICY base_payroll_settlements_owner_read
  ON public.base_payroll_settlements
  FOR SELECT TO authenticated
  USING (private.base_production_core_access(org_id));

-- Keep the original public symbol as a non-definer compatibility wrapper for
-- the already-deployed settlement function. It is not executable by API roles;
-- the security-definer settlement function can still call it as its owner.
CREATE OR REPLACE FUNCTION public.base_production_core_access(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT private.base_production_core_access(p_org_id);
$function$;

REVOKE ALL ON FUNCTION public.base_production_core_access(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION private.base_production_core_access(uuid) IS
  'Internal owner-and-Base-entitlement predicate for Base Production Core RLS policies.';
