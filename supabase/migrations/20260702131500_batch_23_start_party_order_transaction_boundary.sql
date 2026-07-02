-- ============================================================
-- Batch 23: Start Party Order transaction boundary.
--
-- QUOTE-007: "Accepted quote and order form one consistent
--            transaction."
--
-- The Start Party Order fast path previously inserted an accepted
-- estimator_quote via Supabase client, then separately called
-- convert_accepted_quote_to_order RPC.  If conversion failed, the
-- accepted quote was intentionally left behind (recoverable from
-- Quote History), but the two artifacts were NOT guaranteed to be
-- created atomically together.
--
-- This migration creates a new RPC that performs the entire
-- Start Party Order flow inside a single database transaction:
--   1. Insert accepted estimator_quote
--   2. Insert active order linked to that quote
--   3. Backlink the quote to the order
--   4. Insert order_yarn_requirements
--
-- If any step fails, PostgreSQL rolls back the entire transaction
-- and no orphaned accepted quote, partial order, or partial yarn
-- requirements row is left behind.
--
-- Auth/tenant pattern: reuses the established convention from
-- convert_accepted_quote_to_order — reads org_id and user_role
-- from auth.jwt(), enforces owner role, and scopes all writes
-- to the caller's organization.
--
-- Forward-only: no DROP, no TRUNCATE, no DELETE of business data.
-- The existing convert_accepted_quote_to_order RPC is not modified
-- and continues to serve the Quote History conversion path.
-- ============================================================

