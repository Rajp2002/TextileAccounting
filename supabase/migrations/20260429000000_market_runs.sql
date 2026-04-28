-- ============================================================
-- MIGRATION: Market Runs — Speculative (Market-Driven) Production
-- ============================================================
-- Adds the second production entry point: owner decides what to
-- weave based on market knowledge, runs production into stock,
-- then sells to one or more traders at negotiated prices.
--
-- Lifecycle:
--   Estimator → market_run (cost anchor) → orders (floor work)
--   → grey stock (godown) → market_run_sales (per-trader)
--   → party_invoices (auto-created per sale) → dispatch
-- ============================================================

-- ============================================================
-- 1. MARKET_RUNS — top-level speculative production entity
-- ============================================================

CREATE TABLE IF NOT EXISTS market_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Fabric identity
    fabric_label        TEXT NOT NULL,          -- e.g. "Canvas Shine 100D"
    quality_label       TEXT,                   -- copy from estimator template
    warp_instruction    TEXT,                   -- e.g. "50/48 + 70/36 + Rainbow"
    weft_instruction    TEXT,                   -- e.g. "50/48"
    -- Production plan
    target_meters       NUMERIC(12,2) NOT NULL CHECK (target_meters > 0),
    -- Cost anchor — snapshotted from estimator at run creation
    cost_per_meter      NUMERIC(12,4) NOT NULL CHECK (cost_per_meter >= 0),
    worker_rate_per_m   NUMERIC(12,4),          -- loom-weaver wage ₹/m
    -- Estimator link (nullable — run could theoretically be created without a full quote)
    quote_id            UUID REFERENCES estimator_quotes(id) ON DELETE SET NULL,
    -- Status lifecycle
    -- production   → fabric is still being made (order is active)
    -- in_godown    → all target meters produced, waiting to sell
    -- partially_sold → some meters sold, some remain in godown
    -- sold_out     → all meters sold
    -- closed       → manually closed (over-produced / cancelled)
    status              TEXT NOT NULL DEFAULT 'production'
                          CHECK (status IN ('production','in_godown','partially_sold','sold_out','closed')),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_runs_org_id
    ON market_runs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_runs_org_status
    ON market_runs(org_id, status);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS trg_market_runs_updated_at ON market_runs;
CREATE TRIGGER trg_market_runs_updated_at
    BEFORE UPDATE ON market_runs
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- 2. MARKET_RUN_SALES — per-trader sale from a market run
-- ============================================================

