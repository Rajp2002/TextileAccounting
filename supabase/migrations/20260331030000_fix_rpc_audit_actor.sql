-- ============================================================
-- MIGRATION: Fix Audit Actor for SECURITY DEFINER RPCs
-- ============================================================
-- The settle_worker_payroll and unsettle_worker_payroll RPCs run
-- as SECURITY DEFINER (service-role), which means auth.uid() is
-- NULL inside them. This means payroll settlements are logged but
-- with no actor (changed_by = NULL).
--
-- Fix: Accept an optional p_actor_id parameter in both RPCs and
-- SET LOCAL app.actor_id before DML so log_audit_event() can read
-- it as a fallback when auth.uid() is NULL.
-- ============================================================

-- ─── 1. UPDATE log_audit_event() to read app.actor_id fallback ─
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_is_access_code_used BOOLEAN := false;
    v_actor_id UUID;
BEGIN
    -- Primary actor: the authenticated user
    v_actor_id := auth.uid();

    -- Fallback: read session variable set by SECURITY DEFINER RPCs
    IF v_actor_id IS NULL THEN
        BEGIN
            v_actor_id := current_setting('app.actor_id', true)::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_actor_id := NULL;
        END;
    END IF;

    -- Check if session variable is set (string 'true')
    BEGIN
        v_is_access_code_used := current_setting('app.access_code_used', true) = 'true';
    EXCEPTION WHEN OTHERS THEN
        v_is_access_code_used := false;
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (org_id, table_name, record_id, action, new_data, changed_by, is_access_code_used)
        VALUES (
            NEW.org_id,
            TG_TABLE_NAME,
            NEW.id::TEXT,
            'INSERT',
            to_jsonb(NEW),
            v_actor_id,
            v_is_access_code_used
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (org_id, table_name, record_id, action, old_data, new_data, changed_by, is_access_code_used)
        VALUES (
            NEW.org_id,
            TG_TABLE_NAME,
            NEW.id::TEXT,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            v_actor_id,
            v_is_access_code_used
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (org_id, table_name, record_id, action, old_data, changed_by, is_access_code_used)
        VALUES (
            OLD.org_id,
            TG_TABLE_NAME,
            OLD.id::TEXT,
            'DELETE',
            to_jsonb(OLD),
            v_actor_id,
            v_is_access_code_used
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 2. OVERHAUL RPC: SETTLE (add p_actor_id) ─────────────────

CREATE OR REPLACE FUNCTION settle_worker_payroll(
    p_org_id UUID,
    p_worker_type TEXT,
    p_worker_id BIGINT,
    p_month TEXT,
    p_gross_amount NUMERIC,
    p_is_final_settlement BOOLEAN DEFAULT false,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settlement_id BIGINT;
    v_total_advances NUMERIC := 0;
    v_max_deduction NUMERIC;
    v_actual_deduction NUMERIC := 0;
    v_remaining_debt NUMERIC := 0;
    v_advance RECORD;
    v_deduct_now NUMERIC;
    v_budget NUMERIC;
BEGIN
    -- Set actor so the audit trigger can capture who did this
    IF p_actor_id IS NOT NULL THEN
        PERFORM set_config('app.actor_id', p_actor_id::TEXT, true);
    END IF;

    -- 1. Calculate Total Pending Advances
    SELECT COALESCE(SUM(amount), 0) INTO v_total_advances
    FROM worker_advances
    WHERE org_id = p_org_id
      AND status = 'pending'
      AND CASE
            WHEN p_worker_type = 'meter' THEN meter_worker_id = p_worker_id
            ELSE fixed_worker_id = p_worker_id
          END;

    -- 2. Determine Deduction Cap
    IF p_is_final_settlement THEN
        v_max_deduction := p_gross_amount;
    ELSE
        v_max_deduction := p_gross_amount * 0.5;
    END IF;

    -- 3. Determine Actual Deduction
    v_actual_deduction := LEAST(v_total_advances, v_max_deduction);
    v_budget := v_actual_deduction;

    -- 4. Create Settlement Record
    IF p_worker_type = 'meter' THEN
        INSERT INTO payroll_settlements (
            org_id, worker_type, meter_worker_id, fixed_worker_id, month,
            gross_pay, advance_deducted, net_payout,
            compliance_flag, is_final_settlement
        )
        VALUES (
            p_org_id, p_worker_type, p_worker_id, NULL, p_month,
            p_gross_amount, v_actual_deduction, p_gross_amount - v_actual_deduction,
            (v_actual_deduction >= v_max_deduction AND v_total_advances > v_max_deduction AND NOT p_is_final_settlement),
            p_is_final_settlement
        )
        ON CONFLICT (org_id, meter_worker_id, month)
        DO UPDATE SET
            gross_pay = EXCLUDED.gross_pay,
            advance_deducted = EXCLUDED.advance_deducted,
            net_payout = EXCLUDED.net_payout,
            compliance_flag = EXCLUDED.compliance_flag,
            is_final_settlement = EXCLUDED.is_final_settlement,
            settled_at = now()
        RETURNING id INTO v_settlement_id;
    ELSE
        INSERT INTO payroll_settlements (
            org_id, worker_type, meter_worker_id, fixed_worker_id, month,
            gross_pay, advance_deducted, net_payout,
            compliance_flag, is_final_settlement
        )
        VALUES (
            p_org_id, p_worker_type, NULL, p_worker_id, p_month,
            p_gross_amount, v_actual_deduction, p_gross_amount - v_actual_deduction,
            (v_actual_deduction >= v_max_deduction AND v_total_advances > v_max_deduction AND NOT p_is_final_settlement),
            p_is_final_settlement
        )
        ON CONFLICT (org_id, fixed_worker_id, month)
        DO UPDATE SET
            gross_pay = EXCLUDED.gross_pay,
            advance_deducted = EXCLUDED.advance_deducted,
            net_payout = EXCLUDED.net_payout,
            compliance_flag = EXCLUDED.compliance_flag,
            is_final_settlement = EXCLUDED.is_final_settlement,
            settled_at = now()
        RETURNING id INTO v_settlement_id;
    END IF;

    -- 5. Deduct Advances (Oldest First)
    FOR v_advance IN
        SELECT id, amount
        FROM worker_advances
        WHERE org_id = p_org_id
          AND status = 'pending'
          AND CASE
                WHEN p_worker_type = 'meter' THEN meter_worker_id = p_worker_id
                ELSE fixed_worker_id = p_worker_id
              END
        ORDER BY created_at ASC
        FOR UPDATE
    LOOP
        EXIT WHEN v_budget <= 0;

        IF v_advance.amount <= v_budget THEN
            v_deduct_now := v_advance.amount;
            UPDATE worker_advances
            SET status = 'deducted',
                deducted_at = now(),
                deducted_in_month = p_month,
                settlement_id = v_settlement_id
            WHERE id = v_advance.id;
        ELSE
            v_deduct_now := v_budget;
            UPDATE worker_advances
            SET amount = v_deduct_now,
                status = 'deducted',
                deducted_at = now(),
                deducted_in_month = p_month,
                settlement_id = v_settlement_id
            WHERE id = v_advance.id;

            INSERT INTO worker_advances (org_id, meter_worker_id, fixed_worker_id, amount, description, status, settlement_id)
            VALUES (
                p_org_id,
                CASE WHEN p_worker_type = 'meter' THEN p_worker_id ELSE NULL END,
                CASE WHEN p_worker_type = 'fixed' THEN p_worker_id ELSE NULL END,
                v_advance.amount - v_deduct_now,
                'Partial recovery carry-forward',
                'pending',
                v_settlement_id
            );
        END IF;

        v_budget := v_budget - v_deduct_now;
    END LOOP;

    -- 6. Calculate Carry-Forward Debt
    SELECT COALESCE(SUM(amount), 0) INTO v_remaining_debt
    FROM worker_advances
    WHERE org_id = p_org_id
      AND status = 'pending'
      AND CASE
            WHEN p_worker_type = 'meter' THEN meter_worker_id = p_worker_id
            ELSE fixed_worker_id = p_worker_id
          END;

    UPDATE payroll_settlements
    SET carried_forward_debt = v_remaining_debt
    WHERE id = v_settlement_id;

    RETURN jsonb_build_object(
        'settlement_id', v_settlement_id,
        'gross_pay', p_gross_amount,
        'advance_deducted', v_actual_deduction,
        'net_payout', p_gross_amount - v_actual_deduction,
        'carried_forward_debt', v_remaining_debt,
        'compliance_flag', (v_actual_deduction >= v_max_deduction AND v_total_advances > v_max_deduction AND NOT p_is_final_settlement)
    );
END;
$$;

-- ─── 3. OVERHAUL RPC: UNSETTLE (add p_actor_id) ───────────────

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
    v_reverted_count INT := 0;
BEGIN
    -- Set actor so the audit trigger can capture who did this
    IF p_actor_id IS NOT NULL THEN
        PERFORM set_config('app.actor_id', p_actor_id::TEXT, true);
    END IF;

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

    -- 2. Restore advances
    UPDATE worker_advances
    SET status = 'pending',
        deducted_at = NULL,
        deducted_in_month = NULL,
        settlement_id = NULL
    WHERE settlement_id = v_settlement_id;

    GET DIAGNOSTICS v_reverted_count = ROW_COUNT;

    -- 3. Delete the settlement record
    DELETE FROM payroll_settlements WHERE id = v_settlement_id;

    RETURN jsonb_build_object(
        'success', true,
        'reverted_advances', v_reverted_count
    );
END;
$$;

-- ─── 4. GRANT execute permissions ────────────────────────────
GRANT EXECUTE ON FUNCTION settle_worker_payroll(UUID, TEXT, BIGINT, TEXT, NUMERIC, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unsettle_worker_payroll(UUID, TEXT, BIGINT, TEXT, UUID) TO authenticated;
