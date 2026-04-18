-- ============================================================
-- MIGRATION: Payroll V2 Core Engine (Part 2 - Settle RPC)
-- ============================================================

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
    v_total_bonuses NUMERIC := 0;
    v_total_fines NUMERIC := 0;
    v_adjusted_gross NUMERIC;
    v_true_adjusted_gross NUMERIC;
    
    -- Statutory
    v_pf_basis NUMERIC;
    v_employee_pf NUMERIC := 0;
    v_employer_pf NUMERIC := 0;
    v_employee_esic NUMERIC := 0;
    v_employer_esic NUMERIC := 0;
    
    -- Advances
    v_total_pending_advances NUMERIC := 0;
    v_max_deduction_cap NUMERIC;
    v_actual_deduction NUMERIC := 0;
    v_remaining_debt NUMERIC := 0;
    v_advance RECORD;
    v_deduct_now NUMERIC;
    v_budget NUMERIC;
    
    -- Itemization
    v_itemization_payload JSONB;
    v_bonuses_list JSONB := '[]'::jsonb;
    v_fines_list JSONB := '[]'::jsonb;
    v_advances_list JSONB := '[]'::jsonb;
    
    v_adjustment RECORD;
BEGIN
    -- ─── STEP 0: CONCURRENCY LOCK ───
    -- Lock wait if another session is settling the same worker/cycle
    PERFORM id 
    FROM payroll_settlements 
    WHERE org_id = p_org_id 
      AND (
        (worker_type = 'meter' AND meter_worker_id = p_worker_id) OR
        (worker_type = 'fixed' AND fixed_worker_id = p_worker_id)
      )
      AND cycle_start_date = p_cycle_start 
    FOR UPDATE;

    -- ─── STEP 1: AGGREGATE ADJUSTMENTS ───
    
    -- Sum Bonuses & Build Item List
    FOR v_adjustment IN 
        SELECT a.amount, c.label 
        FROM payroll_adjustments a
        JOIN payroll_adjustment_categories c ON a.category_id = c.id
        WHERE a.org_id = p_org_id
          AND a.cycle_start_date = p_cycle_start
          AND a.worker_type = p_worker_type
          AND (
            (p_worker_type = 'meter' AND a.meter_worker_id = p_worker_id) OR
            (p_worker_type = 'fixed' AND a.fixed_worker_id = p_worker_id)
          )
          AND c.type = 'bonus'
    LOOP
        v_total_bonuses := v_total_bonuses + v_adjustment.amount;
        v_bonuses_list := v_bonuses_list || jsonb_build_object('category', v_adjustment.label, 'amount', v_adjustment.amount);
    END LOOP;

    v_adjusted_gross := p_gross_amount + v_total_bonuses;

    -- Sum Fines & Build Item List
    FOR v_adjustment IN 
        SELECT a.amount, c.label, a.description
        FROM payroll_adjustments a
        JOIN payroll_adjustment_categories c ON a.category_id = c.id
        WHERE a.org_id = p_org_id
          AND a.cycle_start_date = p_cycle_start
          AND a.worker_type = p_worker_type
          AND (
            (p_worker_type = 'meter' AND a.meter_worker_id = p_worker_id) OR
            (p_worker_type = 'fixed' AND a.fixed_worker_id = p_worker_id)
          )
          AND c.type = 'fine'
    LOOP
        v_total_fines := v_total_fines + v_adjustment.amount;
        v_fines_list := v_fines_list || jsonb_build_object('category', v_adjustment.label, 'amount', v_adjustment.amount, 'description', v_adjustment.description);
    END LOOP;

    v_true_adjusted_gross := v_adjusted_gross - v_total_fines;

    -- ─── STEP 2: STATUTORY DEDUCTIONS ───
    
    -- Check if worker is pf_esi_eligible
    IF EXISTS (
        SELECT 1 FROM (
            SELECT pf_esi_eligible FROM workers WHERE id = p_worker_id AND p_worker_type = 'meter'
            UNION ALL
            SELECT pf_esi_eligible FROM fixed_workers WHERE id = p_worker_id AND p_worker_type = 'fixed'
        ) w WHERE pf_esi_eligible = true
    ) THEN
        -- PF: 12% on MIN(True Adjusted Gross, 15000)
        v_pf_basis := LEAST(v_true_adjusted_gross, 15000);
        v_employee_pf := v_pf_basis * 0.12;
        v_employer_pf := v_pf_basis * 0.12;

        -- ESIC: 0.75% / 3.25% if <= 21000
        -- Note: Contribution Half-Year rule simplification (V1 checks per cycle)
        IF v_true_adjusted_gross <= 21000 THEN
            v_employee_esic := v_true_adjusted_gross * 0.0075;
            v_employer_esic := v_true_adjusted_gross * 0.0325;
        END IF;
    END IF;

    -- ─── STEP 3: ADVANCE RECOVERY BRAIN ───
    
    -- Total Pending Debt
    SELECT COALESCE(SUM(amount), 0) INTO v_total_pending_advances
    FROM worker_advances
    WHERE org_id = p_org_id
      AND status = 'pending'
      AND (
        (p_worker_type = 'meter' AND meter_worker_id = p_worker_id) OR
        (p_worker_type = 'fixed' AND fixed_worker_id = p_worker_id)
      );

    -- Cap: 50% of True Adjusted Gross (Owner favorable)
    IF p_is_final_settlement THEN
        v_max_deduction_cap := v_true_adjusted_gross;
    ELSE
        v_max_deduction_cap := v_true_adjusted_gross * 0.5;
    END IF;

    -- Apply Override or Standard Cap
    IF p_manual_deduction_override IS NOT NULL THEN
        v_actual_deduction := LEAST(v_total_pending_advances, p_manual_deduction_override);
    ELSE
        v_actual_deduction := LEAST(v_total_pending_advances, v_max_deduction_cap);
    END IF;
    
    v_budget := v_actual_deduction;

    -- ─── STEP 4: PERSIST SETTLEMENT RECORD ───
    INSERT INTO payroll_settlements (
        org_id, worker_type, meter_worker_id, fixed_worker_id, 
        cycle_start_date, month,
        gross_pay, advance_deducted, net_payout, 
        employer_pf, employer_esic,
        is_final_settlement, compliance_flag
    )
    VALUES (
        p_org_id, p_worker_type, 
        CASE WHEN p_worker_type = 'meter' THEN p_worker_id ELSE NULL END,
        CASE WHEN p_worker_type = 'fixed' THEN p_worker_id ELSE NULL END,
        p_cycle_start, TO_CHAR(p_cycle_start, 'YYYY-MM'),
        p_gross_amount, v_actual_deduction, 
        v_true_adjusted_gross - v_actual_deduction - v_employee_pf - v_employee_esic,
        v_employer_pf, v_employer_esic,
        p_is_final_settlement, (v_actual_deduction > v_max_deduction_cap AND NOT p_is_final_settlement)
    )
    ON CONFLICT (org_id, meter_worker_id, month) WHERE meter_worker_id IS NOT NULL DO UPDATE SET
        gross_pay = EXCLUDED.gross_pay,
        advance_deducted = EXCLUDED.advance_deducted,
        net_payout = EXCLUDED.net_payout,
        employer_pf = EXCLUDED.employer_pf,
        employer_esic = EXCLUDED.employer_esic,
        settled_at = now()
    ON CONFLICT (org_id, fixed_worker_id, month) WHERE fixed_worker_id IS NOT NULL DO UPDATE SET
        gross_pay = EXCLUDED.gross_pay,
        advance_deducted = EXCLUDED.advance_deducted,
        net_payout = EXCLUDED.net_payout,
        employer_pf = EXCLUDED.employer_pf,
        employer_esic = EXCLUDED.employer_esic,
        settled_at = now()
    RETURNING id INTO v_settlement_id;

    -- ─── STEP 5: DEDUCT ADVANCES & BUILD LIST ───
    FOR v_advance IN
        SELECT id, amount, type, created_at, description
        FROM worker_advances
        WHERE org_id = p_org_id
          AND status = 'pending'
          AND (
            (p_worker_type = 'meter' AND meter_worker_id = p_worker_id) OR
            (p_worker_type = 'fixed' AND fixed_worker_id = p_worker_id)
          )
        ORDER BY created_at ASC
        FOR UPDATE
    LOOP
        EXIT WHEN v_budget <= 0;

        IF v_advance.amount <= v_budget THEN
            v_deduct_now := v_advance.amount;
            UPDATE worker_advances
            SET status = 'deducted',
                deducted_at = now(),
                deducted_in_month = TO_CHAR(p_cycle_start, 'YYYY-MM'),
                settlement_id = v_settlement_id
            WHERE id = v_advance.id;
            
            v_advances_list := v_advances_list || jsonb_build_object(
                'id', v_advance.id, 'type', v_advance.type, 'date', v_advance.created_at, 
                'label', v_advance.description, 'recovered', v_deduct_now, 'carried_forward', 0
            );
        ELSE
            -- SPLITTING Case
            v_deduct_now := v_budget;
            
            UPDATE worker_advances
            SET amount = v_deduct_now,
                status = 'deducted',
                deducted_at = now(),
                deducted_in_month = TO_CHAR(p_cycle_start, 'YYYY-MM'),
                settlement_id = v_settlement_id
            WHERE id = v_advance.id;

            INSERT INTO worker_advances (
                org_id, meter_worker_id, fixed_worker_id, 
                amount, description, status, settlement_id, 
                type, interest_rate, cycle_start_date
            )
            VALUES (
                p_org_id, 
                CASE WHEN p_worker_type = 'meter' THEN p_worker_id ELSE NULL END,
                CASE WHEN p_worker_type = 'fixed' THEN p_worker_id ELSE NULL END,
                v_advance.amount - v_deduct_now,
                'Partial recovery carry-forward for #' || v_advance.id,
                'pending',
                v_settlement_id, -- Keep linked for unsettling re-merge logic
                v_advance.type, 
                v_advance.interest_rate,
                p_cycle_start
            );
            
            v_advances_list := v_advances_list || jsonb_build_object(
                'id', v_advance.id, 'type', v_advance.type, 'date', v_advance.created_at, 
                'label', v_advance.description, 'recovered', v_deduct_now, 'carried_forward', v_advance.amount - v_deduct_now
            );
        END IF;

        v_budget := v_budget - v_deduct_now;
    END LOOP;

    -- ─── STEP 6: FINALIZE SNAPSHOT & AUDIT ───
    
    -- Stamp settlement_id on adjustments
    UPDATE payroll_adjustments
    SET settlement_id = v_settlement_id
    WHERE org_id = p_org_id
      AND cycle_start_date = p_cycle_start
      AND worker_type = p_worker_type
      AND (
        (p_worker_type = 'meter' AND meter_worker_id = p_worker_id) OR
        (p_worker_type = 'fixed' AND fixed_worker_id = p_worker_id)
      );

    -- Calculate Carry-Forward for Payload
    SELECT COALESCE(SUM(amount), 0) INTO v_remaining_debt
    FROM worker_advances
    WHERE org_id = p_org_id
      AND status = 'pending'
      AND (
        (p_worker_type = 'meter' AND meter_worker_id = p_worker_id) OR
        (p_worker_type = 'fixed' AND fixed_worker_id = p_worker_id)
      );

    v_itemization_payload := jsonb_build_object(
        'gross_basis', p_gross_amount,
        'bonuses', v_bonuses_list,
        'fines', v_fines_list,
        'true_adjusted_gross', v_true_adjusted_gross,
        'advances_recovered', v_advances_list,
        'pf', jsonb_build_object('basis', v_pf_basis, 'employee', v_employee_pf, 'employer', v_employer_pf),
        'esic', jsonb_build_object('employee', v_employee_esic, 'employer', v_employer_esic),
        'net_payout', v_true_adjusted_gross - v_actual_deduction - v_employee_pf - v_employee_esic
    );

    UPDATE payroll_settlements
    SET carried_forward_debt = v_remaining_debt,
        itemization_payload = v_itemization_payload
    WHERE id = v_settlement_id;

    -- Audit Log Entry (Global Audit System)
    IF p_actor_id IS NOT NULL THEN
        PERFORM log_audit_event(
            p_org_id, p_actor_id, 'payroll.settle', 
            'payroll_settlements', v_settlement_id, 
            v_itemization_payload
        );
    END IF;

    RETURN v_itemization_payload || jsonb_build_object('settlement_id', v_settlement_id);
END;
$$;