CREATE OR REPLACE FUNCTION start_party_order_from_estimator(
  -- Quote fields
  p_party_name            TEXT,
  p_quality_label         TEXT,
  p_warp_instruction      TEXT          DEFAULT NULL,
  p_weft_instruction      TEXT          DEFAULT NULL,
  p_warp_rows             JSONB         DEFAULT '[]'::jsonb,
  p_weft_rows             JSONB         DEFAULT '[]'::jsonb,
  p_per_pick_cost_paise   NUMERIC       DEFAULT 0,
  p_tape_length_m         NUMERIC       DEFAULT 1000,
  p_warp_crimp_pct        NUMERIC       DEFAULT 0,
  p_warping_rate_per_kg   NUMERIC       DEFAULT 0,
  p_sizing_rate_per_kg    NUMERIC       DEFAULT 0,
  p_winding_rate_per_kg   NUMERIC       DEFAULT 0,
  p_processing_rate_per_m NUMERIC       DEFAULT 0,
  p_finishing_rate_per_m  NUMERIC       DEFAULT 0,
  p_overhead_items        JSONB         DEFAULT '[]'::jsonb,
  p_monthly_output_m      NUMERIC       DEFAULT 10000,
  p_overhead_override_per_m NUMERIC     DEFAULT NULL,
  p_overhead_pct          NUMERIC       DEFAULT 0,
  p_commission_pct        NUMERIC       DEFAULT 0,
  p_transport_per_m       NUMERIC       DEFAULT 0,
  p_order_quantity_m      NUMERIC       DEFAULT 0,
  p_profit_margin_pct     NUMERIC       DEFAULT 0,
  p_enabled_sections      JSONB         DEFAULT NULL,
  p_loom_type             TEXT          DEFAULT NULL,
  p_estimator_rpm         NUMERIC       DEFAULT NULL,
  p_estimator_power_kw    NUMERIC       DEFAULT NULL,
  p_hours_per_shift       NUMERIC       DEFAULT 8,
  p_sizing_mode           TEXT          DEFAULT NULL,
  p_landed_cost_per_meter NUMERIC       DEFAULT 0,
  p_quote_price_per_meter NUMERIC       DEFAULT 0,
  p_intended_margin_pct   NUMERIC       DEFAULT 0,
  p_worker_rate_per_m     NUMERIC       DEFAULT 0,
  p_ppi                   INTEGER       DEFAULT 68,
  p_yarn_denier           INTEGER       DEFAULT 75,
  p_yarn_rate_per_kg      NUMERIC       DEFAULT 0,
  -- Order fields
  p_target_meters         NUMERIC,
  p_deadline              DATE,
  p_notes                 TEXT          DEFAULT '',
  p_tracking_token        TEXT          DEFAULT NULL,
  -- Yarn requirement fields (pre-computed by the server action)
  p_warp_required_kg      NUMERIC       DEFAULT 0,
  p_weft_required_kg      NUMERIC       DEFAULT 0,
  p_total_required_kg     NUMERIC       DEFAULT 0,
  p_estimated_beams       INTEGER       DEFAULT NULL,
  p_requirement_snapshot  JSONB         DEFAULT '{}'::jsonb
)
RETURNS TABLE(success BOOLEAN, quote_id UUID, order_id UUID, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id       UUID;
  v_role         TEXT;
  v_quote_id     UUID;
  v_order_id     UUID;
BEGIN
  -- ── Auth / tenant boundary (same pattern as convert_accepted_quote_to_order) ──
  v_org_id := NULLIF(auth.jwt() ->> 'org_id', '')::uuid;
  v_role   := auth.jwt() ->> 'user_role';

  IF v_role <> 'owner' OR v_org_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, NULL::uuid, 'Permission denied'::text;
    RETURN;
  END IF;

  -- ── Locked-org guard (matches convention from harden_locked_tenant_writes) ──
  PERFORM public.assert_org_not_locked(v_org_id);

  -- ── Input validation ──
  IF BTRIM(COALESCE(p_party_name, '')) = '' THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, NULL::uuid, 'Add a party name before starting an order.'::text;
    RETURN;
  END IF;

  IF BTRIM(COALESCE(p_quality_label, '')) = '' THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, NULL::uuid, 'Add a quality label before starting an order.'::text;
    RETURN;
  END IF;

  IF p_target_meters IS NULL OR p_target_meters <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, NULL::uuid, 'Target meters must be greater than zero.'::text;
    RETURN;
  END IF;

  IF p_quote_price_per_meter IS NULL OR p_quote_price_per_meter <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, NULL::uuid, 'Quote price is missing. Complete the estimate first.'::text;
    RETURN;
  END IF;

  -- ── Step 1: Insert accepted estimator_quote ──
  INSERT INTO estimator_quotes (
    org_id,
    party_name,
    quality_label,
    warp_instruction,
    weft_instruction,
    warp_rows,
    weft_rows,
    per_pick_cost_paise,
    tape_length_m,
    warp_crimp_pct,
    warping_rate_per_kg,
    sizing_rate_per_kg,
    winding_rate_per_kg,
    processing_rate_per_m,
    finishing_rate_per_m,
    overhead_items,
    monthly_output_m,
    overhead_override_per_m,
    overhead_pct,
    commission_pct,
    transport_per_m,
    order_quantity_m,
    profit_margin_pct,
    enabled_sections,
    loom_type,
    estimator_rpm,
    estimator_power_kw,
    hours_per_shift,
    sizing_mode,
    landed_cost_per_meter,
    quote_price_per_meter,
    intended_margin_percent,
    meters,
    status,
    worker_rate_per_m,
    ppi,
    yarn_denier,
    yarn_rate_per_kg
  )
  VALUES (
    v_org_id,
    BTRIM(p_party_name),
    BTRIM(p_quality_label),
    BTRIM(COALESCE(p_warp_instruction, '')),
    BTRIM(COALESCE(p_weft_instruction, '')),
    p_warp_rows,
    p_weft_rows,
    p_per_pick_cost_paise,
    p_tape_length_m,
    p_warp_crimp_pct,
    p_warping_rate_per_kg,
    p_sizing_rate_per_kg,
    p_winding_rate_per_kg,
    p_processing_rate_per_m,
    p_finishing_rate_per_m,
    p_overhead_items,
    p_monthly_output_m,
    p_overhead_override_per_m,
    p_overhead_pct,
    p_commission_pct,
    p_transport_per_m,
    p_order_quantity_m,
    p_profit_margin_pct,
    p_enabled_sections,
    p_loom_type,
    p_estimator_rpm,
    p_estimator_power_kw,
    p_hours_per_shift,
    p_sizing_mode,
    p_landed_cost_per_meter,
    p_quote_price_per_meter,
    p_intended_margin_pct,
    p_target_meters,
    'accepted',
    p_worker_rate_per_m,
    p_ppi,
    p_yarn_denier,
    p_yarn_rate_per_kg
  )
  RETURNING id INTO v_quote_id;

  -- ── Step 2: Insert active order (same columns as convert_accepted_quote_to_order) ──
  INSERT INTO orders (
    org_id,
    quote_id,
    party_name,
    quality_label,
    warp_instruction,
    weft_instruction,
    total_target_meters,
    start_date,
    deadline,
    status,
    worker_rate_per_m,
    notes,
    tracking_token
  )
  VALUES (
    v_org_id,
    v_quote_id,
    BTRIM(p_party_name),
    BTRIM(p_quality_label),
    COALESCE(BTRIM(p_warp_instruction), ''),
    COALESCE(BTRIM(p_weft_instruction), ''),
    p_target_meters,
    CURRENT_DATE,
    p_deadline,
    'active',
    p_worker_rate_per_m,
    COALESCE(BTRIM(p_notes), ''),
    p_tracking_token
  )
  RETURNING id INTO v_order_id;

  -- ── Step 3: Backlink quote to order ──
  UPDATE estimator_quotes
  SET order_id = v_order_id
  WHERE id = v_quote_id
    AND org_id = v_org_id;

  -- ── Step 4: Insert order_yarn_requirements ──
  INSERT INTO order_yarn_requirements (
    org_id,
    order_id,
    quote_id,
    warp_required_kg,
    weft_required_kg,
    total_required_kg,
    estimated_beams,
    requirement_snapshot
  )
  VALUES (
    v_org_id,
    v_order_id,
    v_quote_id,
    p_warp_required_kg,
    p_weft_required_kg,
    p_total_required_kg,
    p_estimated_beams,
    p_requirement_snapshot
  );

  -- ── All writes succeeded — return as one atomic result ──
  RETURN QUERY SELECT TRUE, v_quote_id, v_order_id, NULL::text;

EXCEPTION
  WHEN unique_violation THEN
    -- Handles concurrent duplicate conversion or constraint conflicts
    RETURN QUERY SELECT FALSE, NULL::uuid, NULL::uuid,
      'This order has already been created. Check your orders list.'::text;
END;
$$;

-- Grant to authenticated users (same as convert_accepted_quote_to_order)
GRANT EXECUTE ON FUNCTION start_party_order_from_estimator(
  TEXT, TEXT, TEXT, TEXT,
  JSONB, JSONB, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, JSONB, TEXT, NUMERIC, NUMERIC,
  NUMERIC, TEXT,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  INTEGER, INTEGER, NUMERIC,
  NUMERIC, DATE, TEXT, TEXT,
  NUMERIC, NUMERIC, NUMERIC, INTEGER, JSONB
)
TO authenticated;

COMMENT ON FUNCTION start_party_order_from_estimator IS
  'Batch 23 QUOTE-007: Atomic Start Party Order fast path. Creates the accepted '
  'estimator_quote, active order, quote/order backlinks, and order_yarn_requirements '
  'in a single database transaction. If any step fails, all writes are rolled back '
  'and no orphaned accepted quote is left behind.';
