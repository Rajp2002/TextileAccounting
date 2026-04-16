-- ============================================================
-- MIGRATION: Order Completion Guard
-- Prevents production from being logged once an order hits its
-- target, and auto-completes the order (+ unlinks machines)
-- the moment the target is reached.
-- ============================================================

-- ============================================================
-- 1. BLOCK: Reject production logs for already-completed orders
-- ============================================================
CREATE OR REPLACE FUNCTION block_production_on_completed_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
BEGIN
    -- Only check rows that have an order linked
    IF NEW.order_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT status INTO v_status
    FROM orders
    WHERE id = NEW.order_id;

    IF v_status = 'completed' THEN
        RAISE EXCEPTION 'Cannot log production: order is already completed';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_production_on_completed_order ON production_logs;
CREATE TRIGGER trg_block_production_on_completed_order
    BEFORE INSERT OR UPDATE ON production_logs
    FOR EACH ROW
    EXECUTE FUNCTION block_production_on_completed_order();

-- ============================================================
-- 2. CAP: Reject entries that would push total over the target
-- ============================================================
CREATE OR REPLACE FUNCTION check_order_target_before_log()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_target          DECIMAL;
    v_existing_total  DECIMAL;
BEGIN
    IF NEW.order_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT total_target_meters INTO v_target
    FROM orders
    WHERE id = NEW.order_id;

    IF v_target IS NULL THEN
        RETURN NEW;
    END IF;

    -- Sum all existing logs for this order EXCLUDING the current row being updated
    SELECT COALESCE(SUM(meters), 0) INTO v_existing_total
    FROM production_logs
    WHERE order_id = NEW.order_id
      AND id IS DISTINCT FROM NEW.id;

    IF (v_existing_total + NEW.meters) > v_target THEN
        RAISE EXCEPTION
            'Production entry would exceed order target (target: %m, already logged: %m, new entry: %m)',
            v_target, v_existing_total, NEW.meters;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_order_target_before_log ON production_logs;
CREATE TRIGGER trg_check_order_target_before_log
    BEFORE INSERT OR UPDATE ON production_logs
    FOR EACH ROW
    EXECUTE FUNCTION check_order_target_before_log();

-- ============================================================
-- 3. AUTO-COMPLETE: Flip order to completed + unlink machines
--    when total produced reaches the target.
-- ============================================================
CREATE OR REPLACE FUNCTION auto_complete_order_on_log()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_id        UUID;
    v_target          DECIMAL;
    v_total_produced  DECIMAL;
    v_status          TEXT;
BEGIN
    -- Determine the affected order_id (prefer NEW, fall back to OLD for deletes)
    v_order_id := COALESCE(NEW.order_id, OLD.order_id);

    IF v_order_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Fetch current order info
    SELECT total_target_meters, status
    INTO v_target, v_status
    FROM orders
    WHERE id = v_order_id;

    -- Only auto-complete active orders
    IF v_status IS DISTINCT FROM 'active' THEN
        RETURN NEW;
    END IF;

    -- Sum all logs for this order (the current trigger row is already committed in AFTER)
    SELECT COALESCE(SUM(meters), 0) INTO v_total_produced
    FROM production_logs
    WHERE order_id = v_order_id;

    IF v_total_produced >= v_target THEN
        -- Mark order completed
        UPDATE orders
        SET status = 'completed'
        WHERE id = v_order_id;

        -- Unlink all machines assigned to this order
        UPDATE machines
        SET current_order_id = NULL
        WHERE current_order_id = v_order_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_complete_order_on_log ON production_logs;
CREATE TRIGGER trg_auto_complete_order_on_log
    AFTER INSERT OR UPDATE ON production_logs
    FOR EACH ROW
    EXECUTE FUNCTION auto_complete_order_on_log();

-- ============================================================
-- 4. RETROACTIVE FIX: Complete any orders already over-logged
--    This is a one-time statement — safe to re-run.
-- ============================================================
WITH over_logged AS (
    SELECT
        o.id AS order_id
    FROM orders o
    JOIN (
        SELECT order_id, SUM(meters) AS total_produced
        FROM production_logs
        WHERE order_id IS NOT NULL
        GROUP BY order_id
    ) pl ON pl.order_id = o.id
    WHERE o.status = 'active'
      AND pl.total_produced >= o.total_target_meters
)
UPDATE orders
SET status = 'completed'
WHERE id IN (SELECT order_id FROM over_logged);

-- Unlink machines from orders that were just retroactively completed
UPDATE machines
SET current_order_id = NULL
WHERE current_order_id IN (
    SELECT id FROM orders WHERE status = 'completed'
);
