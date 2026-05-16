-- ============================================================
-- MIGRATION: Payroll manual adjustments at finalization
-- 1. Add lean manual-adjustment fields to payroll_adjustments
-- 2. Allow custom audit action for confirmed manual adjustments
-- 3. Persist pending inam/kapaat rows atomically inside settlement RPC
-- ============================================================

ALTER TABLE payroll_adjustments
    ADD COLUMN IF NOT EXISTS adjustment_type TEXT
        CHECK (adjustment_type IS NULL OR adjustment_type IN ('inam', 'kapaat')),
    ADD COLUMN IF NOT EXISTS reason TEXT
        CHECK (
            reason IS NULL OR reason IN (
                'Attendance correction',
                'Quality issue',
                'Damage',
                'Extra work',
                'Festival / goodwill',
                'Rounding correction',
                'Other'
            )
        ),
    ADD COLUMN IF NOT EXISTS note TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

ALTER TABLE payroll_adjustments
    DROP CONSTRAINT IF EXISTS payroll_manual_adjustment_required_fields;

ALTER TABLE payroll_adjustments
    ADD CONSTRAINT payroll_manual_adjustment_required_fields CHECK (
        adjustment_type IS NULL OR (
            reason IS NOT NULL
            AND length(trim(reason)) > 0
            AND note IS NOT NULL
            AND length(trim(note)) > 0
            AND created_by IS NOT NULL
        )
    );

CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_settlement
    ON payroll_adjustments (settlement_id);

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log
    ADD CONSTRAINT audit_log_action_check
    CHECK (
        action IN (
            'INSERT',
            'UPDATE',
            'DELETE',
            'EXPORT',
            'payroll.settle',
            'payroll.unsettle',
            'payroll.manual_adjustment',
            'shift_self_correction'
        )
    );

