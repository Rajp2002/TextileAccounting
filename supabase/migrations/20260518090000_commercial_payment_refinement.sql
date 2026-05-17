-- Migration: Add optimized DESC index for payment_date queries (monthly collection aggregation)
-- This supplements the existing idx_commercial_payment_receipts_date index.

CREATE INDEX IF NOT EXISTS idx_commercial_payment_receipts_org_date_desc
  ON commercial_payment_receipts(org_id, payment_date DESC);
