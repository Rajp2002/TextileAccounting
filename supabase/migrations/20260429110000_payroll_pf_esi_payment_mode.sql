-- ============================================================
-- MIGRATION: Payroll PF/ESI Opt-In + Payment Mode
-- 1. Add explicit PF/ESI enrollment flags
-- 2. Add payment_mode to payroll settlements
-- 3. Audit payroll adjustments
-- 4. Upgrade settle_worker_payroll RPC
-- ============================================================

ALTER TABLE workers
    ADD COLUMN IF NOT EXISTS pf_esi_enrolled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN workers.pf_esi_enrolled IS
    'If true, PF and ESI are calculated and deducted during payroll settlement. Must be explicitly enabled by the owner.';

UPDATE workers
SET pf_esi_enrolled = true
WHERE COALESCE(pf_esi_eligible, false) = true;

ALTER TABLE fixed_workers
    ADD COLUMN IF NOT EXISTS pf_esi_enrolled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN fixed_workers.pf_esi_enrolled IS
    'If true, PF and ESI are calculated and deducted during payroll settlement. Must be explicitly enabled by the owner.';

UPDATE fixed_workers
SET pf_esi_enrolled = true
WHERE COALESCE(pf_esi_eligible, false) = true;

ALTER TABLE payroll_settlements
    ADD COLUMN IF NOT EXISTS payment_mode TEXT
    CHECK (payment_mode IN ('cash', 'bank_transfer', 'upi', 'cheque'));

COMMENT ON COLUMN payroll_settlements.payment_mode IS
    'How the worker was paid. Required for all new settlements created after this migration.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'audit_payroll_adjustments'
    ) THEN
        CREATE TRIGGER audit_payroll_adjustments
        AFTER INSERT OR UPDATE OR DELETE ON payroll_adjustments
        FOR EACH ROW EXECUTE FUNCTION log_audit_event();
    END IF;
END $$;

