-- ============================================================
-- Fix Quote-to-Order Ambiguity: Qualify estimator_quotes.order_id
-- ============================================================

CREATE OR REPLACE FUNCTION convert_accepted_quote_to_order(
  p_quote_id UUID,
  p_total_target_meters NUMERIC,
  p_deadline DATE,
  p_notes TEXT DEFAULT '',
  p_tracking_token TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, order_id UUID, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_role TEXT;
  v_quote estimator_quotes%ROWTYPE;
  v_order_id UUID;
  v_updated_count INT;
BEGIN
  v_org_id := NULLIF(auth.jwt() ->> 'org_id', '')::uuid;
  v_role := auth.jwt() ->> 'user_role';

  IF v_role <> 'owner' OR v_org_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, 'Permission denied';
    RETURN;
  END IF;

  IF p_total_target_meters IS NULL OR p_total_target_meters <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, 'Order quantity must be greater than 0.';
    RETURN;
  END IF;

  SELECT *
  INTO v_quote
  FROM estimator_quotes
  WHERE id = p_quote_id
    AND org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, 'Quote not found.';
    RETURN;
  END IF;

  IF v_quote.status IS DISTINCT FROM 'accepted' THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, 'Only accepted quotes can be converted into orders.';
    RETURN;
  END IF;

  IF v_quote.order_id IS NOT NULL
     OR EXISTS (
       SELECT 1
       FROM orders o
       WHERE o.quote_id = p_quote_id
         AND o.org_id = v_org_id
     ) THEN
    RETURN QUERY SELECT FALSE, COALESCE(v_quote.order_id, (
      SELECT o.id FROM orders o WHERE o.quote_id = p_quote_id AND o.org_id = v_org_id LIMIT 1
    )), 'This quote has already been converted into an order.';
    RETURN;
  END IF;

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
    v_quote.id,
    v_quote.party_name,
    v_quote.quality_label,
    COALESCE(v_quote.warp_instruction, ''),
    COALESCE(v_quote.weft_instruction, ''),
    p_total_target_meters,
    CURRENT_DATE,
    p_deadline,
    'active',
    v_quote.worker_rate_per_m,
    COALESCE(BTRIM(p_notes), ''),
    p_tracking_token
  )
  RETURNING id INTO v_order_id;

  UPDATE estimator_quotes
  SET order_id = v_order_id
  WHERE id = v_quote.id
    AND org_id = v_org_id
    AND estimator_quotes.order_id IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'This quote has already been converted into an order.';
  END IF;

  RETURN QUERY SELECT TRUE, v_order_id, NULL::text;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, 'This quote has already been converted into an order.';
END;
$$;

GRANT EXECUTE ON FUNCTION convert_accepted_quote_to_order(UUID, NUMERIC, DATE, TEXT, TEXT)
  TO authenticated;
