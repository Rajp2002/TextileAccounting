-- ============================================================
-- MIGRATION: Set actor_id in all SECURITY DEFINER supervisor actions
-- and ensure all service-role client writes are captured
-- ============================================================
-- The savePastAttendance, deleteMachineWithCode, deleteWorkerWithCode,
-- startBeam, linkOrderToMachine, shiftHandover, and unconsumeBatchWithCode
-- actions all use the service-role client, causing auth.uid() = NULL
-- inside the audit trigger.
--
-- Fix: Create a set_actor_for_audit(p_actor_id UUID) helper RPC that
-- server actions can call before performing DML, setting app.actor_id
-- in the current session so the trigger picks it up as the fallback.
-- ============================================================

-- ─── 1. Create helper RPC called by server actions before DML ─────
CREATE OR REPLACE FUNCTION set_actor_for_audit(p_actor_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM set_config('app.actor_id', p_actor_id::TEXT, true);
END;
$$;

-- Allow authenticated and service role to call this
GRANT EXECUTE ON FUNCTION set_actor_for_audit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_actor_for_audit(UUID) TO service_role;
