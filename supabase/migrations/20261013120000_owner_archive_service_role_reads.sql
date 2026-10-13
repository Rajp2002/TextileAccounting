-- The owner's organization archive (app/(dashboard)/owner/settings/data-export.ts)
-- reads every organization-scoped table with the service-role client and an
-- explicit org_id filter, as it does for the rest of its catalog. These five
-- tables revoked every service_role privilege when they were created, so the
-- archive could not read them and failed closed.
--
-- Read access only. Writes stay with their SECURITY DEFINER functions, and
-- signed-in users keep exactly the access they had.

GRANT SELECT ON TABLE
  public.base_production_batch_revisions,
  public.base_payroll_reversals,
  public.base_payroll_advance_recoveries,
  public.base_worker_incentives,
  public.factory_supervisors
TO service_role;
