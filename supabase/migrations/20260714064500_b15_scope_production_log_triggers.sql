-- B15: privacy-only changes to retained production history must not rerun
-- order-boundary or auto-completion business rules. Those rules are relevant
-- only when a row is inserted or its production attribution/quantity changes.

DROP TRIGGER IF EXISTS trg_production_log_order_boundary ON public.production_logs;
CREATE TRIGGER trg_production_log_order_boundary
  BEFORE INSERT OR UPDATE OF meters, order_id, machine_id, org_id
  ON public.production_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_production_log_order_boundary();

DROP TRIGGER IF EXISTS trg_auto_complete_order_on_log ON public.production_logs;
CREATE TRIGGER trg_auto_complete_order_on_log
  AFTER INSERT OR UPDATE OF meters, order_id
  ON public.production_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_complete_order_on_log();

COMMENT ON TRIGGER trg_production_log_order_boundary ON public.production_logs IS
  'Validates inserts and production-attribution or meter changes; privacy metadata updates do not rerun order boundary checks.';

COMMENT ON TRIGGER trg_auto_complete_order_on_log ON public.production_logs IS
  'Recomputes order completion only when production attribution or meter quantity changes.';
