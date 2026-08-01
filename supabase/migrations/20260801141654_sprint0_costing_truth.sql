-- Sprint 0: canonical costing truth, historical transparency, and tenant-safe
-- reconciliation.
--
-- New estimator rows persist the complete financial result that the owner saw.
-- Existing rows are deliberately not rewritten: they are marked legacy until
-- the read-only audit can prove that their inputs and formulas are complete.

ALTER TABLE public.estimator_quotes
  ADD COLUMN IF NOT EXISTS calculation_version text,
  ADD COLUMN IF NOT EXISTS rounding_policy text,
  ADD COLUMN IF NOT EXISTS production_cost_per_meter numeric(14,2),
  ADD COLUMN IF NOT EXISTS overhead_per_meter numeric(14,2),
  ADD COLUMN IF NOT EXISTS commission_cost_per_meter numeric(14,2),
  ADD COLUMN IF NOT EXISTS break_even_price_per_meter numeric(14,2),
  ADD COLUMN IF NOT EXISTS expected_profit_per_meter numeric(14,2),
  ADD COLUMN IF NOT EXISTS expected_profit_total numeric(16,2),
  ADD COLUMN IF NOT EXISTS actual_margin_percent numeric(10,4),
  ADD COLUMN IF NOT EXISTS costing_result_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS reconciliation_status text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS reconciliation_note text,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

-- Rows created before this migration have no trustworthy versioned result.
-- Preserve their saved prices and recipes, but make that limitation explicit.
UPDATE public.estimator_quotes
SET reconciliation_status = CASE
  WHEN calculation_version IS NULL
    OR rounding_policy IS NULL
    OR costing_result_snapshot IS NULL
    OR reconciliation_status IS NULL
    THEN 'legacy'
  ELSE reconciliation_status
END
WHERE calculation_version IS NULL
   OR rounding_policy IS NULL
   OR costing_result_snapshot IS NULL
   OR reconciliation_status IS NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.estimator_quotes'::regclass
      AND conname = 'estimator_quotes_reconciliation_status_check'
  ) THEN
    ALTER TABLE public.estimator_quotes
      ADD CONSTRAINT estimator_quotes_reconciliation_status_check
      CHECK (reconciliation_status IN ('verified', 'legacy', 'needs_review', 'unreconstructable', 'unreviewed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.estimator_quotes'::regclass
      AND conname = 'estimator_quotes_costing_snapshot_object_check'
  ) THEN
    ALTER TABLE public.estimator_quotes
      ADD CONSTRAINT estimator_quotes_costing_snapshot_object_check
      CHECK (costing_result_snapshot IS NULL OR jsonb_typeof(costing_result_snapshot) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.estimator_quotes'::regclass
      AND conname = 'estimator_quotes_costing_values_finite_check'
  ) THEN
    ALTER TABLE public.estimator_quotes
      ADD CONSTRAINT estimator_quotes_costing_values_finite_check
      CHECK (
        (production_cost_per_meter IS NULL OR (production_cost_per_meter >= 0 AND production_cost_per_meter NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)))
        AND (overhead_per_meter IS NULL OR (overhead_per_meter >= 0 AND overhead_per_meter NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)))
        AND (commission_cost_per_meter IS NULL OR (commission_cost_per_meter >= 0 AND commission_cost_per_meter NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)))
        AND (break_even_price_per_meter IS NULL OR (break_even_price_per_meter >= 0 AND break_even_price_per_meter NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)))
        AND (expected_profit_per_meter IS NULL OR expected_profit_per_meter NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric))
        AND (expected_profit_total IS NULL OR expected_profit_total NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric))
        AND (actual_margin_percent IS NULL OR actual_margin_percent NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric))
      );
  END IF;
END;
$constraints$;

ALTER TABLE public.estimator_quotes
  ALTER COLUMN reconciliation_status SET DEFAULT 'legacy',
  ALTER COLUMN reconciliation_status SET NOT NULL;

CREATE INDEX IF NOT EXISTS estimator_quotes_org_reconciliation_status_idx
  ON public.estimator_quotes(org_id, reconciliation_status, created_at DESC);

COMMENT ON COLUMN public.estimator_quotes.calculation_version IS
  'Estimator formula version used to produce the saved financial result.';

COMMENT ON COLUMN public.estimator_quotes.rounding_policy IS
  'Currency rounding policy used at the persistence and display boundary.';

