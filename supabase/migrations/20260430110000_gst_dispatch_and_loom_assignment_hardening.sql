-- ============================================================
-- MIGRATION: GST Dispatch + Loom Assignment Hardening
-- Adds compliance/accounting fields called out during sprint review:
-- Tax Invoice cum Delivery Challan metadata, GST split, e-way bill
-- reference, shortage credit-note traceability, two-worker loom
-- assignments, and counter reset support.
-- ============================================================

-- Party state determines CGST/SGST vs IGST at invoice generation time.
ALTER TABLE parties
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'Gujarat';

COMMENT ON COLUMN parties.state IS
  'Trader state used to decide GST split: Gujarat/local = CGST+SGST, other states = IGST.';

-- Dispatch now carries invoice/movement metadata. The generated document is
-- "Tax Invoice cum Delivery Challan", not a standalone delivery challan.
ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES party_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS hsn_code TEXT NOT NULL DEFAULT '5407',
  ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5,2) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_invoice_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eway_bill_number TEXT;

CREATE INDEX IF NOT EXISTS idx_dispatches_invoice_id
  ON dispatches(invoice_id)
  WHERE invoice_id IS NOT NULL;

COMMENT ON COLUMN dispatches.invoice_id IS
  'Linked party_invoices row for the Tax Invoice cum Delivery Challan generated on dispatch.';

COMMENT ON COLUMN dispatches.eway_bill_number IS
  'Optional externally-generated e-way bill number for dispatches above the GST threshold.';

-- Store tax composition on invoices so the ledger can reconcile GSTR-1
-- liability without re-deriving historical tax split from mutable party data.
ALTER TABLE party_invoices
  ADD COLUMN IF NOT EXISTS source_dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hsn_code TEXT NOT NULL DEFAULT '5407',
  ADD COLUMN IF NOT EXISTS gst_treatment TEXT NOT NULL DEFAULT 'intra_state'
    CHECK (gst_treatment IN ('intra_state', 'inter_state')),
  ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(14,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_party_invoices_source_dispatch
  ON party_invoices(source_dispatch_id)
  WHERE source_dispatch_id IS NOT NULL;

COMMENT ON COLUMN party_invoices.gross_amount IS
  'Taxable value before GST.';

COMMENT ON COLUMN party_invoices.gst_amount IS
  'Total GST amount. Split into CGST/SGST or IGST columns for filing reconciliation.';

-- Credit-note style adjustments need traceability and GST split when created
-- for confirmed dispatch shortages.
ALTER TABLE party_adjustments
  ADD COLUMN IF NOT EXISTS source_dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shortage_meters NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS rate_per_m NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5,2) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS i18n_key TEXT;

CREATE INDEX IF NOT EXISTS idx_party_adjustments_source_dispatch
  ON party_adjustments(source_dispatch_id)
  WHERE source_dispatch_id IS NOT NULL;

COMMENT ON COLUMN party_adjustments.i18n_key IS
  'Stable UI label key, for example ledger.creditNote.shortageAdjustment.';

-- Two workers can be assigned to one loom: weaver plus optional helper/khadki.
-- Existing worker_id/rate_per_m remain as the primary weaver fields for
-- compatibility with current code.
ALTER TABLE shift_assignments
  ADD COLUMN IF NOT EXISTS primary_worker_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS helper_worker_id BIGINT REFERENCES workers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS helper_rate_snapshot NUMERIC(12,4);

UPDATE shift_assignments
SET primary_worker_id = worker_id
WHERE primary_worker_id IS NULL
  AND worker_id IS NOT NULL;

COMMENT ON COLUMN shift_assignments.primary_worker_id IS
  'Primary loom worker / weaver. Mirrors worker_id for backward compatibility.';

COMMENT ON COLUMN shift_assignments.helper_worker_id IS
  'Optional second worker per loom (helper/khadki). Null for single-operator machines.';

COMMENT ON COLUMN shift_assignments.helper_rate_snapshot IS
  'Helper piece-rate snapshot for this shift so historical payroll remains stable.';

CREATE INDEX IF NOT EXISTS idx_shift_assignments_primary_worker
  ON shift_assignments(primary_worker_id, date DESC)
  WHERE primary_worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shift_assignments_helper_worker
  ON shift_assignments(helper_worker_id, date DESC)
  WHERE helper_worker_id IS NOT NULL;

-- Counter reset support: when true, opening_meter_reading may be null and the
-- shift meters are taken from closing_meter_reading.
ALTER TABLE production_logs
  ADD COLUMN IF NOT EXISTS counter_was_reset BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN production_logs.counter_was_reset IS
  'True when the loom counter reset during the shift; meters should equal closing_meter_reading and opening_meter_reading may be null.';
