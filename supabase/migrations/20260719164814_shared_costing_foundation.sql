-- Shared costing foundation: preserve the business meaning of every estimator
-- snapshot independently from the organization's current subscription tier.
-- This makes Base -> Full Suite upgrades additive: standalone costings remain
-- costings while Full Suite can create quotations and market-run snapshots.

ALTER TABLE public.estimator_quotes
  ADD COLUMN IF NOT EXISTS record_kind text;

UPDATE public.estimator_quotes AS quote
SET record_kind = CASE
  WHEN quote.market_run_id IS NOT NULL THEN 'market_run'
  WHEN EXISTS (
    SELECT 1
    FROM public.org_subscriptions AS subscription
    WHERE subscription.org_id = quote.org_id
      AND subscription.status IN ('active', 'authenticated')
      AND subscription.plan_tier = 'base'
      AND (subscription.current_start IS NULL OR subscription.current_start <= now())
      AND (
        subscription.current_end IS NULL
        OR subscription.current_end + interval '24 hours' >= now()
      )
  ) THEN 'costing'
  ELSE 'quotation'
END
WHERE quote.record_kind IS NULL;

ALTER TABLE public.estimator_quotes
  ALTER COLUMN record_kind SET DEFAULT 'quotation',
  ALTER COLUMN record_kind SET NOT NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.estimator_quotes'::regclass
      AND conname = 'estimator_quotes_record_kind_check'
  ) THEN
    ALTER TABLE public.estimator_quotes
      ADD CONSTRAINT estimator_quotes_record_kind_check
      CHECK (record_kind IN ('costing', 'quotation', 'market_run'));
  END IF;
END;
$constraints$;

CREATE INDEX IF NOT EXISTS estimator_quotes_org_kind_updated_idx
  ON public.estimator_quotes(org_id, record_kind, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS estimator_quotes_group_version_unique
  ON public.estimator_quotes(org_id, costing_group_id, version_number);

COMMENT ON COLUMN public.estimator_quotes.record_kind IS
  'Durable estimator context. It is not recomputed when an organization changes subscription tier.';

-- Keep the database conversion boundary aligned with the application: a Base
-- costing can be used to prepare a quotation after upgrade, but it is never
-- itself convertible into a production order.
CREATE OR REPLACE FUNCTION public.convert_accepted_quote_to_order(
  p_quote_id uuid,
  p_total_target_meters numeric,
  p_deadline date,
  p_notes text DEFAULT '',
  p_tracking_token text DEFAULT NULL
)
RETURNS TABLE(success boolean, order_id uuid, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org_id uuid;
  v_role text;
  v_quote public.estimator_quotes%ROWTYPE;
  v_order_id uuid;
  v_updated_count integer;
BEGIN
  v_org_id := NULLIF(auth.jwt() ->> 'org_id', '')::uuid;
  v_role := auth.jwt() ->> 'user_role';

  IF v_role <> 'owner' OR v_org_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Permission denied';
    RETURN;
  END IF;

  IF NOT public.org_has_subscription_tier(v_org_id, 'premium') THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Weavly Full Suite subscription required';
    RETURN;
  END IF;

  IF p_total_target_meters IS NULL OR p_total_target_meters <= 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Order quantity must be greater than 0.';
    RETURN;
  END IF;

  SELECT *
  INTO v_quote
  FROM public.estimator_quotes
  WHERE id = p_quote_id
    AND org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Quote not found.';
    RETURN;
  END IF;

  IF v_quote.record_kind IS DISTINCT FROM 'quotation' THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Only customer quotations can be converted into orders.';
    RETURN;
  END IF;

  IF v_quote.status IS DISTINCT FROM 'accepted' THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Only accepted quotes can be converted into orders.';
    RETURN;
  END IF;

  IF v_quote.order_id IS NOT NULL
     OR EXISTS (
       SELECT 1
       FROM public.orders AS existing_order
       WHERE existing_order.quote_id = p_quote_id
         AND existing_order.org_id = v_org_id
     ) THEN
    RETURN QUERY SELECT false, COALESCE(v_quote.order_id, (
      SELECT existing_order.id
      FROM public.orders AS existing_order
      WHERE existing_order.quote_id = p_quote_id
        AND existing_order.org_id = v_org_id
      LIMIT 1
    )), 'This quote has already been converted into an order.';
    RETURN;
  END IF;

  INSERT INTO public.orders (
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

  UPDATE public.estimator_quotes
  SET order_id = v_order_id
  WHERE id = v_quote.id
    AND org_id = v_org_id
    AND estimator_quotes.order_id IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'This quote has already been converted into an order.';
  END IF;

  RETURN QUERY SELECT true, v_order_id, NULL::text;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT false, NULL::uuid, 'This quote has already been converted into an order.';
END;
$$;

REVOKE ALL ON FUNCTION public.convert_accepted_quote_to_order(uuid, numeric, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_accepted_quote_to_order(uuid, numeric, date, text, text)
  TO authenticated;
