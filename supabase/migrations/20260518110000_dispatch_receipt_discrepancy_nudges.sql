-- Phase 1 refinement: lightweight dispatch receipt discrepancy nudges.
-- Receipt differences are between meters sent and meters received/confirmed.
-- Partial dispatch against sold/order meters is intentionally not a discrepancy.

ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS received_meters NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS received_note TEXT,
  ADD COLUMN IF NOT EXISTS receipt_status TEXT NOT NULL DEFAULT 'not_confirmed';

ALTER TABLE dispatches
  DROP CONSTRAINT IF EXISTS dispatches_receipt_status_check;

ALTER TABLE dispatches
  ADD CONSTRAINT dispatches_receipt_status_check
  CHECK (receipt_status IN ('not_confirmed','matched','difference_reported'));

UPDATE dispatches
SET
  received_meters = COALESCE(received_meters, qty_meters_received),
  received_note = COALESCE(received_note, receipt_confirmation_note),
  receipt_status = CASE
    WHEN COALESCE(received_meters, qty_meters_received) IS NULL THEN 'not_confirmed'
    WHEN ABS(COALESCE(received_meters, qty_meters_received, 0) - qty_meters_sent) <= 0.01 THEN 'matched'
    ELSE 'difference_reported'
  END
WHERE received_meters IS NULL
   OR received_note IS NULL
   OR receipt_status = 'not_confirmed';

CREATE INDEX IF NOT EXISTS idx_dispatches_receipt_status
  ON dispatches(org_id, receipt_status, received_at DESC);

ALTER TABLE stock_discrepancies
  ADD COLUMN IF NOT EXISTS stock_sale_id UUID REFERENCES fabric_stock_sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actual_received_meters NUMERIC(12,2);

ALTER TABLE stock_discrepancies
  DROP CONSTRAINT IF EXISTS stock_discrepancies_status_check;

ALTER TABLE stock_discrepancies
  ADD CONSTRAINT stock_discrepancies_status_check
  CHECK (status IN ('needs_review','reviewed','resolved','written_off'));

CREATE UNIQUE INDEX IF NOT EXISTS stock_discrepancies_dispatch_receipt_unique
  ON stock_discrepancies(dispatch_id, source_reference)
  WHERE source_reference = 'dispatch_receipt';
