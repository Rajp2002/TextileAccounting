-- ============================================================
-- MIGRATION: Order-Centric Production (Job Work)
-- ============================================================

-- 1. QUALITIES: Add theoretical_meters_per_day for "Warm-Up" forecasts
ALTER TABLE qualities
    ADD COLUMN IF NOT EXISTS theoretical_meters_per_day DECIMAL NOT NULL DEFAULT 50; -- sensible default

-- 2. ORDERS: The core "Job Work" entity
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) NOT NULL,
    quality_id UUID REFERENCES qualities(id) NOT NULL,
    party_name TEXT NOT NULL,
    total_target_meters DECIMAL NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    deadline DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. MACHINES: Add link to the active order
ALTER TABLE machines
    ADD COLUMN IF NOT EXISTS current_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- 4. PRODUCTION_LOGS: Add link to the order (propagated from machine)
ALTER TABLE production_logs
    ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- ============================================================
-- 5. RLS — ORDERS
-- ============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- SELECT: All org members can view orders
CREATE POLICY "Tenant Isolation Select Orders" ON orders
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- ALL: Only owners can manage orders
CREATE POLICY "Owners Manage Orders" ON orders
    FOR ALL
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- ============================================================
-- 6. VIEW: Order Progress Summary (Business Intelligence)
--    Calculates meters, progress %, time elapsed %, and Pace.
-- ============================================================
CREATE OR REPLACE VIEW order_progress_summary AS
SELECT
    o.id AS order_id,
    o.org_id,
    o.party_name,
    o.total_target_meters,
    o.start_date,
    o.deadline,
    o.status,
    o.quality_id,
    q.name AS quality_name,
    q.theoretical_meters_per_day,
    
    -- Total meters produced for this order
    COALESCE(SUM(pl.meters), 0) AS total_meters_produced,
    
    -- Progress %
    CASE
        WHEN o.total_target_meters > 0 THEN
            LEAST(100, (COALESCE(SUM(pl.meters), 0) / o.total_target_meters) * 100)
        ELSE 0
    END AS progress_percent,
    
    -- Time Elapsed % (Today relative to start and deadline)
    CASE
        WHEN (o.deadline - o.start_date) > 0 THEN
            GREATEST(0, LEAST(100, (CURRENT_DATE - o.start_date)::decimal / (o.deadline - o.start_date)::decimal * 100))
        WHEN CURRENT_DATE >= o.deadline THEN 100
        ELSE 0
    END AS time_elapsed_percent,
    
    -- Pace Metric (Health Index): Progress / Time Elapsed
    -- If time_elapsed is 0, we can't calculate pace; we'll return 1.0 (on track)
    CASE
        WHEN (o.deadline - o.start_date) > 0 AND (CURRENT_DATE - o.start_date) > 0 THEN
            ( (COALESCE(SUM(pl.meters), 0) / o.total_target_meters) ) / 
            ( (CURRENT_DATE - o.start_date)::decimal / (o.deadline - o.start_date)::decimal )
        ELSE 1.0
    END AS pace_index,
    
    -- Count of machines currently assigned to this order
    (SELECT COUNT(*)::int FROM machines m WHERE m.current_order_id = o.id) AS assigned_machines_count

FROM orders o
JOIN qualities q ON q.id = o.quality_id
LEFT JOIN production_logs pl ON pl.order_id = o.id
GROUP BY o.id, o.org_id, o.party_name, o.total_target_meters, o.start_date, o.deadline, o.status, o.quality_id, q.name, q.theoretical_meters_per_day;

-- ============================================================
-- 7. INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_production_logs_order_id ON production_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_machines_current_order_id ON machines(current_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_org_id ON orders(org_id);

-- ============================================================
-- 8. RPC: Supervisor links an Order to a Machine
--    (Bypasses RLS restriction on machines UPDATE for supervisors)
-- ============================================================
CREATE OR REPLACE FUNCTION link_order_to_machine(
    p_order_id UUID,
    p_machine_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_caller_role TEXT;
BEGIN
    -- Get caller's org_id and role from JWT
    v_org_id   := (auth.jwt() ->> 'org_id')::uuid;
    v_caller_role := auth.jwt() ->> 'user_role';

    -- Only owner or supervisor can link
    IF v_caller_role NOT IN ('owner', 'supervisor') THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    -- Assign the order to the machine
    UPDATE machines
    SET current_order_id = p_order_id
    WHERE id = p_machine_id
      AND org_id = v_org_id;
END;
$$;

-- ============================================================
-- 9. RPC: Get Order Forecast
--    Calculates predicted finish date based on:
--    - Actual 3-day velocity (if data exists)
--    - OR Theoretical Speed fallback (for first 48h)
-- ============================================================
CREATE OR REPLACE FUNCTION get_order_forecast(p_order_id UUID)
RETURNS TABLE (
    remaining_meters DECIMAL,
    avg_daily_production DECIMAL,
    days_to_finish DECIMAL,
    predicted_finish_date DATE,
    is_theoretical BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target DECIMAL;
    v_produced DECIMAL;
    v_remaining DECIMAL;
    v_start_date DATE;
    v_theoretical_speed DECIMAL;
    v_assigned_machines_count INT;
    v_actual_avg DECIMAL;
    v_final_avg DECIMAL;
    v_is_theoretical BOOLEAN := FALSE;
BEGIN
    -- 1. Get base order info
    SELECT o.total_target_meters, o.start_date, q.theoretical_meters_per_day
    INTO v_target, v_start_date, v_theoretical_speed
    FROM orders o
    JOIN qualities q ON q.id = o.quality_id
    WHERE o.id = p_order_id;

    -- 2. Get total produced
    SELECT COALESCE(SUM(meters), 0) INTO v_produced
    FROM production_logs
    WHERE order_id = p_order_id;

    v_remaining := GREATEST(0, v_target - v_produced);

    -- 3. Get assigned machines count
    SELECT COUNT(*)::int INTO v_assigned_machines_count
    FROM machines
    WHERE current_order_id = p_order_id;

    -- 4. Calculate actual avg production (last 3 calendar days)
    SELECT COALESCE(SUM(meters) / 3, 0) INTO v_actual_avg
    FROM production_logs
    WHERE order_id = p_order_id
      AND date >= (CURRENT_DATE - INTERVAL '3 days')::date;

    -- 5. Logic: If order is < 48h old OR actual avg is suspiciously low, use theoretical
    IF (CURRENT_DATE - v_start_date) < 2 OR v_actual_avg < (v_theoretical_speed * v_assigned_machines_count * 0.5) THEN
        v_final_avg := v_theoretical_speed * GREATEST(1, v_assigned_machines_count);
        v_is_theoretical := TRUE;
    ELSE
        v_final_avg := v_actual_avg;
        v_is_theoretical := FALSE;
    END IF;

    -- 6. Return values
    IF v_final_avg > 0 THEN
        remaining_meters := v_remaining;
        avg_daily_production := v_final_avg;
        days_to_finish := v_remaining / v_final_avg;
        predicted_finish_date := (CURRENT_DATE + (CEIL(v_remaining / v_final_avg) * INTERVAL '1 day'))::date;
        is_theoretical := v_is_theoretical;
    ELSE
        remaining_meters := v_remaining;
        avg_daily_production := 0;
        days_to_finish := NULL;
        predicted_finish_date := NULL;
        is_theoretical := v_is_theoretical;
    END IF;

    RETURN NEXT;
END;
$$;
