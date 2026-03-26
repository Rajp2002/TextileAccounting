-- ============================================================
-- MIGRATION: Rate tied to Quality, not Machine
-- 
-- The worker rate (₹/meter) is defined by the fabric quality,
-- not by individual machines. This migration:
--   1. Drops the machines.rate_per_meter column (now redundant)
--   2. Updates link_batch_to_machine to no longer write to that column
-- ============================================================

-- 1. Drop the machine-level rate column
ALTER TABLE machines DROP COLUMN IF EXISTS rate_per_meter;

-- 2. Update link_batch_to_machine: remove rate propagation to machines table
--    Rate is now read directly from qualities at payroll time.
CREATE OR REPLACE FUNCTION link_batch_to_machine(
    p_batch_id UUID,
    p_machine_id UUID
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
    -- Get caller's org_id and role from JWT
    v_org_id   := (auth.jwt() ->> 'org_id')::uuid;
    v_caller_role := auth.jwt() ->> 'user_role';

    -- Only owner or supervisor can link
    IF v_caller_role NOT IN ('owner', 'supervisor') THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

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
END;
$$;
