-- ============================================================
-- MIGRATION: Yarn-to-Fabric Audit — Qualities, Yarn Batches, Yield RPC
-- ============================================================

-- ============================================================
-- 1. QUALITIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS qualities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) NOT NULL,
    name TEXT NOT NULL,
    target_yield DECIMAL NOT NULL DEFAULT 0,          -- expected meters per kg of yarn
    avg_sale_price_per_m DECIMAL NOT NULL DEFAULT 0,  -- owner's revenue per meter (for monetary loss calc)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. YARN BATCHES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS yarn_batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) NOT NULL,
    name TEXT NOT NULL,                                -- e.g. "Batch #204"
    quality_id UUID REFERENCES qualities(id) NOT NULL,
    total_weight_kg DECIMAL NOT NULL DEFAULT 0,        -- e.g. 100.00
    current_machine_id UUID REFERENCES machines(id) ON DELETE SET NULL, -- "Active Machine" shortcut
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. ADD yarn_batch_id TO production_logs (nullable for legacy)
-- ============================================================
ALTER TABLE production_logs
    ADD COLUMN IF NOT EXISTS yarn_batch_id UUID REFERENCES yarn_batches(id) ON DELETE SET NULL;

-- ============================================================
-- 4. RLS — QUALITIES
-- ============================================================
ALTER TABLE qualities ENABLE ROW LEVEL SECURITY;

-- SELECT: All org members can view qualities
CREATE POLICY "Tenant Isolation" ON qualities
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- INSERT: Only owners can create qualities
CREATE POLICY "Owners Insert Qualities" ON qualities
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- UPDATE: Only owners can update qualities
CREATE POLICY "Owners Update Qualities" ON qualities
    FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- DELETE: Only owners can delete qualities
CREATE POLICY "Owners Delete Qualities" ON qualities
    FOR DELETE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- ============================================================
-- 5. RLS — YARN BATCHES
-- ============================================================
ALTER TABLE yarn_batches ENABLE ROW LEVEL SECURITY;

-- SELECT: All org members can view batches
CREATE POLICY "Tenant Isolation" ON yarn_batches
    FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- INSERT: Only owners can create yarn batches
CREATE POLICY "Owners Insert Yarn Batches" ON yarn_batches
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- UPDATE: Owners can fully manage; Supervisors can ONLY update current_machine_id (via RPC)
CREATE POLICY "Owners Update Yarn Batches" ON yarn_batches
    FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- DELETE: Only owners can delete yarn batches
CREATE POLICY "Owners Delete Yarn Batches" ON yarn_batches
    FOR DELETE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- ============================================================
-- 6. RPC: Supervisor links a Yarn Batch to a Machine
--    (Bypasses RLS restriction on yarn_batches UPDATE for supervisors)
-- ============================================================
CREATE OR REPLACE FUNCTION link_batch_to_machine(
    p_batch_id UUID,
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

    -- Clear any other batch currently on that machine (one beam per machine)
    UPDATE yarn_batches
    SET current_machine_id = NULL
    WHERE current_machine_id = p_machine_id
      AND org_id = v_org_id
      AND status = 'active';

    -- Assign the batch to the machine
    UPDATE yarn_batches
    SET current_machine_id = p_machine_id
    WHERE id = p_batch_id
      AND org_id = v_org_id
      AND status = 'active';
END;
$$;

-- ============================================================
-- 7. RPC: Yield Analytics per Batch (Owner-only analytics)
--    Zero-division safe. Returns monetary loss in ₹.
-- ============================================================
CREATE OR REPLACE FUNCTION get_batch_yield_report(p_org_id UUID)
RETURNS TABLE (
    batch_id UUID,
    batch_name TEXT,
    quality_name TEXT,
    machine_name TEXT,
    total_weight_kg DECIMAL,
    target_yield DECIMAL,
    avg_sale_price_per_m DECIMAL,
    total_meters_produced DECIMAL,
    actual_yield DECIMAL,
    efficiency_variance DECIMAL,
    monetary_loss DECIMAL,
    batch_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify caller is owner of this org
    IF (auth.jwt() ->> 'user_role') <> 'owner' THEN
        RAISE EXCEPTION 'Permission denied: Owner only';
    END IF;
    IF (auth.jwt() ->> 'org_id')::uuid <> p_org_id THEN
        RAISE EXCEPTION 'Permission denied: Wrong org';
    END IF;

    RETURN QUERY
    SELECT
        yb.id                                      AS batch_id,
        yb.name                                    AS batch_name,
        q.name                                     AS quality_name,
        m.name                                     AS machine_name,
        yb.total_weight_kg                         AS total_weight_kg,
        q.target_yield                             AS target_yield,
        q.avg_sale_price_per_m                     AS avg_sale_price_per_m,

        -- Total meters produced for this batch
        COALESCE(SUM(pl.meters), 0)                AS total_meters_produced,

        -- Ya = Σ meters / weight (zero-division safe)
        CASE
            WHEN yb.total_weight_kg > 0 THEN
                COALESCE(SUM(pl.meters), 0) / yb.total_weight_kg
            ELSE 0
        END                                        AS actual_yield,

        -- V = ((Ya - Ye) / Ye) × 100  (zero-division safe)
        CASE
            WHEN yb.total_weight_kg > 0 AND q.target_yield > 0 THEN
                (
                    (COALESCE(SUM(pl.meters), 0) / yb.total_weight_kg) - q.target_yield
                ) / q.target_yield * 100
            ELSE 0
        END                                        AS efficiency_variance,

        -- Monetary Loss = (Ye - Ya) × Weight × Price/m   (only when negative variance)
        CASE
            WHEN yb.total_weight_kg > 0 AND q.target_yield > 0
                 AND (COALESCE(SUM(pl.meters), 0) / yb.total_weight_kg) < q.target_yield THEN
                (q.target_yield - (COALESCE(SUM(pl.meters), 0) / yb.total_weight_kg))
                    * yb.total_weight_kg
                    * q.avg_sale_price_per_m
            ELSE 0
        END                                        AS monetary_loss,

        yb.status                                  AS batch_status

    FROM yarn_batches yb
    JOIN qualities q ON q.id = yb.quality_id
    LEFT JOIN machines m ON m.id = yb.current_machine_id
    LEFT JOIN production_logs pl ON pl.yarn_batch_id = yb.id
    WHERE yb.org_id = p_org_id
    GROUP BY yb.id, yb.name, q.name, m.name, yb.total_weight_kg,
             q.target_yield, q.avg_sale_price_per_m, yb.status;
END;
$$;

-- ============================================================
-- 8. INDEX for fast batch lookups on production_logs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_production_logs_yarn_batch
    ON production_logs(yarn_batch_id)
    WHERE yarn_batch_id IS NOT NULL;

-- Index for "Active Machine" shortcut query
CREATE INDEX IF NOT EXISTS idx_yarn_batches_active_machine
    ON yarn_batches(current_machine_id, status)
    WHERE status = 'active';
