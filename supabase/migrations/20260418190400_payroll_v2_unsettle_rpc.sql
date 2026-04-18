-- ============================================================
-- MIGRATION: Payroll V2 Core Engine (Part 3 - Unsettle RPC)
-- ============================================================

CREATE OR REPLACE FUNCTION unsettle_worker_payroll(
    p_org_id UUID,
    p_worker_type TEXT,
    p_worker_id BIGINT,
    p_month TEXT,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settlement_id BIGINT;
    v_reverted_advances_count INT := 0;
    v_advance RECORD;
    v_split_record RECORD;
BEGIN
    -- 1. Find the settlement
    IF p_worker_type = 'meter' THEN
        SELECT id INTO v_settlement_id
        FROM payroll_settlements
        WHERE org_id = p_org_id
          AND meter_worker_id = p_worker_id
          AND month = p_month;
    ELSE
        SELECT id INTO v_settlement_id
        FROM payroll_settlements
        WHERE org_id = p_org_id
          AND fixed_worker_id = p_worker_id
          AND month = p_month;
    END IF;

    IF v_settlement_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Settlement not found');
    END IF;

    -- 2. DOWNSTREAM GUARD
    -- Verify if any carry-forward debt from THIS settlement has been 
    -- recovered in a SUBSEQUENT settlement.
    IF EXISTS (
        SELECT 1 FROM worker_advances 
        WHERE settlement_id = v_settlement_id 
          AND status = 'deducted' 
          AND deducted_at > (SELECT settled_at FROM payroll_settlements WHERE id = v_settlement_id)
    ) THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Cannot unsettle: Debt from this period has already been recovered in a later cycle.'
        );
    END IF;

    -- 3. REVERSE-LOOP RE-MERGE
    -- We must process these newest-to-oldest to handle recursive splits if they exist
    FOR v_advance IN 
        SELECT id, amount, settlement_id, status 
        FROM worker_advances 
        WHERE settlement_id = v_settlement_id 
          AND status = 'deducted'
        ORDER BY id DESC -- Newest first
    LOOP
        -- Check if this was a split that produced a child "pending" row in the same settlement
        -- (The carry-forward split logic in settle_worker_payroll tags the child with the same settlement_id)
        SELECT id, amount INTO v_split_record 
        FROM worker_advances 
        WHERE status = 'pending' 
          AND settlement_id = v_settlement_id
          AND description LIKE 'Partial recovery carry-forward for #' || v_advance.id
        LIMIT 1;

        IF FOUND THEN
            -- Re-merge: Add the pending remainder back to the deducted amount
            UPDATE worker_advances 
            SET amount = amount + v_split_record.amount,
                status = 'pending',
                deducted_at = NULL,
                deducted_in_month = NULL,
                settlement_id = NULL
            WHERE id = v_advance.id;

            -- Delete the orphan fragment
            DELETE FROM worker_advances WHERE id = v_split_record.id;
        ELSE
            -- Normal full deduction reversal
            UPDATE worker_advances 
            SET status = 'pending',
                deducted_at = NULL,
                deducted_in_month = NULL,
                settlement_id = NULL
            WHERE id = v_advance.id;
        END IF;

        v_reverted_advances_count := v_reverted_advances_count + 1;
    END LOOP;

    -- 4. UNLINK ADJUSTMENTS
    UPDATE payroll_adjustments
    SET settlement_id = NULL
    WHERE settlement_id = v_settlement_id;

    -- 5. AUDIT & DELETE
    IF p_actor_id IS NOT NULL THEN
        PERFORM log_audit_event(
            p_org_id, p_actor_id, 'payroll.unsettle', 
            'payroll_settlements', v_settlement_id, 
            jsonb_build_object('month', p_month, 'reverted_advances', v_reverted_advances_count)
        );
    END IF;

    DELETE FROM payroll_settlements WHERE id = v_settlement_id;

    RETURN jsonb_build_object(
        'success', true,
        'reverted_advances', v_reverted_advances_count
    );
END;
$$;
