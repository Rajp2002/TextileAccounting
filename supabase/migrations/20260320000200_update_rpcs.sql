-- Migration: Update RPCs for Rate Automation and Tali tracking

-- 1. Update link_batch_to_machine to also update machines.rate_per_meter
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
    v_default_rate DECIMAL;
BEGIN
    -- Get caller's org_id and role from JWT
    v_org_id   := (auth.jwt() ->> 'org_id')::uuid;
    v_caller_role := auth.jwt() ->> 'user_role';

    -- Only owner or supervisor can link
    IF v_caller_role NOT IN ('owner', 'supervisor') THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    -- Fetch the default worker rate from the batch's quality
    SELECT q.default_worker_rate_per_m INTO v_default_rate
    FROM yarn_batches yb
    JOIN qualities q ON q.id = yb.quality_id
    WHERE yb.id = p_batch_id AND yb.org_id = v_org_id;

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

    -- UPDATE MACHINE RATE (Rate Automation Gap)
    IF v_default_rate > 0 THEN
        UPDATE machines
        SET rate_per_meter = v_default_rate
        WHERE id = p_machine_id AND org_id = v_org_id;
    END IF;
END;
$$;

-- 2. Update get_batch_yield_report to subtract leftover_weight_kg (Tali Gap)
DROP FUNCTION IF EXISTS get_batch_yield_report(UUID);
CREATE OR REPLACE FUNCTION get_batch_yield_report(p_org_id UUID)
RETURNS TABLE (
    batch_id UUID,
    batch_name TEXT,
    quality_name TEXT,
    machine_name TEXT,
    total_weight_kg DECIMAL,
    leftover_weight_kg DECIMAL,
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
        yb.leftover_weight_kg                      AS leftover_weight_kg,
        q.target_yield                             AS target_yield,
        q.avg_sale_price_per_m                     AS avg_sale_price_per_m,

        -- Total meters produced for this batch
        COALESCE(SUM(pl.meters), 0)                AS total_meters_produced,

        -- Ya = Σ meters / (weight - tali) (zero-division safe)
        CASE
            WHEN (yb.total_weight_kg - yb.leftover_weight_kg) > 0 THEN
                COALESCE(SUM(pl.meters), 0) / (yb.total_weight_kg - yb.leftover_weight_kg)
            ELSE 0
        END                                        AS actual_yield,

        -- V = ((Ya - Ye) / Ye) × 100  (zero-division safe)
        CASE
            WHEN (yb.total_weight_kg - yb.leftover_weight_kg) > 0 AND q.target_yield > 0 THEN
                (
                    (COALESCE(SUM(pl.meters), 0) / (yb.total_weight_kg - yb.leftover_weight_kg)) - q.target_yield
                ) / q.target_yield * 100
            ELSE 0
        END                                        AS efficiency_variance,

        -- Monetary Loss = (Ye - Ya) × (Weight - Tali) × Price/m   (only when negative variance)
        CASE
            WHEN (yb.total_weight_kg - yb.leftover_weight_kg) > 0 AND q.target_yield > 0
                 AND (COALESCE(SUM(pl.meters), 0) / (yb.total_weight_kg - yb.leftover_weight_kg)) < q.target_yield THEN
                (q.target_yield - (COALESCE(SUM(pl.meters), 0) / (yb.total_weight_kg - yb.leftover_weight_kg)))
                    * (yb.total_weight_kg - yb.leftover_weight_kg)
                    * q.avg_sale_price_per_m
            ELSE 0
        END                                        AS monetary_loss,

        yb.status                                  AS batch_status

    FROM yarn_batches yb
    JOIN qualities q ON q.id = yb.quality_id
    LEFT JOIN machines m ON m.id = yb.current_machine_id
    LEFT JOIN production_logs pl ON pl.yarn_batch_id = yb.id
    WHERE yb.org_id = p_org_id
    GROUP BY yb.id, yb.name, q.name, m.name, yb.total_weight_kg, yb.leftover_weight_kg,
             q.target_yield, q.avg_sale_price_per_m, yb.status;
END;
$$;
