-- Re-evaluate loom readiness when a standing piece-rate worker becomes inactive.
-- Assignment rows and production logs are deliberately retained for history; only
-- the affected loom's operational status changes.

CREATE OR REPLACE FUNCTION public.inactivate_machines_after_worker_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.is_active IS FALSE
       AND OLD.is_active IS DISTINCT FROM NEW.is_active
    THEN
        UPDATE public.machines AS m
        SET status = 'inactive'
        WHERE m.status = 'active'
          AND m.org_id = NEW.org_id
          AND EXISTS (
              SELECT 1
              FROM public.machine_assignments AS ma
              WHERE ma.org_id = NEW.org_id
                AND ma.machine_id = m.id
                AND ma.worker_id = NEW.id
          )
          AND NOT public.machine_meets_activation_requirements(
              m.org_id,
              m.id,
              m.current_order_id
          );
    END IF;

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.inactivate_machines_after_worker_status_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS inactivate_machines_after_worker_status_change ON public.workers;
CREATE TRIGGER inactivate_machines_after_worker_status_change
    AFTER UPDATE OF is_active ON public.workers
    FOR EACH ROW
    EXECUTE FUNCTION public.inactivate_machines_after_worker_status_change();

-- Reconcile any already-stale active looms when this migration is deployed.
UPDATE public.machines AS m
SET status = 'inactive'
WHERE m.status = 'active'
  AND NOT public.machine_meets_activation_requirements(
      m.org_id,
      m.id,
      m.current_order_id
  );
