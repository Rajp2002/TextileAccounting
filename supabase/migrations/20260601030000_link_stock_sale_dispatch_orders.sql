ALTER TABLE dispatch_package_lines
  ALTER COLUMN order_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION populate_dispatch_order_from_stock_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  IF NEW.order_id IS NULL AND NEW.stock_sale_id IS NOT NULL THEN
    SELECT l.order_id
      INTO v_order_id
    FROM fabric_stock_sales s
    JOIN fabric_stock_lots l ON l.id = s.stock_lot_id
    WHERE s.id = NEW.stock_sale_id
      AND s.org_id = NEW.org_id;

    IF v_order_id IS NOT NULL THEN
      NEW.order_id := v_order_id;
      NEW.dispatch_number := next_dispatch_number(v_order_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_dispatch_order_from_stock_sale ON dispatches;
CREATE TRIGGER trg_populate_dispatch_order_from_stock_sale
  BEFORE INSERT OR UPDATE OF order_id, stock_sale_id
  ON dispatches
  FOR EACH ROW
  EXECUTE FUNCTION populate_dispatch_order_from_stock_sale();

WITH linked_stock_dispatches AS (
  SELECT
    d.id AS dispatch_id,
    l.order_id
  FROM dispatches d
  JOIN fabric_stock_sales s ON s.id = d.stock_sale_id
  JOIN fabric_stock_lots l ON l.id = s.stock_lot_id
  WHERE d.order_id IS NULL
    AND l.order_id IS NOT NULL
)
UPDATE dispatches d
SET order_id = linked.order_id
FROM linked_stock_dispatches linked
WHERE d.id = linked.dispatch_id;

CREATE OR REPLACE FUNCTION sync_stock_sale_dispatch_receipt_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stock_sale_id IS NOT NULL AND NEW.status = 'delivered' THEN
    UPDATE fabric_stock_sales s
    SET dispatch_status = CASE
      WHEN s.pending_dispatch_meters > 0.01 THEN 'partially_dispatched'
      WHEN EXISTS (
        SELECT 1
        FROM dispatches d
        WHERE d.org_id = s.org_id
          AND d.stock_sale_id = s.id
          AND d.id <> NEW.id
          AND d.status <> 'delivered'
      ) THEN 'dispatched'
      ELSE 'received'
    END
    WHERE s.id = NEW.stock_sale_id
      AND s.org_id = NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stock_sale_dispatch_receipt_state ON dispatches;
CREATE TRIGGER trg_sync_stock_sale_dispatch_receipt_state
  AFTER UPDATE OF status, qty_meters_received, received_at
  ON dispatches
  FOR EACH ROW
  EXECUTE FUNCTION sync_stock_sale_dispatch_receipt_state();
