-- ============================================================
-- MIGRATION: Payroll V2 Core Engine (Part 1 - Utilities)
-- 1. get_cycle_bounds: Year-wrap safe cycle determination
-- ============================================================

CREATE OR REPLACE FUNCTION get_cycle_bounds(
    p_date DATE,
    p_cycle_start_day INT
)
RETURNS TABLE (
    cycle_start DATE,
    cycle_end DATE
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_start DATE;
BEGIN
    -- Handles year-wrap automatically via interval '1 month' decrement
    IF EXTRACT(DAY FROM p_date) >= p_cycle_start_day THEN
      v_start := (date_trunc('month', p_date)::DATE 
                     + (p_cycle_start_day - 1) * interval '1 day');
    ELSE
      v_start := ((date_trunc('month', p_date) - interval '1 month')::DATE 
                     + (p_cycle_start_day - 1) * interval '1 day');
    END IF;

    RETURN QUERY SELECT 
        v_start, 
        (v_start + interval '1 month' - interval '1 day')::DATE;
END;
$$;
