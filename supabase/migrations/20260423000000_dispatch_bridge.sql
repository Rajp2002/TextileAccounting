-- ============================================================
-- MIGRATION: The Dispatch Bridge — Phase 1
-- Adds tracking tokens to orders, creates dispatches table,
-- helper RPCs, and a public read-only tracking function.
-- ============================================================

-- ============================================================
-- 1. EXTEND ORDERS — Add tracking_token + party_phone
-- ============================================================

-- Step 1: Add nullable first (safe for existing rows)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_token  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS party_phone     TEXT;

-- Step 2: Backfill tokens for all existing orders using SHA-256 slug
-- 12+ chars from base64 of sha256(random + id + now) — non-guessable
UPDATE orders
SET tracking_token = REPLACE(REPLACE(
  LEFT(encode(digest(random()::text || id::text || NOW()::text, 'sha256'), 'base64'), 12),
  '+', 'a'), '/', 'b')
WHERE tracking_token IS NULL;

-- Step 3: Lock down — cannot be null going forward
ALTER TABLE orders
  ALTER COLUMN tracking_token SET NOT NULL,
  ADD CONSTRAINT orders_tracking_token_format
    CHECK (char_length(tracking_token) >= 12);

-- Index for fast token lookups (tracking page hits this on every load)
CREATE INDEX IF NOT EXISTS idx_orders_tracking_token
  ON orders(tracking_token);

-- ============================================================
-- 2. DISPATCHES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS dispatches (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id             UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dispatch_number      INTEGER NOT NULL,          -- sequential per order: 1, 2, 3…
  qty_meters_sent      NUMERIC(10,2) NOT NULL,
  qty_meters_received  NUMERIC(10,2),              -- NULL until trader confirms
  status               TEXT NOT NULL DEFAULT 'in_transit'
                         CHECK (status IN ('in_transit','delivered','disputed')),
  notes                TEXT,
  dispatched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at          TIMESTAMPTZ,                -- set when trader confirms
  created_by           UUID REFERENCES auth.users(id),
  production_log_ids   UUID[] DEFAULT '{}'         -- optional beam/log linkage
);

-- Enforce unique sequence numbers per order (prevents double-dispatch races)
CREATE UNIQUE INDEX IF NOT EXISTS dispatches_order_seq
  ON dispatches(order_id, dispatch_number);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_dispatches_order_id
  ON dispatches(order_id);

CREATE INDEX IF NOT EXISTS idx_dispatches_org_id
  ON dispatches(org_id);

-- ============================================================
-- 3. RLS — DISPATCHES
-- ============================================================

ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;

-- SELECT: All org members can view dispatches for their org
CREATE POLICY "dispatches_org_select"
  ON dispatches FOR SELECT
  USING (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- INSERT: Owner and supervisor can create dispatches
CREATE POLICY "dispatches_org_insert"
  ON dispatches FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- UPDATE: Owner and supervisor can update dispatches
CREATE POLICY "dispatches_org_update"
  ON dispatches FOR UPDATE
  USING (
    (auth.jwt() ->> 'user_role') IN ('owner', 'supervisor') AND
    org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- NOTE: No anon SELECT policy added.
-- The public tracking page uses createAdminClient() (service_role) through
-- get_order_tracking_data RPC — it bypasses RLS entirely.
-- This mirrors the /join Server Action pattern.

-- ============================================================
-- 4. REALTIME — DISPATCHES
-- ============================================================

-- Enables Weaver dashboard to receive live updates when Trader confirms receipt
ALTER PUBLICATION supabase_realtime ADD TABLE dispatches;

-- ============================================================
-- 5. RPC: next_dispatch_number
--    Atomically returns the next dispatch number for an order.
--    Called from the Server Action before INSERT — both wrapped in a transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION next_dispatch_number(p_order_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT COALESCE(MAX(dispatch_number), 0) + 1
  FROM dispatches WHERE order_id = p_order_id;
$$;

-- ============================================================
-- 6. VIEW: order_dispatch_summary
--    Computed on-the-fly — never stored. Consistent with Entry Log philosophy.
-- ============================================================

CREATE OR REPLACE VIEW order_dispatch_summary AS
SELECT
  order_id,
  COUNT(*)                                              AS total_dispatches,
  COALESCE(SUM(qty_meters_sent), 0)                    AS total_sent,
  COALESCE(SUM(qty_meters_received)
    FILTER (WHERE status = 'delivered'), 0)             AS total_received,
  -- Shortage formula: total_sent − total_received for delivered batches
  -- Positive = weaver sent more than trader confirmed (transit loss)
  COALESCE(SUM(qty_meters_sent), 0)
    - COALESCE(SUM(qty_meters_received)
        FILTER (WHERE status = 'delivered'), 0)         AS shortage_meters
FROM dispatches
GROUP BY order_id;

-- ============================================================
-- 7. RPC: get_order_tracking_data (PUBLIC — SECURITY DEFINER)
--    Called by the /track/[token] Server Component via createAdminClient().
--    Returns a safe JSON payload with NO org_id, pricing, or cost data.
--    Returns NULL for unknown tokens — caller maps to notFound().
-- ============================================================

CREATE OR REPLACE FUNCTION get_order_tracking_data(p_token TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Fast existence check first (token index makes this O(1))
  IF NOT EXISTS (SELECT 1 FROM orders WHERE tracking_token = p_token) THEN
    RETURN NULL;  -- Caller maps NULL → notFound() / 404
  END IF;

  SELECT json_build_object(
    -- Intentionally opaque: no order number, no org_id, no internal IDs
    'party_name',          o.party_name,
    'total_target_meters', o.total_target_meters,   -- correct column name
    'status',              o.status,
    -- Production progress (column in production_logs is 'meters', not 'meters_woven')
    'meters_produced', COALESCE((
      SELECT SUM(meters) FROM production_logs WHERE order_id = o.id
    ), 0),
    -- Dispatch list — safe fields only (no notes, org_id, created_by, log_ids)
    'dispatches', COALESCE((
      SELECT json_agg(json_build_object(
        'id',                  d.id,
        'dispatch_number',     d.dispatch_number,
        'qty_meters_sent',     d.qty_meters_sent,
        'qty_meters_received', d.qty_meters_received,
        'status',              d.status,
        'dispatched_at',       d.dispatched_at,
        'received_at',         d.received_at
        -- Intentionally omitted: org_id, created_by, notes, production_log_ids
      ) ORDER BY d.dispatch_number)
      FROM dispatches d WHERE d.order_id = o.id
    ), '[]'::json)
  ) INTO v_result
  FROM orders o
  WHERE o.tracking_token = p_token;

  RETURN v_result;
END;
$$;
