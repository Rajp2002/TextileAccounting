-- Migration: Fix RPCs to work with Service Role (Explicit Org ID)
-- These RPCs were failing because auth.jwt() is null when called via service_role from a server action.

-- 1. Update link_batch_to_machine
DROP FUNCTION IF EXISTS link_batch_to_machine(UUID, UUID);
CREATE OR REPLACE FUNCTION link_batch_to_machine(
    p_batch_id UUID,
    p_machine_id UUID,
    p_org_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_caller_role TEXT;
    v_default_rate DECIMAL;
BEGIN
    -- Determine org_id: either passed explicitly (service role) or from JWT (client)
    IF p_org_id IS NOT NULL THEN
        v_org_id := p_org_id;
        v_caller_role := 'supervisor'; -- Assume trusted if org_id is provided via service role
    ELSE
        v_org_id   := (auth.jwt() ->> 'org_id')::uuid;
        v_caller_role := auth.jwt() ->> 'user_role';
    END IF;

    -- Only owner or supervisor can link
    IF v_caller_role NOT IN ('owner', 'supervisor') AND p_org_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    -- Fetch the default worker rate from the batch's quality
    SELECT q.default_worker_rate_per_m INTO v_default_rate
    FROM yarn_batches yb
    JOIN qualities q ON q.id = yb.quality_id
    WHERE yb.id = p_batch_id AND yb.org_id = v_org_id;

    -- Clear any other batch currently on that machine (one beam per machine)
    UPDATE yarn_batches
    SET current_machine_id = NULL
    WHERE current_machine_id = p_machine_id
      AND org_id = v_org_id
      AND status = 'active';

    -- Assign the batch to the machine
    UPDATE yarn_batches
    SET current_machine_id = p_machine_id
    WHERE id = p_batch_id
      AND org_id = v_org_id
      AND status = 'active';

    -- UPDATE MACHINE RATE (Rate Automation Gap)
    IF v_default_rate > 0 THEN
        UPDATE machines
        SET rate_per_meter = v_default_rate
        WHERE id = p_machine_id AND org_id = v_org_id;
    END IF;
END;
$$;

-- 2. Update link_order_to_machine
DROP FUNCTION IF EXISTS link_order_to_machine(UUID, UUID);
CREATE OR REPLACE FUNCTION link_order_to_machine(
    p_order_id UUID,
    p_machine_id UUID,
    p_org_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_caller_role TEXT;
BEGIN
    -- Determine org_id
    IF p_org_id IS NOT NULL THEN
        v_org_id := p_org_id;
        v_caller_role := 'supervisor';
    ELSE
        v_org_id   := (auth.jwt() ->> 'org_id')::uuid;
        v_caller_role := auth.jwt() ->> 'user_role';
    END IF;

    -- Only owner or supervisor can link
    IF v_caller_role NOT IN ('owner', 'supervisor') AND p_org_id IS NULL THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    -- Assign the order to the machine
    UPDATE machines
    SET current_order_id = p_order_id
    WHERE id = p_machine_id
      AND org_id = v_org_id;
END;
$$;
