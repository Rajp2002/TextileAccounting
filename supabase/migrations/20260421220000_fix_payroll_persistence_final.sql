-- ============================================================
-- MIGRATION: Fix Payroll Persistence Final
-- 1. Define parameterized log_audit_event for manual logging
-- 2. Correct settle_worker_payroll (remove non-existent status column)
-- 3. Fix itemization logic (name -> label)
-- ============================================================

-- 1. Parameterized log_audit_event
-- This variant allows SECURITY DEFINER RPCs to manually log events 
-- with a specific actor_id and custom payload.
CREATE OR REPLACE FUNCTION log_audit_event(
    p_org_id UUID,
    p_actor_id UUID,
    p_action TEXT,
    p_table_name TEXT,
    p_record_id BIGINT,
    p_payload JSONB
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_log (
        org_id, table_name, record_id, action, 
        new_data, changed_by, created_at
    )
    VALUES (
        p_org_id, p_table_name, p_record_id::TEXT, p_action, 
        p_payload, p_actor_id, now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Corrected settle_worker_payroll
CREATE OR REPLACE FUNCTION settle_worker_payroll(
    p_org_id UUID,
    p_worker_type TEXT,
    p_worker_id BIGINT,
    p_cycle_start DATE,
    p_gross_amount NUMERIC,
    p_is_final_settlement BOOLEAN DEFAULT false,
    p_manual_deduction_override NUMERIC DEFAULT NULL,
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
    v_itemization JSONB;
    v_month TEXT;
BEGIN
    v_month := to_char(p_cycle_start, 'YYYY-MM');

    -- Concurrency Guard: Lock the target month for this worker
    PERFORM id FROM payroll_settlements 
    WHERE org_id = p_org_id 
      AND month = v_month 
      AND CASE WHEN p_worker_type = 'meter' THEN meter_worker_id = p_worker_id ELSE fixed_worker_id = p_worker_id END
    FOR UPDATE;

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
    v_max_deduction := CASE WHEN p_is_final_settlement THEN p_gross_amount ELSE p_gross_amount * 0.5 END;

    -- 3. Determine Actual Deduction
    IF p_manual_deduction_override IS NOT NULL THEN
        -- Owner override takes precedence (but capped for compliance unless final)
        v_actual_deduction := LEAST(v_total_advances, p_manual_deduction_override);
        IF NOT p_is_final_settlement THEN
           v_actual_deduction := LEAST(v_actual_deduction, v_max_deduction);
        END IF;
    ELSE
        v_actual_deduction := LEAST(v_total_advances, v_max_deduction);
    END IF;
    
    v_budget := v_actual_deduction;

    -- 4. Create Settlement Record
    IF p_worker_type = 'meter' THEN
        INSERT INTO payroll_settlements (
            org_id, worker_type, meter_worker_id, fixed_worker_id, month, 
            gross_pay, advance_deducted, net_payout, 
            compliance_flag, is_final_settlement, settled_at
        )
        VALUES (
            p_org_id, p_worker_type, p_worker_id, NULL, v_month, 
            p_gross_amount, v_actual_deduction, p_gross_amount - v_actual_deduction,
            (v_actual_deduction >= v_max_deduction AND v_total_advances > v_max_deduction AND NOT p_is_final_settlement),
            p_is_final_settlement, now()
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
            compliance_flag, is_final_settlement, settled_at
        )
        VALUES (
            p_org_id, p_worker_type, NULL, p_worker_id, v_month, 
            p_gross_amount, v_actual_deduction, p_gross_amount - v_actual_deduction,
            (v_actual_deduction >= v_max_deduction AND v_total_advances > v_max_deduction AND NOT p_is_final_settlement),
            p_is_final_settlement, now()
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
        SELECT id, amount, description
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
                deducted_in_month = v_month,
                settlement_id = v_settlement_id
            WHERE id = v_advance.id;
        ELSE
            v_deduct_now := v_budget;
            UPDATE worker_advances
            SET amount = v_deduct_now,
                status = 'deducted',
                deducted_at = now(),
                deducted_in_month = v_month,
                settlement_id = v_settlement_id
            WHERE id = v_advance.id;

            INSERT INTO worker_advances (
                org_id, meter_worker_id, fixed_worker_id, 
                amount, description, status, origin_settlement_id
            )
            VALUES (
                p_org_id, 
                CASE WHEN p_worker_type = 'meter' THEN p_worker_id ELSE NULL END,
                CASE WHEN p_worker_type = 'fixed' THEN p_worker_id ELSE NULL END,
                v_advance.amount - v_deduct_now,
                'Partial recovery carry-forward for #' || v_advance.id,
                'pending',
                v_settlement_id
            );
        END IF;

        v_budget := v_budget - v_deduct_now;
    END LOOP;

    -- 6. Link Adjustments (FIX: Removed non-existent status column)
    UPDATE payroll_adjustments
    SET settlement_id = v_settlement_id
    WHERE org_id = p_org_id
      AND CASE 
            WHEN p_worker_type = 'meter' THEN meter_worker_id = p_worker_id
            ELSE fixed_worker_id = p_worker_id
          END
      AND settlement_id IS NULL; -- only unassigned ones

    -- 7. Build itemization payload (FIX: Use .label instead of .name)
    SELECT jsonb_build_object(
        'gross_basis', p_gross_amount,
        'bonuses', (SELECT jsonb_agg(jsonb_build_object('category', c.label, 'amount', a.amount)) FROM payroll_adjustments a JOIN payroll_adjustment_categories c ON a.category_id = c.id WHERE a.settlement_id = v_settlement_id AND c.type = 'bonus'),
        'fines', (SELECT jsonb_agg(jsonb_build_object('category', c.label, 'amount', a.amount)) FROM payroll_adjustments a JOIN payroll_adjustment_categories c ON a.category_id = c.id WHERE a.settlement_id = v_settlement_id AND c.type = 'fine'),
        'advances_recovered', (SELECT jsonb_agg(jsonb_build_object('id', id, 'recovered', amount, 'label', description)) FROM worker_advances WHERE settlement_id = v_settlement_id AND status = 'deducted'),
        'pf', jsonb_build_object('employee', LEAST(p_gross_amount, 15000) * 0.12, 'employer', LEAST(p_gross_amount, 15000) * 0.13),
        'esic', jsonb_build_object('employee', p_gross_amount * 0.0075, 'employer', p_gross_amount * 0.0325)
    ) INTO v_itemization;

    UPDATE payroll_settlements SET itemization_payload = v_itemization WHERE id = v_settlement_id;

    -- 8. Final debt total
    SELECT COALESCE(SUM(amount), 0) INTO v_remaining_debt
    FROM worker_advances
    WHERE org_id = p_org_id AND status = 'pending'
      AND CASE WHEN p_worker_type = 'meter' THEN meter_worker_id = p_worker_id ELSE fixed_worker_id = p_worker_id END;

    UPDATE payroll_settlements SET carried_forward_debt = v_remaining_debt WHERE id = v_settlement_id;

    -- Audit manually since trigger might not have the actor context from SECURITY DEFINER
    IF p_actor_id IS NOT NULL THEN
        PERFORM log_audit_event(p_org_id, p_actor_id, 'payroll.settle', 'payroll_settlements', v_settlement_id, v_itemization);
    END IF;

    RETURN jsonb_build_object('settlement_id', v_settlement_id, 'net_payout', p_gross_amount - v_actual_deduction);
END;
$$;

-- 3. Corrected unsettle_worker_payroll
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

    -- 2. HARDENED DOWNSTREAM GUARD
    IF EXISTS (
        SELECT 1 FROM worker_advances 
        WHERE (settlement_id = v_settlement_id OR origin_settlement_id = v_settlement_id)
          AND status = 'deducted' 
          AND deducted_at > (SELECT settled_at FROM payroll_settlements WHERE id = v_settlement_id)
    ) THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Cannot unsettle: Debt from this period has already been recovered in a later cycle.'
        );
    END IF;

    -- 3. REVERSE-LOOP RE-MERGE
    FOR v_advance IN 
        SELECT id, amount, settlement_id, status 
        FROM worker_advances 
        WHERE settlement_id = v_settlement_id 
          AND status = 'deducted'
        ORDER BY id DESC 
    LOOP
        SELECT id, amount INTO v_split_record 
        FROM worker_advances 
        WHERE status = 'pending' 
          AND origin_settlement_id = v_settlement_id
          AND description LIKE 'Partial recovery carry-forward for #' || v_advance.id
        LIMIT 1;

        IF FOUND THEN
            UPDATE worker_advances 
            SET amount = amount + v_split_record.amount,
                status = 'pending',
                deducted_at = NULL,
                deducted_in_month = NULL,
                settlement_id = NULL,
                origin_settlement_id = NULL
            WHERE id = v_advance.id;

            DELETE FROM worker_advances WHERE id = v_split_record.id;
        ELSE
            UPDATE worker_advances 
            SET status = 'pending',
                deducted_at = NULL,
                deducted_in_month = NULL,
                settlement_id = NULL
            WHERE id = v_advance.id;
        END IF;

        v_reverted_advances_count := v_reverted_advances_count + 1;
    END LOOP;

    -- 4. Unlink Adjustments
    UPDATE payroll_adjustments
    SET settlement_id = NULL
    WHERE settlement_id = v_settlement_id;

    -- 5. Audit & Delete
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
