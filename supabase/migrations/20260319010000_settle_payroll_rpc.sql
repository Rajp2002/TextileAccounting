-- ============================================================
-- MIGRATION: Settlement RPC Functions
-- ============================================================
-- Atomic functions for settling/unsettling payroll with advance
-- deductions. These run inside a single transaction so either
-- everything succeeds or nothing does.
-- ============================================================

-- ─── SETTLE: Mark paid + deduct advances ─────────────────────

CREATE OR REPLACE FUNCTION settle_worker_payroll(
    p_org_id UUID,
    p_worker_type TEXT,         -- 'meter' or 'fixed'
    p_worker_id BIGINT,
    p_month TEXT,               -- 'YYYY-MM'
    p_gross_amount DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment_id BIGINT;
    v_total_pending DECIMAL := 0;
    v_deducted_total DECIMAL := 0;
    v_remaining_budget DECIMAL;
    v_net_amount DECIMAL;
    v_advance RECORD;
    v_deduct_amount DECIMAL;
BEGIN
    -- 1. Upsert the payroll_payments record
    IF p_worker_type = 'meter' THEN
        INSERT INTO payroll_payments (org_id, worker_type, meter_worker_id, fixed_worker_id, month, amount, paid, paid_at)
        VALUES (p_org_id, p_worker_type, p_worker_id, NULL, p_month, p_gross_amount, true, now())
        ON CONFLICT ON CONSTRAINT payroll_unique_meter_worker_month
        DO UPDATE SET amount = EXCLUDED.amount, paid = true, paid_at = now()
        RETURNING id INTO v_payment_id;
    ELSE
        INSERT INTO payroll_payments (org_id, worker_type, meter_worker_id, fixed_worker_id, month, amount, paid, paid_at)
        VALUES (p_org_id, p_worker_type, NULL, p_worker_id, p_month, p_gross_amount, true, now())
        ON CONFLICT ON CONSTRAINT payroll_unique_fixed_worker_month
        DO UPDATE SET amount = EXCLUDED.amount, paid = true, paid_at = now()
        RETURNING id INTO v_payment_id;
    END IF;

    -- 2. Deduct pending advances oldest-first, up to gross pay
    v_remaining_budget := p_gross_amount;

    FOR v_advance IN
        SELECT id, amount
        FROM worker_advances
        WHERE org_id = p_org_id
          AND status = 'pending'
          AND CASE
                WHEN p_worker_type = 'meter' THEN meter_worker_id = p_worker_id
                ELSE fixed_worker_id = p_worker_id
              END
        ORDER BY created_at ASC   -- oldest debts first
        FOR UPDATE                -- lock rows for atomicity
    LOOP
        EXIT WHEN v_remaining_budget <= 0;

        -- Full or partial deduction
        IF v_advance.amount <= v_remaining_budget THEN
            -- Fully deduct this advance
            v_deduct_amount := v_advance.amount;
            UPDATE worker_advances
            SET status = 'deducted',
                deducted_at = now(),
                deducted_in_month = p_month,
                settled_by_payment_id = v_payment_id
            WHERE id = v_advance.id;
        ELSE
            -- Can't fully deduct — leave as pending (carry-over)
            -- Don't partially split individual advances; skip to preserve ledger clarity
            v_deduct_amount := 0;
        END IF;

        v_remaining_budget := v_remaining_budget - v_deduct_amount;
        v_deducted_total := v_deducted_total + v_deduct_amount;
    END LOOP;

    -- 3. Calculate net payout
    v_net_amount := GREATEST(0, p_gross_amount - v_deducted_total);

    -- 4. Update the payment record with the net amount
    UPDATE payroll_payments
    SET amount = v_net_amount
    WHERE id = v_payment_id;

    -- 5. Return summary
    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'gross_amount', p_gross_amount,
        'total_deducted', v_deducted_total,
        'net_amount', v_net_amount,
        'remaining_debt', GREATEST(0, (
            SELECT COALESCE(SUM(amount), 0)
            FROM worker_advances
            WHERE org_id = p_org_id
              AND status = 'pending'
              AND CASE
                    WHEN p_worker_type = 'meter' THEN meter_worker_id = p_worker_id
                    ELSE fixed_worker_id = p_worker_id
                  END
        ))
    );
END;
$$;


-- ─── UNSETTLE: Revert paid + restore advances ───────────────

CREATE OR REPLACE FUNCTION unsettle_worker_payroll(
    p_org_id UUID,
    p_worker_type TEXT,         -- 'meter' or 'fixed'
    p_worker_id BIGINT,
    p_month TEXT                -- 'YYYY-MM'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment_id BIGINT;
    v_reverted_count INT;
BEGIN
    -- 1. Find and un-mark the payment record
    IF p_worker_type = 'meter' THEN
        UPDATE payroll_payments
        SET paid = false, paid_at = NULL
        WHERE org_id = p_org_id
          AND worker_type = p_worker_type
          AND meter_worker_id = p_worker_id
          AND month = p_month
        RETURNING id INTO v_payment_id;
    ELSE
        UPDATE payroll_payments
        SET paid = false, paid_at = NULL
        WHERE org_id = p_org_id
          AND worker_type = p_worker_type
          AND fixed_worker_id = p_worker_id
          AND month = p_month
        RETURNING id INTO v_payment_id;
    END IF;

    IF v_payment_id IS NULL THEN
        RETURN jsonb_build_object('reverted_advances', 0);
    END IF;

    -- 2. Revert advances ONLY from this specific settlement cycle
    --    (scoped by deducted_in_month = p_month AND settled_by_payment_id)
    UPDATE worker_advances
    SET status = 'pending',
        deducted_at = NULL,
        deducted_in_month = NULL,
        settled_by_payment_id = NULL
    WHERE org_id = p_org_id
      AND deducted_in_month = p_month
      AND settled_by_payment_id = v_payment_id
      AND status = 'deducted'
      AND CASE
            WHEN p_worker_type = 'meter' THEN meter_worker_id = p_worker_id
            ELSE fixed_worker_id = p_worker_id
          END;

    GET DIAGNOSTICS v_reverted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'reverted_advances', v_reverted_count
    );
END;
$$;
