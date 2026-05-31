-- ============================================================
-- Performance: index columns used by market_run_summary view
-- ============================================================
-- The market_run_summary view runs 8 correlated subqueries per row,
-- several of which join/filter on fabric_stock_lots.market_run_id and
-- fabric_stock_sales.stock_lot_id. These indexes ensure those subqueries
-- use index scans instead of sequential scans, reducing the latency of
-- getActiveProductionTargets() on the Looms assignment page.

-- fabric_stock_lots: the view filters on market_run_id in 4 subqueries
CREATE INDEX IF NOT EXISTS idx_fabric_stock_lots_market_run_id
    ON fabric_stock_lots(market_run_id)
    WHERE market_run_id IS NOT NULL;

-- fabric_stock_lots: also filters on org_id + market_run_id together
CREATE INDEX IF NOT EXISTS idx_fabric_stock_lots_org_market_run
    ON fabric_stock_lots(org_id, market_run_id)
    WHERE market_run_id IS NOT NULL;

-- fabric_stock_sales: joins via stock_lot_id in the profit/revenue subqueries
CREATE INDEX IF NOT EXISTS idx_fabric_stock_sales_stock_lot_id
    ON fabric_stock_sales(stock_lot_id);

-- orders: the view looks up order_id + status by market_run_id (2 correlated subqueries)
-- idx_orders_market_run_id already exists from 20260429000000_market_runs.sql
-- Add a covering index that also includes status to avoid a heap fetch
CREATE INDEX IF NOT EXISTS idx_orders_market_run_id_status
    ON orders(market_run_id, status)
    WHERE market_run_id IS NOT NULL;
