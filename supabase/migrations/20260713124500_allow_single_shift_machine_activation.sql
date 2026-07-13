-- PROD-002: a factory may operate only a day shift or only a night shift.
-- Activation therefore requires one valid active-shift assignment, not both.
-- The selected-shift production boundary still rejects logging a shift whose
-- own worker is missing.

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
        AND EXISTS (
            SELECT 1
            FROM public.machine_assignments ma
            JOIN public.workers w
              ON w.id = ma.worker_id
             AND w.org_id = p_org_id
             AND w.is_active = true
            WHERE ma.org_id = p_org_id
              AND ma.machine_id = p_machine_id
              AND ma.shift IN ('day', 'night')
        );
$$;

REVOKE ALL ON FUNCTION public.machine_meets_activation_requirements(uuid, uuid, uuid) FROM PUBLIC;

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
                'Machine can only be activated with at least one active shift worker assigned and an active order'
                USING ERRCODE = '23514';
        END IF;

        IF OLD.status IS DISTINCT FROM 'active' THEN
            RAISE EXCEPTION
                'Machine can only be activated with at least one active shift worker assigned and an active order'
                USING ERRCODE = '23514';
        END IF;

        NEW.status := 'inactive';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_machine_activation_requirements() FROM PUBLIC;

COMMENT ON FUNCTION public.machine_meets_activation_requirements(uuid, uuid, uuid) IS
    'True when a loom has an active order and at least one active day/night meter-worker assignment.';
