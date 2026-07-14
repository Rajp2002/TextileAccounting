-- B12: keep stock source references tenant-scoped and internally consistent.
-- Existing rows are not rewritten; the trigger applies to new source grains and
-- to explicit source-reference changes only, so ordinary quantity updates remain safe.

CREATE OR REPLACE FUNCTION public.validate_fabric_stock_lot_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order_market_run_id UUID;
  v_quote_order_id UUID;
  v_quote_market_run_id UUID;
BEGIN
  IF TG_OP = 'UPDATE'
     AND ROW(NEW.org_id, NEW.source_type, NEW.market_run_id, NEW.order_id, NEW.quote_id)
         IS NOT DISTINCT FROM
         ROW(OLD.org_id, OLD.source_type, OLD.market_run_id, OLD.order_id, OLD.quote_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.source_type = 'market_run' THEN
    IF NEW.market_run_id IS NULL THEN
      RAISE EXCEPTION 'Market run stock requires a market run source';
    END IF;

    PERFORM 1
    FROM public.market_runs
    WHERE id = NEW.market_run_id
      AND org_id = NEW.org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid market run reference for this organization';
    END IF;

    IF NEW.order_id IS NOT NULL THEN
      SELECT market_run_id
      INTO v_order_market_run_id
      FROM public.orders
      WHERE id = NEW.order_id
        AND org_id = NEW.org_id;
      IF NOT FOUND OR v_order_market_run_id IS DISTINCT FROM NEW.market_run_id THEN
        RAISE EXCEPTION 'Market run stock order does not match its market run';
      END IF;
    END IF;

    IF NEW.quote_id IS NOT NULL THEN
      SELECT order_id, market_run_id
      INTO v_quote_order_id, v_quote_market_run_id
      FROM public.estimator_quotes
      WHERE id = NEW.quote_id
        AND org_id = NEW.org_id;
      IF NOT FOUND
         OR v_quote_market_run_id IS DISTINCT FROM NEW.market_run_id
         OR (NEW.order_id IS NOT NULL AND v_quote_order_id IS DISTINCT FROM NEW.order_id) THEN
        RAISE EXCEPTION 'Market run stock quote does not match its source';
      END IF;
    END IF;

  ELSIF NEW.source_type = 'order' THEN
    IF NEW.market_run_id IS NOT NULL THEN
      RAISE EXCEPTION 'Order stock cannot reference a market run';
    END IF;
    IF NEW.order_id IS NULL THEN
      RAISE EXCEPTION 'Order stock requires an order source';
    END IF;

    SELECT market_run_id
    INTO v_order_market_run_id
    FROM public.orders
    WHERE id = NEW.order_id
      AND org_id = NEW.org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid order reference for this organization';
    END IF;
    IF v_order_market_run_id IS NOT NULL THEN
      RAISE EXCEPTION 'Market run backing orders must be recorded as market run stock';
    END IF;

    IF NEW.quote_id IS NOT NULL THEN
      SELECT order_id, market_run_id
      INTO v_quote_order_id, v_quote_market_run_id
      FROM public.estimator_quotes
      WHERE id = NEW.quote_id
        AND org_id = NEW.org_id;
      IF NOT FOUND
         OR v_quote_order_id IS DISTINCT FROM NEW.order_id
         OR v_quote_market_run_id IS NOT NULL THEN
        RAISE EXCEPTION 'Mismatched quote and order';
      END IF;
    END IF;

  ELSE
    IF NEW.market_run_id IS NOT NULL OR NEW.order_id IS NOT NULL OR NEW.quote_id IS NOT NULL THEN
      RAISE EXCEPTION 'Manual or opening stock cannot carry order or market run references';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_fabric_stock_lot_source ON public.fabric_stock_lots;
CREATE TRIGGER trg_validate_fabric_stock_lot_source
BEFORE INSERT OR UPDATE OF org_id, source_type, market_run_id, order_id, quote_id
ON public.fabric_stock_lots
FOR EACH ROW
EXECUTE FUNCTION public.validate_fabric_stock_lot_source();

COMMENT ON FUNCTION public.validate_fabric_stock_lot_source() IS
  'B12 tenant and relationship boundary for fabric stock source references.';
