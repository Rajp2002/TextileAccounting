-- Machines may only remain active when they have an active order and
-- standing workers assigned for both day and night shifts.

ALTER TABLE public.machines
    ALTER COLUMN status SET DEFAULT 'inactive';

CREATE OR REPLACE FUNCTION public.machine_meets_activation_requirements(
    p_org_id uuid,
    p_machine_id uuid,
    p_order_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        p_order_id IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.orders o
            WHERE o.id = p_order_id
              AND o.org_id = p_org_id
              AND o.status = 'active'
        )
        AND (
            SELECT COUNT(DISTINCT ma.shift)
            FROM public.machine_assignments ma
            JOIN public.workers w
              ON w.id = ma.worker_id
             AND w.org_id = p_org_id
             AND w.is_active = true
            WHERE ma.org_id = p_org_id
              AND ma.machine_id = p_machine_id
              AND ma.shift IN ('day', 'night')
        ) = 2;
$$;

CREATE OR REPLACE FUNCTION public.enforce_machine_activation_requirements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'active'
       AND NOT public.machine_meets_activation_requirements(NEW.org_id, NEW.id, NEW.current_order_id)
    THEN
        IF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION
                'Machine can only be activated with day and night workers assigned and an active order'
                USING ERRCODE = '23514';
        END IF;

        IF OLD.status IS DISTINCT FROM 'active' THEN
            RAISE EXCEPTION
                'Machine can only be activated with day and night workers assigned and an active order'
                USING ERRCODE = '23514';
        END IF;

        NEW.status := 'inactive';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_machine_activation_requirements ON public.machines;
CREATE TRIGGER enforce_machine_activation_requirements
    BEFORE INSERT OR UPDATE ON public.machines
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_machine_activation_requirements();

CREATE OR REPLACE FUNCTION public.inactivate_machines_missing_activation_requirements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        UPDATE public.machines m
        SET status = 'inactive'
        WHERE m.status = 'active'
          AND m.id = OLD.machine_id
          AND NOT public.machine_meets_activation_requirements(m.org_id, m.id, m.current_order_id);
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        UPDATE public.machines m
        SET status = 'inactive'
        WHERE m.status = 'active'
          AND m.id = NEW.machine_id
          AND NOT public.machine_meets_activation_requirements(m.org_id, m.id, m.current_order_id);
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS inactivate_machines_after_assignment_change ON public.machine_assignments;
CREATE TRIGGER inactivate_machines_after_assignment_change
    AFTER INSERT OR UPDATE OR DELETE ON public.machine_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.inactivate_machines_missing_activation_requirements();

CREATE OR REPLACE FUNCTION public.inactivate_machines_after_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        UPDATE public.machines m
        SET status = 'inactive'
        WHERE m.status = 'active'
          AND m.current_order_id = NEW.id
          AND NOT public.machine_meets_activation_requirements(m.org_id, m.id, m.current_order_id);
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS inactivate_machines_after_order_status_change ON public.orders;
CREATE TRIGGER inactivate_machines_after_order_status_change
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.inactivate_machines_after_order_status_change();

UPDATE public.machines m
SET status = 'inactive'
WHERE m.status = 'active'
  AND NOT public.machine_meets_activation_requirements(m.org_id, m.id, m.current_order_id);
