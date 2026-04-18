-- ============================================================
-- MIGRATION: Performance Index for Hardened Payroll Guards
-- ============================================================
-- Adds index on origin_settlement_id to ensure fast downstream checks
-- even as advance history grows.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_worker_advances_origin_settlement_id 
ON worker_advances(origin_settlement_id) 
WHERE origin_settlement_id IS NOT NULL;
