-- Migration: Inventory Audit Updates
-- 1. Add audit_status and leakage_alert to yarn_batches
ALTER TABLE yarn_batches
    ADD COLUMN IF NOT EXISTS audit_status TEXT NOT NULL DEFAULT 'pending' CHECK (audit_status IN ('pending', 'settled', 'dismissed')),
    ADD COLUMN IF NOT EXISTS leakage_alert BOOLEAN NOT NULL DEFAULT false;

-- 2. Update RLS policies for yarn_batches to allow Supervisors to INSERT
DROP POLICY IF EXISTS "Owners Insert Yarn Batches" ON yarn_batches;
CREATE POLICY "Owners and Supervisors Insert Yarn Batches" ON yarn_batches
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- 3. Update RLS policies for yarn_batches to allow Supervisors to UPDATE (status, leftover)
DROP POLICY IF EXISTS "Owners Update Yarn Batches" ON yarn_batches;
CREATE POLICY "Owners and Supervisors Update Yarn Batches" ON yarn_batches
    FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- 4. RPC for owner to settle/dismiss audit
CREATE OR REPLACE FUNCTION settle_batch_audit(
    p_batch_id UUID,
    p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (auth.jwt() ->> 'user_role') <> 'owner' THEN
        RAISE EXCEPTION 'Permission denied: Owner only';
    END IF;

    UPDATE yarn_batches
    SET audit_status = p_status,
        leakage_alert = (CASE WHEN p_status = 'settled' THEN false ELSE leakage_alert END)
    WHERE id = p_batch_id
      AND org_id = (auth.jwt() ->> 'org_id')::uuid;
END;
$$;