COMMENT ON COLUMN public.estimator_quotes.costing_result_snapshot IS
  'Immutable, complete canonical costing result used by estimator, comparison, PDFs, and downstream commercial reporting.';

COMMENT ON COLUMN public.estimator_quotes.reconciliation_status IS
  'Trust state for this financial snapshot. Legacy rows are preserved until an audit proves they are reconstructable.';

COMMENT ON COLUMN public.estimator_quotes.reconciliation_note IS
  'Human-readable explanation when a historical snapshot cannot be fully reconciled.';

-- The estimator stores landed cost as production + transport + commission at
-- the selected quote price. Earlier commercial views added those components a
-- second time. New verified rows use the explicit production snapshot; legacy
-- rows use their stored landed value without inventing missing economics.
CREATE OR REPLACE VIEW public.commercial_profit_entries
WITH (security_invoker = true)
AS
SELECT
  s.id AS source_id,
  s.org_id,
  s.party_id,
  COALESCE(p.name, NULLIF(s.party_name, ''), 'Named Stock Sale') AS party_name,
  'stock_sale'::TEXT AS source_kind,
  COALESCE(NULLIF(s.party_name, ''), p.name, 'Named Stock Sale') AS source_label,
  'realized'::TEXT AS stage,
  s.sale_date AS event_date,
  l.quality_label,
  (s.meters_sold::TEXT || ' m') AS quantity_label,
  s.taka_sold AS taka_count,
  s.meters_sold,
  s.price_per_meter,
  s.cost_per_meter,
  s.revenue_amount,
  s.cost_amount,
  s.gross_profit_amount,
  l.godown AS reference,
  s.created_at,
  l.source_type AS stock_source_type,
  l.market_run_id AS stock_market_run_id,
  l.order_id AS stock_order_id
FROM public.fabric_stock_sales s
JOIN public.fabric_stock_lots l ON l.id = s.stock_lot_id
LEFT JOIN public.parties p ON p.id = s.party_id

UNION ALL

SELECT
  s.id AS source_id,
  s.org_id,
  s.party_id,
  p.name AS party_name,
  'market_run_sale'::TEXT AS source_kind,
  'Market Run Sale'::TEXT AS source_label,
  'realized'::TEXT AS stage,
  s.sale_date AS event_date,
  COALESCE(mr.quality_label, mr.fabric_label) AS quality_label,
  (s.meters_sold::TEXT || ' m') AS quantity_label,
  NULL::NUMERIC AS taka_count,
  s.meters_sold,
  s.price_per_meter,
  s.cost_per_meter,
  ROUND(s.meters_sold * s.price_per_meter, 2) AS revenue_amount,
  ROUND(s.meters_sold * s.cost_per_meter, 2) AS cost_amount,
  ROUND(s.meters_sold * (s.price_per_meter - s.cost_per_meter), 2) AS gross_profit_amount,
  mr.fabric_label AS reference,
  s.created_at,
  NULL::TEXT AS stock_source_type,
  NULL::UUID AS stock_market_run_id,
  NULL::UUID AS stock_order_id
FROM public.market_run_sales s
JOIN public.market_runs mr ON mr.id = s.market_run_id
LEFT JOIN public.parties p ON p.id = s.party_id

UNION ALL

SELECT
  i.id AS source_id,
  i.org_id,
  COALESCE(i.party_id, o.party_id) AS party_id,
  COALESCE(p.name, o.party_name) AS party_name,
  'order_invoice'::TEXT AS source_kind,
  'Order Sale'::TEXT AS source_label,
  'realized'::TEXT AS stage,
  i.invoice_date AS event_date,
  COALESCE(o.quality_label, q.quality_label, 'Order') AS quality_label,
  (i.total_meters::TEXT || ' m') AS quantity_label,
  NULL::NUMERIC AS taka_count,
  i.total_meters AS meters_sold,
  i.rate_per_m AS price_per_meter,
  CASE
    WHEN q.reconciliation_status = 'verified' AND q.production_cost_per_meter IS NOT NULL THEN
      q.production_cost_per_meter
      + COALESCE(q.transport_per_m, 0)
      + (i.rate_per_m * COALESCE(q.commission_pct, 0) / 100)
    ELSE COALESCE(q.landed_cost_per_meter, 0)
  END AS cost_per_meter,
  ROUND(i.total_meters * i.rate_per_m, 2) AS revenue_amount,
  ROUND(
    i.total_meters * CASE
      WHEN q.reconciliation_status = 'verified' AND q.production_cost_per_meter IS NOT NULL THEN
        q.production_cost_per_meter
        + COALESCE(q.transport_per_m, 0)
        + (i.rate_per_m * COALESCE(q.commission_pct, 0) / 100)
      ELSE COALESCE(q.landed_cost_per_meter, 0)
    END,
    2
  ) AS cost_amount,
  ROUND(
    i.total_meters * (
      i.rate_per_m - CASE
        WHEN q.reconciliation_status = 'verified' AND q.production_cost_per_meter IS NOT NULL THEN
          q.production_cost_per_meter
          + COALESCE(q.transport_per_m, 0)
          + (i.rate_per_m * COALESCE(q.commission_pct, 0) / 100)
        ELSE COALESCE(q.landed_cost_per_meter, 0)
      END
    ),
    2
  ) AS gross_profit_amount,
  COALESCE(i.invoice_number, o.party_name) AS reference,
  i.created_at,
  NULL::TEXT AS stock_source_type,
  NULL::UUID AS stock_market_run_id,
  NULL::UUID AS stock_order_id