CREATE TABLE IF NOT EXISTS market_run_sales (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    market_run_id       UUID NOT NULL REFERENCES market_runs(id) ON DELETE CASCADE,
    party_id            UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    -- Invoice link (created atomically with the sale, updatable after dispatch)
    invoice_id          UUID REFERENCES party_invoices(id) ON DELETE SET NULL,
    -- Sale terms
    meters_sold         NUMERIC(12,2) NOT NULL CHECK (meters_sold > 0),
    price_per_meter     NUMERIC(12,4) NOT NULL CHECK (price_per_meter >= 0),
    -- Cost snapshot from the run at time of sale (so historical P&L is immutable)
    cost_per_meter      NUMERIC(12,4) NOT NULL CHECK (cost_per_meter >= 0),
    -- Status
    -- pending    → sale recorded, invoice drafted, not yet dispatched
    -- dispatched → fabric physically dispatched
    -- settled    → invoice paid
    status              TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','dispatched','settled')),
    sale_date           DATE NOT NULL DEFAULT CURRENT_DATE,
    notes               TEXT,
    created_by          UUID REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_run_sales_market_run_id
    ON market_run_sales(market_run_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_market_run_sales_party_id
    ON market_run_sales(party_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_market_run_sales_org_id
    ON market_run_sales(org_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_market_run_sales_updated_at ON market_run_sales;
CREATE TRIGGER trg_market_run_sales_updated_at
    BEFORE UPDATE ON market_run_sales
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- 3. ALTER ORDERS — add market_run_id FK, relax party_name NOT NULL
-- ============================================================

-- Link orders to a market run (null for all existing quote-to-order orders)
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS market_run_id UUID REFERENCES market_runs(id) ON DELETE SET NULL;

-- Allow party_name to be null for market run orders
-- (display fallback: use fabric_label from the linked market_run)
ALTER TABLE orders
    ALTER COLUMN party_name DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_market_run_id
    ON orders(market_run_id)
    WHERE market_run_id IS NOT NULL;

-- ============================================================
-- 4. ALTER ESTIMATOR_QUOTES — add market_run_id backlink
-- ============================================================

ALTER TABLE estimator_quotes
    ADD COLUMN IF NOT EXISTS market_run_id UUID REFERENCES market_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estimator_quotes_market_run_id
    ON estimator_quotes(market_run_id)
    WHERE market_run_id IS NOT NULL;

-- ============================================================
-- 5. RLS — MARKET_RUNS
-- ============================================================

ALTER TABLE market_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_runs_org_select"
    ON market_runs FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "market_runs_owner_insert"
    ON market_runs FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

CREATE POLICY "market_runs_owner_update"
    ON market_runs FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    )
    WITH CHECK (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- ============================================================
-- 6. RLS — MARKET_RUN_SALES
-- ============================================================

ALTER TABLE market_run_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_run_sales_org_select"
    ON market_run_sales FOR SELECT
    USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE POLICY "market_run_sales_owner_insert"
    ON market_run_sales FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

CREATE POLICY "market_run_sales_owner_update"
    ON market_run_sales FOR UPDATE
    USING (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    )
    WITH CHECK (
        (auth.jwt() ->> 'user_role') = 'owner' AND
        org_id = (auth.jwt() ->> 'org_id')::uuid
    );

-- ============================================================
-- 7. RPC: create_market_run_sale
--    Atomically:
--      1. Validates meters_sold ≤ available in godown
--      2. Inserts market_run_sales row
--      3. Creates party_invoices draft record
--      4. Links invoice_id back to the sale
--      5. Updates market_runs.status based on remaining inventory
-- ============================================================

CREATE OR REPLACE FUNCTION create_market_run_sale(
    p_market_run_id     UUID,
    p_party_id          UUID,
    p_meters_sold       NUMERIC,
    p_price_per_meter   NUMERIC,
    p_sale_date         DATE,
    p_notes             TEXT,
    p_invoice_number    TEXT,
    p_due_date          DATE
)
RETURNS TABLE (
    sale_id         UUID,
    invoice_id      UUID,
    profit_per_meter NUMERIC,
    total_profit    NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id            UUID;
    v_caller_role       TEXT;
    v_run               RECORD;
    v_total_produced    NUMERIC;
    v_total_sold        NUMERIC;
    v_available         NUMERIC;
    v_sale_id           UUID;
    v_invoice_id        UUID;
    v_profit_per_m      NUMERIC;
    v_total_profit      NUMERIC;
    v_gross_amount      NUMERIC;
    v_new_status        TEXT;
BEGIN
    v_org_id      := (auth.jwt() ->> 'org_id')::uuid;
    v_caller_role := auth.jwt() ->> 'user_role';

    IF v_caller_role <> 'owner' THEN
        RAISE EXCEPTION 'Only owners can record market run sales';
    END IF;

    -- Lock the market run row for this transaction
    SELECT mr.*
        INTO v_run
    FROM market_runs mr
    WHERE mr.id = p_market_run_id
      AND mr.org_id = v_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market run not found';
    END IF;

    IF v_run.status = 'sold_out' THEN
        RAISE EXCEPTION 'This market run is already sold out';
    END IF;

    IF v_run.status = 'closed' THEN
        RAISE EXCEPTION 'This market run has been closed';
    END IF;

    -- Calculate available meters in godown
    -- Total produced: sum of production_logs via the linked order(s)
    SELECT COALESCE(SUM(pl.meters), 0)
        INTO v_total_produced
    FROM production_logs pl
    JOIN orders o ON o.id = pl.order_id
    WHERE o.market_run_id = p_market_run_id;

    -- Total already sold
    SELECT COALESCE(SUM(meters_sold), 0)
        INTO v_total_sold
    FROM market_run_sales
    WHERE market_run_id = p_market_run_id;

    v_available := v_total_produced - v_total_sold;

    IF p_meters_sold > v_available THEN
        RAISE EXCEPTION 'Cannot sell % m — only % m available in godown',
            p_meters_sold, v_available;
    END IF;

    -- Compute P&L
    v_profit_per_m  := p_price_per_meter - v_run.cost_per_meter;
    v_total_profit  := v_profit_per_m * p_meters_sold;
    v_gross_amount  := p_price_per_meter * p_meters_sold;

    -- Insert sale record (invoice_id null initially)
    INSERT INTO market_run_sales (
        org_id,
        market_run_id,
        party_id,
        meters_sold,
        price_per_meter,
        cost_per_meter,
        status,
        sale_date,
        notes,
        created_by
    ) VALUES (
        v_org_id,
        p_market_run_id,
        p_party_id,
        p_meters_sold,
        p_price_per_meter,
        v_run.cost_per_meter,
        'pending',
        p_sale_date,
        p_notes,
        auth.uid()
    )
    RETURNING id INTO v_sale_id;

    -- Create party_invoices draft
    INSERT INTO party_invoices (
        org_id,
        party_id,
        invoice_number,
        invoice_date,
        due_date,
        total_meters,
        rate_per_m,
        gross_amount,
        gst_percent,
        gst_amount,
        net_amount,
        status,
        notes,
        created_by
    ) VALUES (
        v_org_id,
        p_party_id,
        p_invoice_number,
        p_sale_date,
        p_due_date,
        p_meters_sold,
        p_price_per_meter,
        v_gross_amount,
        0,              -- GST defaults to 0; owner can adjust in ledger
        0,
        v_gross_amount,
        'unpaid',
        COALESCE(p_notes, '') || CASE WHEN p_notes IS NOT NULL AND p_notes <> '' THEN ' · ' ELSE '' END ||
            'Market Run: ' || v_run.fabric_label,
        auth.uid()
    )
    RETURNING id INTO v_invoice_id;

    -- Link invoice back to sale
    UPDATE market_run_sales
        SET invoice_id = v_invoice_id
    WHERE id = v_sale_id;

    -- Recalculate run status
    DECLARE
        v_new_total_sold NUMERIC;
    BEGIN
        v_new_total_sold := v_total_sold + p_meters_sold;
        IF v_new_total_sold >= v_total_produced THEN
            v_new_status := 'sold_out';
        ELSIF v_new_total_sold > 0 THEN
            v_new_status := 'partially_sold';
        ELSE
            v_new_status := v_run.status;
        END IF;
    END;

    UPDATE market_runs
        SET status = v_new_status
    WHERE id = p_market_run_id;

    RETURN QUERY
    SELECT v_sale_id, v_invoice_id, v_profit_per_m, v_total_profit;
END;
$$;

GRANT EXECUTE ON FUNCTION create_market_run_sale(UUID, UUID, NUMERIC, NUMERIC, DATE, TEXT, TEXT, DATE)
    TO authenticated, service_role;

-- ============================================================
-- 8. VIEW: market_run_summary
--    One row per market run with full inventory and P&L metrics.
-- ============================================================

CREATE OR REPLACE VIEW market_run_summary AS
SELECT
    mr.id               AS market_run_id,
    mr.org_id,
    mr.fabric_label,
    mr.quality_label,
    mr.warp_instruction,
    mr.weft_instruction,
    mr.target_meters,
    mr.cost_per_meter,
    mr.worker_rate_per_m,
    mr.status,
    mr.quote_id,
    mr.notes,
    mr.created_at,

    -- Linked production order id (one-to-one for now)
    ( SELECT o.id FROM orders o WHERE o.market_run_id = mr.id LIMIT 1 ) AS order_id,
    ( SELECT o.status FROM orders o WHERE o.market_run_id = mr.id LIMIT 1 ) AS order_status,

    -- Total meters produced against this run's order(s)
    COALESCE((
        SELECT SUM(pl.meters)
        FROM production_logs pl
        JOIN orders o ON o.id = pl.order_id
        WHERE o.market_run_id = mr.id
    ), 0) AS total_meters_produced,

    -- Total meters sold across all sales
    COALESCE((
        SELECT SUM(s.meters_sold)
        FROM market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0) AS total_meters_sold,

    -- Meters still in godown (produced - sold)
    COALESCE((
        SELECT SUM(pl.meters)
        FROM production_logs pl
        JOIN orders o ON o.id = pl.order_id
        WHERE o.market_run_id = mr.id
    ), 0)
    - COALESCE((
        SELECT SUM(s.meters_sold)
        FROM market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0) AS meters_in_godown,

    -- Sales P&L
    COALESCE((
        SELECT SUM(s.meters_sold * s.price_per_meter)
        FROM market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0) AS total_revenue,

    COALESCE((
        SELECT SUM(s.meters_sold * s.cost_per_meter)
        FROM market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0) AS total_cost_on_sold,

    COALESCE((
        SELECT SUM(s.meters_sold * (s.price_per_meter - s.cost_per_meter))
        FROM market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0) AS total_profit,

    -- Count of individual sales
    COALESCE((
        SELECT COUNT(*)::int
        FROM market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0) AS sales_count

FROM market_runs mr;

-- ============================================================
-- 9. REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE market_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE market_run_sales;
