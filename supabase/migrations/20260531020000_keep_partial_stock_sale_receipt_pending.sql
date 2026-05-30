-- Keep a partially dispatched stock sale available for its next batch after one batch is received.
CREATE OR REPLACE FUNCTION confirm_stock_sale_dispatch_receipt_v1(
  p_dispatch_id UUID,
  p_qty_received NUMERIC
)
RETURNS TABLE (
  qty_received NUMERIC,
  shortage_meters NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispatch RECORD;
  v_sale RECORD;
  v_received NUMERIC(12,2);
  v_remaining NUMERIC(12,2);
  v_line_received NUMERIC(12,2);
  v_line_shortage NUMERIC(12,2);
  v_shortage NUMERIC(12,2);
  v_party_id UUID;
  v_user_id UUID;
  v_org_id UUID;
  rec RECORD;
BEGIN
  v_org_id := (auth.jwt() ->> 'org_id')::uuid;
  v_user_id := auth.uid();

  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT d.*
    INTO v_dispatch
  FROM dispatches d
  WHERE d.id = p_dispatch_id
    AND d.order_id IS NULL
    AND d.org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispatch not found';
  END IF;

  IF v_dispatch.status <> 'in_transit' THEN
    RAISE EXCEPTION 'This batch has already been confirmed';
  END IF;

  v_received := COALESCE(p_qty_received, v_dispatch.qty_meters_sent);
  IF v_received < 0 THEN
    RAISE EXCEPTION 'Enter a valid received quantity';
  END IF;

  SELECT s.*, l.quality_label
    INTO v_sale
  FROM fabric_stock_sales s
  JOIN fabric_stock_lots l ON l.id = s.stock_lot_id
  WHERE s.id = v_dispatch.stock_sale_id
    AND s.org_id = v_org_id;

  SELECT p.id
    INTO v_party_id
  FROM parties p
  WHERE p.org_id = v_org_id
    AND lower(trim(p.name)) = lower(trim(v_dispatch.party_name))
  ORDER BY p.created_at
  LIMIT 1;

  UPDATE dispatches
  SET status = 'delivered',
      qty_meters_received = v_received,
      received_at = NOW()
  WHERE id = p_dispatch_id;

  IF v_sale.id IS NOT NULL THEN
    UPDATE fabric_stock_sales
    SET dispatch_status = CASE
      WHEN pending_dispatch_meters > 0.01 THEN 'partially_dispatched'
      WHEN EXISTS (
        SELECT 1
        FROM dispatches d
        WHERE d.org_id = v_org_id
          AND d.stock_sale_id = v_sale.id
          AND d.id <> p_dispatch_id
          AND d.status <> 'delivered'
      ) THEN 'dispatched'
      ELSE 'received'
    END
    WHERE id = v_sale.id;
  END IF;

  v_remaining := v_received;

  FOR rec IN
    SELECT dpl.id, dpl.package_id, dpl.package_no, dpl.qty_meters_sent
    FROM dispatch_package_lines dpl
    WHERE dpl.dispatch_id = p_dispatch_id
    ORDER BY dpl.created_at, dpl.package_no
  LOOP
    v_line_received := LEAST(rec.qty_meters_sent, GREATEST(v_remaining, 0));
    v_line_shortage := rec.qty_meters_sent - v_line_received;

    UPDATE dispatch_package_lines
    SET qty_meters_received = v_line_received
    WHERE id = rec.id;

    UPDATE fabric_packages
    SET stock_state = CASE
        WHEN v_line_shortage > 0.01 THEN 'claimed'
        ELSE 'dispatched'
      END,
      updated_at = NOW()
    WHERE id = rec.package_id;

    IF v_line_shortage > 0.01 AND v_party_id IS NOT NULL THEN
      INSERT INTO party_dispatch_claims (
        org_id, party_id, order_id, dispatch_id, package_id, package_line_id,
        claim_type, claim_status, claim_date, shortage_meters, amount, notes, created_by
      ) VALUES (
        v_org_id, v_party_id, NULL, p_dispatch_id, rec.package_id, rec.id,
        'shortage', 'open', CURRENT_DATE, v_line_shortage, NULL,
        'Short receipt on package ' || rec.package_no, v_user_id
      );
    END IF;

    v_remaining := GREATEST(v_remaining - rec.qty_meters_sent, 0);
  END LOOP;

  v_shortage := v_dispatch.qty_meters_sent - v_received;

  IF ABS(v_shortage) > 0.01 THEN
    BEGIN
      INSERT INTO stock_discrepancies (
        org_id, dispatch_id, market_run_id, order_id, quality_label,
        expected_meters, actual_dispatched_meters, difference_meters,
        discrepancy_type, source_reference, discrepancy_date, notes, status, created_by
      ) VALUES (
        v_org_id, p_dispatch_id, NULL, NULL, v_sale.quality_label,
        v_dispatch.qty_meters_sent, v_received, v_received - v_dispatch.qty_meters_sent,
        CASE WHEN v_received < v_dispatch.qty_meters_sent THEN 'shortage' ELSE 'excess' END,
        'dispatch_receipt', CURRENT_DATE,
        CASE WHEN v_received < v_dispatch.qty_meters_sent THEN 'Shortage found during dispatch reconciliation.' ELSE 'Excess found during dispatch reconciliation.' END,
        'needs_review', v_user_id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN QUERY
  SELECT v_received, v_shortage;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_stock_sale_dispatch_receipt_v1(UUID, NUMERIC) TO authenticated, service_role;