FROM public.party_invoices i
JOIN public.orders o ON o.id = i.order_id
LEFT JOIN public.parties p ON p.id = COALESCE(i.party_id, o.party_id)
LEFT JOIN LATERAL (
  SELECT quote.*
  FROM public.estimator_quotes quote
  WHERE quote.order_id = i.order_id
    AND quote.org_id = i.org_id
  ORDER BY quote.created_at DESC
  LIMIT 1
) q ON TRUE
WHERE i.status <> 'cancelled'
  AND i.order_id IS NOT NULL

UNION ALL

SELECT
  q.id AS source_id,
  q.org_id,
  o.party_id,
  COALESCE(p.name, o.party_name, q.party_name) AS party_name,
  'order_quote'::TEXT AS source_kind,
  'Expected Order Profit'::TEXT AS source_label,
  'expected'::TEXT AS stage,
  o.start_date AS event_date,
  COALESCE(o.quality_label, q.quality_label, 'Order') AS quality_label,
  (o.total_target_meters::TEXT || ' m') AS quantity_label,
  NULL::NUMERIC AS taka_count,
  o.total_target_meters AS meters_sold,
  q.quote_price_per_meter AS price_per_meter,
  CASE
    WHEN q.reconciliation_status = 'verified' AND q.production_cost_per_meter IS NOT NULL THEN
      q.production_cost_per_meter
      + COALESCE(q.transport_per_m, 0)
      + (q.quote_price_per_meter * COALESCE(q.commission_pct, 0) / 100)
    ELSE COALESCE(q.landed_cost_per_meter, 0)
  END AS cost_per_meter,
  ROUND(o.total_target_meters * q.quote_price_per_meter, 2) AS revenue_amount,
  ROUND(
    o.total_target_meters * CASE
      WHEN q.reconciliation_status = 'verified' AND q.production_cost_per_meter IS NOT NULL THEN
        q.production_cost_per_meter
        + COALESCE(q.transport_per_m, 0)
        + (q.quote_price_per_meter * COALESCE(q.commission_pct, 0) / 100)
      ELSE COALESCE(q.landed_cost_per_meter, 0)
    END,
    2
  ) AS cost_amount,
  ROUND(
    o.total_target_meters * (
      q.quote_price_per_meter - CASE
        WHEN q.reconciliation_status = 'verified' AND q.production_cost_per_meter IS NOT NULL THEN
          q.production_cost_per_meter
          + COALESCE(q.transport_per_m, 0)
          + (q.quote_price_per_meter * COALESCE(q.commission_pct, 0) / 100)
        ELSE COALESCE(q.landed_cost_per_meter, 0)
      END
    ),
    2
  ) AS gross_profit_amount,
  COALESCE(o.party_name, q.party_name) AS reference,
  q.created_at,
  NULL::TEXT AS stock_source_type,
  NULL::UUID AS stock_market_run_id,
  NULL::UUID AS stock_order_id
FROM public.estimator_quotes q
JOIN public.orders o ON o.id = q.order_id
LEFT JOIN public.parties p ON p.id = o.party_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.party_invoices i
  WHERE i.order_id = o.id
    AND i.org_id = q.org_id
    AND i.status <> 'cancelled'
);

GRANT SELECT ON public.commercial_profit_entries TO authenticated;