CREATE OR REPLACE FUNCTION settle_worker_payroll(
    p_org_id UUID,
    p_worker_type TEXT,
    p_worker_id BIGINT,
    p_cycle_start DATE,
    p_gross_amount NUMERIC,
    p_is_final_settlement BOOLEAN DEFAULT false,
    p_manual_deduction_override NUMERIC DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL,
    p_payment_mode TEXT DEFAULT NULL,
    p_manual_adjustments JSONB DEFAULT '[]'::jsonb,
    p_verified_by_owner BOOLEAN DEFAULT false
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
    v_final_payout NUMERIC;

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
    v_manual_adjustments_list JSONB := '[]'::jsonb;

    v_adjustment RECORD;
    v_adjustment_payload JSONB;
    v_adjustment_id UUID;
    v_adjustment_type TEXT;
    v_reason TEXT;
    v_note TEXT;
    v_amount NUMERIC;
    v_worker_name TEXT := '';
BEGIN
    IF p_payment_mode IS NULL OR p_payment_mode NOT IN ('cash', 'bank_transfer', 'upi', 'cheque') THEN
        RAISE EXCEPTION 'payment_mode is required for payroll settlement';
    END IF;

    IF p_verified_by_owner IS NOT TRUE THEN
        RAISE EXCEPTION 'owner verification is required for payroll settlement';
    END IF;

    IF p_worker_type NOT IN ('meter', 'fixed') THEN
        RAISE EXCEPTION 'invalid worker_type';
    END IF;

    IF jsonb_typeof(COALESCE(p_manual_adjustments, '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION 'manual_adjustments must be an array';
    END IF;

    IF p_actor_id IS NOT NULL THEN
        PERFORM set_config('app.actor_id', p_actor_id::TEXT, true);
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

    IF p_worker_type = 'meter' THEN
        SELECT name INTO v_worker_name
        FROM workers
        WHERE id = p_worker_id AND org_id = p_org_id;
    ELSE
        SELECT name INTO v_worker_name
        FROM fixed_workers
        WHERE id = p_worker_id AND org_id = p_org_id;
    END IF;

    FOR v_adjustment_payload IN
        SELECT value FROM jsonb_array_elements(COALESCE(p_manual_adjustments, '[]'::jsonb))
    LOOP
        v_adjustment_type := v_adjustment_payload->>'adjustment_type';
        v_reason := trim(COALESCE(v_adjustment_payload->>'reason', ''));
        v_note := trim(COALESCE(v_adjustment_payload->>'note', ''));

        IF v_adjustment_type NOT IN ('inam', 'kapaat') THEN
            RAISE EXCEPTION 'adjustment_type is required';
        END IF;

        IF v_reason NOT IN (
            'Attendance correction',
            'Quality issue',
            'Damage',
            'Extra work',
            'Festival / goodwill',
            'Rounding correction',
            'Other'
        ) THEN
            RAISE EXCEPTION 'reason is required';
        END IF;

        IF v_note = '' THEN
            RAISE EXCEPTION 'note is required';
        END IF;

        IF COALESCE(v_adjustment_payload->>'amount', '') !~ '^[0-9]+(\.[0-9]+)?$' THEN
            RAISE EXCEPTION 'amount must be greater than 0';
        END IF;

        v_amount := (v_adjustment_payload->>'amount')::NUMERIC;
        IF v_amount <= 0 THEN
            RAISE EXCEPTION 'amount must be greater than 0';
        END IF;

        INSERT INTO payroll_adjustments (
            org_id,
            worker_type,
            meter_worker_id,
            fixed_worker_id,
            cycle_start_date,
            amount,
            description,
            adjustment_type,
            reason,
            note,
            created_by
        )
        VALUES (
            p_org_id,
            p_worker_type,
            CASE WHEN p_worker_type = 'meter' THEN p_worker_id ELSE NULL END,
            CASE WHEN p_worker_type = 'fixed' THEN p_worker_id ELSE NULL END,
            p_cycle_start,
            v_amount,
            v_note,
            v_adjustment_type,
            v_reason,
            v_note,
            p_actor_id
        )
        RETURNING id INTO v_adjustment_id;

        IF p_actor_id IS NOT NULL THEN
            INSERT INTO audit_log (
                org_id,
                table_name,
                record_id,
                action,
                new_data,
                changed_by
            )
            VALUES (
                p_org_id,
                'payroll_adjustments',
                v_adjustment_id::TEXT,
                'payroll.manual_adjustment',
                jsonb_build_object(
                    'message',
                    format(
                        'Owner added %s%s %s to %s payroll for %s. Reason: %s. Note: %s',
                        CHR(8377),
                        v_amount,
                        CASE WHEN v_adjustment_type = 'inam' THEN 'Inam' ELSE 'Kapaat' END,
                        COALESCE(v_worker_name, 'worker'),
                        to_char(p_cycle_start, 'FMMonth YYYY'),
                        v_reason,
                        v_note
                    ),
                    'adjustment_id', v_adjustment_id,
                    'adjustment_type', v_adjustment_type,
                    'reason', v_reason,
                    'amount', v_amount,
                    'note', v_note,
                    'worker_type', p_worker_type,
                    'worker_id', p_worker_id,
                    'cycle_start_date', p_cycle_start
                ),
                p_actor_id
            );
        END IF;
    END LOOP;

    FOR v_adjustment IN
        SELECT
            a.id,
            a.amount,
            COALESCE(
                a.adjustment_type,
                CASE
                    WHEN c.type = 'bonus' THEN 'inam'
                    WHEN c.type = 'fine' THEN 'kapaat'
                    ELSE NULL
                END
            ) AS normalized_type,
            COALESCE(a.reason, c.label, 'Other') AS reason,
            COALESCE(NULLIF(a.note, ''), NULLIF(a.description, ''), '') AS note,
            COALESCE(c.label, a.reason, 'Manual adjustment') AS label
        FROM payroll_adjustments a
        LEFT JOIN payroll_adjustment_categories c ON a.category_id = c.id
        WHERE a.org_id = p_org_id
          AND a.cycle_start_date = p_cycle_start
          AND a.worker_type = p_worker_type
          AND a.settlement_id IS NULL
          AND (
            (p_worker_type = 'meter' AND a.meter_worker_id = p_worker_id) OR
            (p_worker_type = 'fixed' AND a.fixed_worker_id = p_worker_id)
          )
    LOOP
        IF v_adjustment.normalized_type = 'inam' THEN
            v_total_bonuses := v_total_bonuses + v_adjustment.amount;
            v_bonuses_list := v_bonuses_list || jsonb_build_array(
                jsonb_build_object(
                    'category', v_adjustment.label,
                    'reason', v_adjustment.reason,
                    'amount', v_adjustment.amount,
                    'note', v_adjustment.note
                )
            );
        ELSIF v_adjustment.normalized_type = 'kapaat' THEN
            v_total_fines := v_total_fines + v_adjustment.amount;
            v_fines_list := v_fines_list || jsonb_build_array(
                jsonb_build_object(
                    'category', v_adjustment.label,
                    'reason', v_adjustment.reason,
                    'amount', v_adjustment.amount,
                    'note', v_adjustment.note
                )
            );
        END IF;

        IF v_adjustment.normalized_type IN ('inam', 'kapaat') THEN
            v_manual_adjustments_list := v_manual_adjustments_list || jsonb_build_array(
                jsonb_build_object(
                    'id', v_adjustment.id,
                    'adjustment_type', v_adjustment.normalized_type,
                    'reason', v_adjustment.reason,
                    'amount', v_adjustment.amount,
                    'note', v_adjustment.note
                )
            );
        END IF;
    END LOOP;

    v_adjusted_gross := p_gross_amount + v_total_bonuses;
    v_true_adjusted_gross := v_adjusted_gross - v_total_fines;

    IF v_true_adjusted_gross < 0 THEN
        RAISE EXCEPTION 'Kapaat cannot make the final payout negative';
    END IF;

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
        v_actual_deduction := LEAST(v_total_pending_advances, GREATEST(p_manual_deduction_override, 0));
        IF NOT p_is_final_settlement THEN
            v_actual_deduction := LEAST(v_actual_deduction, v_max_deduction_cap);
        ELSE
            v_actual_deduction := LEAST(v_actual_deduction, v_max_deduction_cap);
        END IF;
    ELSE
        v_actual_deduction := LEAST(v_total_pending_advances, v_max_deduction_cap);
    END IF;

    v_final_payout := v_true_adjusted_gross - v_actual_deduction - v_employee_pf - v_employee_esic;
    IF v_final_payout < 0 THEN
        RAISE EXCEPTION 'Kapaat cannot make the final payout negative';
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
            p_gross_amount, v_actual_deduction, v_final_payout,
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
            p_gross_amount, v_actual_deduction, v_final_payout,
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

            v_advances_list := v_advances_list || jsonb_build_array(
                jsonb_build_object(
                    'id', v_advance.id, 'type', v_advance.type, 'date', v_advance.created_at,
                    'label', v_advance.description, 'recovered', v_deduct_now, 'carried_forward', 0
                )
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

            v_advances_list := v_advances_list || jsonb_build_array(
                jsonb_build_object(
                    'id', v_advance.id, 'type', v_advance.type, 'date', v_advance.created_at,
                    'label', v_advance.description, 'recovered', v_deduct_now, 'carried_forward', v_advance.amount - v_deduct_now
                )
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
        'gross_after_adjustments', v_true_adjusted_gross,
        'bonuses', v_bonuses_list,
        'fines', v_fines_list,
        'manual_adjustments', v_manual_adjustments_list,
        'baseEarnings', p_gross_amount,
        'inamTotal', v_total_bonuses,
        'kapaatTotal', v_total_fines,
        'manualAdjustmentTotal', v_total_bonuses - v_total_fines,
        'advanceRecovery', v_actual_deduction,
        'finalPayout', v_final_payout,
        'remainingDebt', v_remaining_debt,
        'paymentMethod', p_payment_mode,
        'verifiedByOwner', p_verified_by_owner,
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
        'net_payout', v_final_payout
    );

    UPDATE payroll_settlements
    SET carried_forward_debt = v_remaining_debt,
        itemization_payload = v_itemization_payload
    WHERE id = v_settlement_id;

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
