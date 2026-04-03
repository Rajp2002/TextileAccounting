-- ============================================================
-- MIGRATION: Orders V2 — Flat Architecture
-- Replaces quality FK requirement with free-text floor instructions
-- Adds shift_assignments table for Module 3
-- ============================================================

-- ============================================================
-- 1. ORDERS: Add free-text floor instruction columns
-- ============================================================
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS quality_label TEXT,      -- free-text quality name e.g. "Canvas Shine"
    ADD COLUMN IF NOT EXISTS warp_instruction TEXT,   -- e.g. "50/48 + 70/36 + Rainbow"
    ADD COLUMN IF NOT EXISTS weft_instruction TEXT,   -- e.g. "50/48"
    ADD COLUMN IF NOT EXISTS notes TEXT;              -- general supervisor notes

-- Make quality_id optional (no longer mandatory)
ALTER TABLE orders
    ALTER COLUMN quality_id DROP NOT NULL;

-- ============================================================
-- 2. MACHINES: Add machine-attached default pay rate
-- ============================================================
ALTER TABLE machines
    ADD COLUMN IF NOT EXISTS default_rate_per_m DECIMAL DEFAULT 1.50; -- ₹/m paid to assigned worker

-- ============================================================
-- 3. SHIFT_ASSIGNMENTS: New table for supervisor shift setup
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift TEXT NOT NULL CHECK (shift IN ('day', 'night')),
    machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
    worker_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    rate_per_m DECIMAL NOT NULL DEFAULT 1.50,  -- confirmed rate for this shift
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (org_id, date, shift, machine_id)   -- one assignment per machine per shift
);

-- ============================================================
-- 4. RLS — SHIFT_ASSIGNMENTS
-- ============================================================
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;

-- SELECT: All org members
CREATE POLICY "Tenant Isolation Select Shift Assignments" ON shift_assignments
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- INSERT: Supervisors and Owners
CREATE POLICY "Org Members Insert Shift Assignments" ON shift_assignments
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- UPDATE: Supervisors and Owners
CREATE POLICY "Org Members Update Shift Assignments" ON shift_assignments
    FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- DELETE: Only Owners
CREATE POLICY "Owners Delete Shift Assignments" ON shift_assignments
    FOR DELETE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- ============================================================
-- 5. INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shift_assignments_org_date
    ON shift_assignments(org_id, date DESC, shift);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_machine
    ON shift_assignments(machine_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_worker
    ON shift_assignments(worker_id, date DESC);

-- ============================================================
-- 6. RPC: Copy Previous Shift Assignments
--    Copies all assignments from a previous shift to the current date/shift
--    Returns the count of assignments copied.
-- ============================================================
CREATE OR REPLACE FUNCTION copy_previous_shift(
    p_date DATE,
    p_shift TEXT,
    p_source_date DATE,
    p_source_shift TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_caller_role TEXT;
    v_copied INT;
BEGIN
    v_org_id      := (auth.jwt() ->> 'org_id')::uuid;
    v_caller_role := auth.jwt() ->> 'user_role';

    IF v_caller_role NOT IN ('owner', 'supervisor') THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    -- Delete any existing assignments for the target date/shift to avoid conflicts
    DELETE FROM shift_assignments
    WHERE org_id = v_org_id
      AND date   = p_date
      AND shift  = p_shift;

    -- Copy from source with current user as creator
    INSERT INTO shift_assignments (org_id, date, shift, machine_id, worker_id, order_id, rate_per_m, created_by)
    SELECT
        org_id,
        p_date,
        p_shift,
        machine_id,
        worker_id,
        order_id,
        rate_per_m,
        auth.uid()
    FROM shift_assignments
    WHERE org_id = v_org_id
      AND date   = p_source_date
      AND shift  = p_source_shift;

    GET DIAGNOSTICS v_copied = ROW_COUNT;
    RETURN v_copied;
END;
$$;

-- ============================================================
-- 7. UPDATE: order_progress_summary view to support flat orders
-- ============================================================
DROP VIEW IF EXISTS order_progress_summary;
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
    o.quality_label,
    o.warp_instruction,
    o.weft_instruction,
    o.notes,
    COALESCE(o.quality_label, q.name, 'Unnamed') AS display_quality_name,
    q.theoretical_meters_per_day,

    -- Total meters produced for this order
    COALESCE(SUM(pl.meters), 0) AS total_meters_produced,

    -- Progress %
    CASE
        WHEN o.total_target_meters > 0 THEN
            LEAST(100, (COALESCE(SUM(pl.meters), 0) / o.total_target_meters) * 100)
        ELSE 0
    END AS progress_percent,

    -- Time Elapsed %
    CASE
        WHEN (o.deadline - o.start_date) > 0 THEN
            GREATEST(0, LEAST(100, (CURRENT_DATE - o.start_date)::decimal / (o.deadline - o.start_date)::decimal * 100))
        WHEN CURRENT_DATE >= o.deadline THEN 100
        ELSE 0
    END AS time_elapsed_percent,

    -- Pace Index
    CASE
        WHEN (o.deadline - o.start_date) > 0 AND (CURRENT_DATE - o.start_date) > 0 THEN
            ((COALESCE(SUM(pl.meters), 0) / o.total_target_meters)) /
            ((CURRENT_DATE - o.start_date)::decimal / (o.deadline - o.start_date)::decimal)
        ELSE 1.0
    END AS pace_index,

    -- Assigned machines count
    (SELECT COUNT(*)::int FROM machines m WHERE m.current_order_id = o.id) AS assigned_machines_count

FROM orders o
LEFT JOIN qualities q ON q.id = o.quality_id
LEFT JOIN production_logs pl ON pl.order_id = o.id
GROUP BY o.id, o.org_id, o.party_name, o.total_target_meters, o.start_date,
         o.deadline, o.status, o.quality_id, o.quality_label, o.warp_instruction,
         o.weft_instruction, o.notes, q.name, q.theoretical_meters_per_day;

-- ============================================================
-- 8. Enable Realtime for shift_assignments
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE shift_assignments;