-- The existing Start Party Order RPC remains the transaction boundary for the
-- quote, order, and yarn requirement rows. This wrapper adds the same
-- canonical result persisted by the normal estimator save path and raises on
-- any snapshot problem, so the underlying transaction is rolled back rather
-- than leaving an accepted order with an unverified costing.
CREATE OR REPLACE FUNCTION public.start_party_order_from_estimator_v2(
  p_party_name              text,
  p_quality_label           text,
  p_warp_instruction         text DEFAULT NULL,
  p_weft_instruction         text DEFAULT NULL,
  p_warp_rows                jsonb DEFAULT '[]'::jsonb,
  p_weft_rows                jsonb DEFAULT '[]'::jsonb,
  p_per_pick_cost_paise      numeric DEFAULT 0,
  p_tape_length_m            numeric DEFAULT 1000,
  p_warp_crimp_pct           numeric DEFAULT 0,
  p_warping_rate_per_kg      numeric DEFAULT 0,
  p_sizing_rate_per_kg       numeric DEFAULT 0,
  p_winding_rate_per_kg      numeric DEFAULT 0,
  p_processing_rate_per_m    numeric DEFAULT 0,
  p_finishing_rate_per_m     numeric DEFAULT 0,
  p_overhead_items           jsonb DEFAULT '[]'::jsonb,
  p_monthly_output_m         numeric DEFAULT 10000,
  p_overhead_override_per_m  numeric DEFAULT NULL,
  p_overhead_pct             numeric DEFAULT 0,
  p_commission_pct            numeric DEFAULT 0,
  p_transport_per_m          numeric DEFAULT 0,
  p_order_quantity_m         numeric DEFAULT 0,
  p_profit_margin_pct        numeric DEFAULT 0,
  p_enabled_sections         jsonb DEFAULT NULL,
  p_loom_type                text DEFAULT NULL,
  p_estimator_rpm            numeric DEFAULT NULL,
  p_estimator_power_kw       numeric DEFAULT NULL,
  p_hours_per_shift          numeric DEFAULT 8,
  p_sizing_mode              text DEFAULT NULL,
  p_landed_cost_per_meter    numeric DEFAULT 0,
  p_quote_price_per_meter    numeric DEFAULT 0,
  p_intended_margin_pct      numeric DEFAULT 0,
  p_worker_rate_per_m        numeric DEFAULT 0,
  p_ppi                      integer DEFAULT 68,
  p_yarn_denier              integer DEFAULT 75,
  p_yarn_rate_per_kg         numeric DEFAULT 0,
  p_target_meters            numeric DEFAULT NULL,
  p_deadline                 date DEFAULT NULL,
  p_notes                    text DEFAULT '',
  p_tracking_token           text DEFAULT NULL,
  p_warp_required_kg         numeric DEFAULT 0,
  p_weft_required_kg         numeric DEFAULT 0,
  p_total_required_kg        numeric DEFAULT 0,
  p_estimated_beams          integer DEFAULT NULL,
  p_requirement_snapshot     jsonb DEFAULT '{}'::jsonb,
  p_costing_result_snapshot  jsonb DEFAULT NULL
)
RETURNS TABLE(success boolean, quote_id uuid, order_id uuid, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result record;
  v_quote_id uuid;
  v_org_id uuid := NULLIF(auth.jwt() ->> 'org_id', '')::uuid;
BEGIN
  IF p_costing_result_snapshot IS NULL
     OR jsonb_typeof(p_costing_result_snapshot) <> 'object'
     OR NOT (p_costing_result_snapshot ?& ARRAY[
       'calculationVersion',
       'roundingPolicy',
       'productionCostPerM',
       'overheadPerM',
       'transportPerM',
       'commissionPct',
       'commissionPerM',
       'landedCostPerM',
       'breakEvenPricePerM',
       'suggestedSellingPricePerM',
       'targetMarginPct',
       'actualMarginPct',
       'profitPerM',
       'totalOrderValue',
       'totalLandedCost',
       'expectedProfitTotal',
       'breakdown'
     ]) THEN
    RAISE EXCEPTION 'The costing result snapshot is incomplete. Refresh the estimator and try again.';
  END IF;

  SELECT *
  INTO v_result
  FROM public.start_party_order_from_estimator(
    p_party_name => p_party_name,
    p_quality_label => p_quality_label,
    p_warp_instruction => p_warp_instruction,
    p_weft_instruction => p_weft_instruction,
    p_warp_rows => p_warp_rows,
    p_weft_rows => p_weft_rows,
    p_per_pick_cost_paise => p_per_pick_cost_paise,
    p_tape_length_m => p_tape_length_m,
    p_warp_crimp_pct => p_warp_crimp_pct,
    p_warping_rate_per_kg => p_warping_rate_per_kg,
    p_sizing_rate_per_kg => p_sizing_rate_per_kg,
    p_winding_rate_per_kg => p_winding_rate_per_kg,
    p_processing_rate_per_m => p_processing_rate_per_m,
    p_finishing_rate_per_m => p_finishing_rate_per_m,
    p_overhead_items => p_overhead_items,
    p_monthly_output_m => p_monthly_output_m,
    p_overhead_override_per_m => p_overhead_override_per_m,
    p_overhead_pct => p_overhead_pct,
    p_commission_pct => p_commission_pct,
    p_transport_per_m => p_transport_per_m,
    p_order_quantity_m => p_order_quantity_m,
    p_profit_margin_pct => p_profit_margin_pct,
    p_enabled_sections => p_enabled_sections,
    p_loom_type => p_loom_type,
    p_estimator_rpm => p_estimator_rpm,
    p_estimator_power_kw => p_estimator_power_kw,
    p_hours_per_shift => p_hours_per_shift,
    p_sizing_mode => p_sizing_mode,
    p_landed_cost_per_meter => p_landed_cost_per_meter,
    p_quote_price_per_meter => p_quote_price_per_meter,
    p_intended_margin_pct => p_intended_margin_pct,
    p_worker_rate_per_m => p_worker_rate_per_m,
    p_ppi => p_ppi,
    p_yarn_denier => p_yarn_denier,
    p_yarn_rate_per_kg => p_yarn_rate_per_kg,
    p_target_meters => p_target_meters,
    p_deadline => p_deadline,
    p_notes => p_notes,
    p_tracking_token => p_tracking_token,
    p_warp_required_kg => p_warp_required_kg,
    p_weft_required_kg => p_weft_required_kg,
    p_total_required_kg => p_total_required_kg,
    p_estimated_beams => p_estimated_beams,
    p_requirement_snapshot => p_requirement_snapshot
  );

  IF NOT COALESCE(v_result.success, false) THEN
    RETURN QUERY SELECT v_result.success, v_result.quote_id, v_result.order_id, v_result.error;
    RETURN;
  END IF;

  v_quote_id := v_result.quote_id;

  UPDATE public.estimator_quotes
  SET calculation_version = p_costing_result_snapshot ->> 'calculationVersion',
      rounding_policy = p_costing_result_snapshot ->> 'roundingPolicy',
      production_cost_per_meter = (p_costing_result_snapshot ->> 'productionCostPerM')::numeric,
      overhead_per_meter = (p_costing_result_snapshot ->> 'overheadPerM')::numeric,
      commission_cost_per_meter = (p_costing_result_snapshot ->> 'commissionPerM')::numeric,
      break_even_price_per_meter = (p_costing_result_snapshot ->> 'breakEvenPricePerM')::numeric,
      expected_profit_per_meter = (p_costing_result_snapshot ->> 'profitPerM')::numeric,
      expected_profit_total = (p_costing_result_snapshot ->> 'expectedProfitTotal')::numeric,
      actual_margin_percent = (p_costing_result_snapshot ->> 'actualMarginPct')::numeric,
      costing_result_snapshot = p_costing_result_snapshot,
      reconciliation_status = 'verified',
      reconciliation_note = NULL,
      reconciled_at = now()
  WHERE id = v_quote_id
    AND org_id = v_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The accepted order was created without a costing snapshot.';
  END IF;

  RETURN QUERY SELECT TRUE, v_result.quote_id, v_result.order_id, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.start_party_order_from_estimator_v2(
  text, text, text, text, jsonb, jsonb, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, jsonb, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, jsonb, text, numeric, numeric,
  numeric, text, numeric, numeric, numeric, numeric, integer, integer, numeric,
  numeric, date, text, text, numeric, numeric, numeric, integer, jsonb, jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.start_party_order_from_estimator_v2(
  text, text, text, text, jsonb, jsonb, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, jsonb, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, jsonb, text, numeric, numeric,
  numeric, text, numeric, numeric, numeric, numeric, integer, integer, numeric,
  numeric, date, text, text, numeric, numeric, numeric, integer, jsonb, jsonb
) TO authenticated, service_role;

COMMENT ON FUNCTION public.start_party_order_from_estimator_v2 IS
  'Atomic Start Party Order wrapper that persists the canonical Sprint 0 costing result before committing.';