CREATE OR REPLACE FUNCTION settle_worker_payroll(
    p_org_id UUID,
    p_worker_type TEXT,
    p_worker_id BIGINT,
    p_cycle_start DATE,
    p_gross_amount NUMERIC,
    p_is_final_settlement BOOLEAN DEFAULT false,
    p_manual_deduction_override NUMERIC DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL,
    p_payment_mode TEXT DEFAULT NULL
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

    v_pf_basis NUMERIC := 0;
    v_employee_pf NUMERIC := 0;
    v_employer_pf NUMERIC := 0;
    v_employee_esic NUMERIC := 0;
    v_employer_esic NUMERIC := 0;
    v_pf_esi_enrolled BOOLEAN := false;

    v_total_pending_advances NUMERIC := 0;
    v_max_deduction_cap NUMERIC;
    v_actual_deduction NUMERIC := 0;
    v_remaining_debt NUMERIC := 0;
    v_advance RECORD;
    v_deduct_now NUMERIC;
    v_budget NUMERIC;

    v_itemization_payload JSONB;
    v_bonuses_list JSONB := '[]'::jsonb;
    v_fines_list JSONB := '[]'::jsonb;
    v_advances_list JSONB := '[]'::jsonb;

    v_adjustment RECORD;
BEGIN
    IF p_payment_mode IS NULL OR p_payment_mode NOT IN ('cash', 'bank_transfer', 'upi', 'cheque') THEN
        RAISE EXCEPTION 'payment_mode is required for payroll settlement';
    END IF;

    PERFORM id
    FROM payroll_settlements
    WHERE org_id = p_org_id
      AND (
        (worker_type = 'meter' AND meter_worker_id = p_worker_id) OR
        (worker_type = 'fixed' AND fixed_worker_id = p_worker_id)
      )
      AND cycle_start_date = p_cycle_start
    FOR UPDATE;

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

    IF p_worker_type = 'meter' THEN
        SELECT COALESCE(pf_esi_enrolled, pf_esi_eligible, false)
        INTO v_pf_esi_enrolled
        FROM workers
        WHERE id = p_worker_id;
    ELSE
        SELECT COALESCE(pf_esi_enrolled, pf_esi_eligible, false)
        INTO v_pf_esi_enrolled
        FROM fixed_workers
        WHERE id = p_worker_id;
    END IF;

    IF v_pf_esi_enrolled THEN
        v_pf_basis := LEAST(v_true_adjusted_gross, 15000);
        v_employee_pf := v_pf_basis * 0.12;
        v_employer_pf := v_pf_basis * 0.12;

        IF v_true_adjusted_gross <= 21000 THEN
            v_employee_esic := v_true_adjusted_gross * 0.0075;
            v_employer_esic := v_true_adjusted_gross * 0.0325;
        END IF;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_pending_advances
    FROM worker_advances
    WHERE org_id = p_org_id
      AND status = 'pending'
      AND (
        (p_worker_type = 'meter' AND meter_worker_id = p_worker_id) OR
        (p_worker_type = 'fixed' AND fixed_worker_id = p_worker_id)
      );

    IF p_is_final_settlement THEN
        v_max_deduction_cap := v_true_adjusted_gross;
    ELSE
        v_max_deduction_cap := v_true_adjusted_gross * 0.5;
    END IF;

    IF p_manual_deduction_override IS NOT NULL THEN
        v_actual_deduction := LEAST(v_total_pending_advances, p_manual_deduction_override);
        IF NOT p_is_final_settlement THEN
            v_actual_deduction := LEAST(v_actual_deduction, v_max_deduction_cap);
        END IF;
    ELSE
        v_actual_deduction := LEAST(v_total_pending_advances, v_max_deduction_cap);
    END IF;

    v_budget := v_actual_deduction;

    IF p_worker_type = 'meter' THEN
        INSERT INTO payroll_settlements (
            org_id, worker_type, meter_worker_id, fixed_worker_id,
            cycle_start_date, month,
            gross_pay, advance_deducted, net_payout,
            employer_pf, employer_esic,
            is_final_settlement, compliance_flag, payment_mode
        )
        VALUES (
            p_org_id, p_worker_type, p_worker_id, NULL,
            p_cycle_start, TO_CHAR(p_cycle_start, 'YYYY-MM'),
            p_gross_amount, v_actual_deduction,
            v_true_adjusted_gross - v_actual_deduction - v_employee_pf - v_employee_esic,
            v_employer_pf, v_employer_esic,
            p_is_final_settlement, (v_total_pending_advances > v_max_deduction_cap AND NOT p_is_final_settlement), p_payment_mode
        )
        ON CONFLICT (org_id, meter_worker_id, month) WHERE meter_worker_id IS NOT NULL DO UPDATE SET
            gross_pay = EXCLUDED.gross_pay,
            advance_deducted = EXCLUDED.advance_deducted,
            net_payout = EXCLUDED.net_payout,
            employer_pf = EXCLUDED.employer_pf,
            employer_esic = EXCLUDED.employer_esic,
            is_final_settlement = EXCLUDED.is_final_settlement,
            compliance_flag = EXCLUDED.compliance_flag,
            payment_mode = EXCLUDED.payment_mode,
            settled_at = now()
        RETURNING id INTO v_settlement_id;
    ELSE
        INSERT INTO payroll_settlements (
            org_id, worker_type, meter_worker_id, fixed_worker_id,
            cycle_start_date, month,
            gross_pay, advance_deducted, net_payout,
            employer_pf, employer_esic,
            is_final_settlement, compliance_flag, payment_mode
        )
        VALUES (
            p_org_id, p_worker_type, NULL, p_worker_id,
            p_cycle_start, TO_CHAR(p_cycle_start, 'YYYY-MM'),
            p_gross_amount, v_actual_deduction,
            v_true_adjusted_gross - v_actual_deduction - v_employee_pf - v_employee_esic,
            v_employer_pf, v_employer_esic,
            p_is_final_settlement, (v_total_pending_advances > v_max_deduction_cap AND NOT p_is_final_settlement), p_payment_mode
        )
        ON CONFLICT (org_id, fixed_worker_id, month) WHERE fixed_worker_id IS NOT NULL DO UPDATE SET
            gross_pay = EXCLUDED.gross_pay,
            advance_deducted = EXCLUDED.advance_deducted,
            net_payout = EXCLUDED.net_payout,
            employer_pf = EXCLUDED.employer_pf,
            employer_esic = EXCLUDED.employer_esic,
            is_final_settlement = EXCLUDED.is_final_settlement,
            compliance_flag = EXCLUDED.compliance_flag,
            payment_mode = EXCLUDED.payment_mode,
            settled_at = now()
        RETURNING id INTO v_settlement_id;
    END IF;

    FOR v_advance IN
        SELECT id, amount, type, created_at, description, interest_rate
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
                type, interest_rate, cycle_start_date, origin_settlement_id
            )
            VALUES (
                p_org_id,
                CASE WHEN p_worker_type = 'meter' THEN p_worker_id ELSE NULL END,
                CASE WHEN p_worker_type = 'fixed' THEN p_worker_id ELSE NULL END,
                v_advance.amount - v_deduct_now,
                'Partial recovery carry-forward for #' || v_advance.id,
                'pending',
                v_settlement_id,
                v_advance.type,
                v_advance.interest_rate,
                p_cycle_start,
                v_settlement_id
            );

            v_advances_list := v_advances_list || jsonb_build_object(
                'id', v_advance.id, 'type', v_advance.type, 'date', v_advance.created_at,
                'label', v_advance.description, 'recovered', v_deduct_now, 'carried_forward', v_advance.amount - v_deduct_now
            );
        END IF;

        v_budget := v_budget - v_deduct_now;
    END LOOP;

    UPDATE payroll_adjustments
    SET settlement_id = v_settlement_id
    WHERE org_id = p_org_id
      AND (
        (p_worker_type = 'meter' AND meter_worker_id = p_worker_id) OR
        (p_worker_type = 'fixed' AND fixed_worker_id = p_worker_id)
      )
      AND cycle_start_date = p_cycle_start
      AND settlement_id IS NULL;

    v_itemization_payload := jsonb_build_object(
        'gross_basis', p_gross_amount,
        'gross_after_adjustments', v_true_adjusted_gross,
        'bonuses', v_bonuses_list,
        'fines', v_fines_list,
        'advances_recovered', v_advances_list,
        'pf', CASE
            WHEN v_pf_esi_enrolled THEN jsonb_build_object('basis', v_pf_basis, 'employee', v_employee_pf, 'employer', v_employer_pf)
            ELSE NULL
        END,
        'esic', CASE
            WHEN v_pf_esi_enrolled THEN jsonb_build_object('employee', v_employee_esic, 'employer', v_employer_esic)
            ELSE NULL
        END,
        'payment_mode', p_payment_mode,
        'net_payout', v_true_adjusted_gross - v_actual_deduction - v_employee_pf - v_employee_esic
    );

    UPDATE payroll_settlements
    SET carried_forward_debt = (
            SELECT COALESCE(SUM(amount), 0)
            FROM worker_advances
            WHERE org_id = p_org_id
              AND status = 'pending'
              AND (
                (p_worker_type = 'meter' AND meter_worker_id = p_worker_id) OR
                (p_worker_type = 'fixed' AND fixed_worker_id = p_worker_id)
              )
        ),
        itemization_payload = v_itemization_payload
    WHERE id = v_settlement_id
    RETURNING carried_forward_debt INTO v_remaining_debt;

    IF p_actor_id IS NOT NULL THEN
        PERFORM log_audit_event(
            p_org_id,
            p_actor_id,
            'payroll.settle',
            'payroll_settlements',
            v_settlement_id,
            v_itemization_payload
        );
    END IF;

    RETURN v_itemization_payload || jsonb_build_object(
        'settlement_id', v_settlement_id,
        'payment_mode', p_payment_mode,
        'carried_forward_debt', v_remaining_debt
    );
END;
$$;
