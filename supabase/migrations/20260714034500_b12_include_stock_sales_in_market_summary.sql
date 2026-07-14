-- B12: market-run cards and archive must count sales made through the current
-- stock-lot workflow as well as legacy direct market_run_sales rows.

CREATE OR REPLACE VIEW public.market_run_summary AS
SELECT
    mr.id AS market_run_id,
    mr.org_id,
    mr.fabric_label,
    mr.quality_label,
    mr.warp_instruction,
    mr.weft_instruction,
    mr.target_meters,
    mr.cost_per_meter,
    mr.worker_rate_per_m,
    mr.status,
    mr.quote_id,
    mr.notes,
    mr.created_at,

    (SELECT o.id FROM public.orders o WHERE o.market_run_id = mr.id LIMIT 1) AS order_id,
    (SELECT o.status FROM public.orders o WHERE o.market_run_id = mr.id LIMIT 1) AS order_status,

    COALESCE((
        SELECT SUM(pl.meters)
        FROM public.production_logs pl
        JOIN public.orders o ON o.id = pl.order_id
        WHERE o.market_run_id = mr.id
    ), 0) AS total_meters_produced,

    COALESCE((
        SELECT SUM(s.meters_sold)
        FROM public.market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0)
    + COALESCE((
        SELECT SUM(fs.meters_sold)
        FROM public.fabric_stock_sales fs
        JOIN public.fabric_stock_lots fl ON fl.id = fs.stock_lot_id
        WHERE fl.market_run_id = mr.id
    ), 0) AS total_meters_sold,

    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.fabric_stock_lots fl WHERE fl.market_run_id = mr.id
      ) THEN COALESCE((
        SELECT SUM(fl.available_meters)
        FROM public.fabric_stock_lots fl
        WHERE fl.market_run_id = mr.id
      ), 0)
      ELSE
        COALESCE((
            SELECT SUM(pl.meters)
            FROM public.production_logs pl
            JOIN public.orders o ON o.id = pl.order_id
            WHERE o.market_run_id = mr.id
        ), 0)
        - COALESCE((
            SELECT SUM(s.meters_sold)
            FROM public.market_run_sales s
            WHERE s.market_run_id = mr.id
        ), 0)
    END AS meters_in_godown,

    COALESCE((
        SELECT SUM(s.meters_sold * s.price_per_meter)
        FROM public.market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0)
    + COALESCE((
        SELECT SUM(fs.revenue_amount)
        FROM public.fabric_stock_sales fs
        JOIN public.fabric_stock_lots fl ON fl.id = fs.stock_lot_id
        WHERE fl.market_run_id = mr.id
    ), 0) AS total_revenue,

    COALESCE((
        SELECT SUM(s.meters_sold * s.cost_per_meter)
        FROM public.market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0)
    + COALESCE((
        SELECT SUM(fs.cost_amount)
        FROM public.fabric_stock_sales fs
        JOIN public.fabric_stock_lots fl ON fl.id = fs.stock_lot_id
        WHERE fl.market_run_id = mr.id
    ), 0) AS total_cost_on_sold,

    COALESCE((
        SELECT SUM(s.meters_sold * (s.price_per_meter - s.cost_per_meter))
        FROM public.market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0)
    + COALESCE((
        SELECT SUM(fs.gross_profit_amount)
        FROM public.fabric_stock_sales fs
        JOIN public.fabric_stock_lots fl ON fl.id = fs.stock_lot_id
        WHERE fl.market_run_id = mr.id
    ), 0) AS total_profit,

    COALESCE((
        SELECT COUNT(*)::int
        FROM public.market_run_sales s
        WHERE s.market_run_id = mr.id
    ), 0)
    + COALESCE((
        SELECT COUNT(*)::int
        FROM public.fabric_stock_sales fs
        JOIN public.fabric_stock_lots fl ON fl.id = fs.stock_lot_id
        WHERE fl.market_run_id = mr.id
    ), 0) AS sales_count,

    COALESCE((
        SELECT COUNT(*)::int
        FROM public.fabric_stock_lots fl
        WHERE fl.market_run_id = mr.id
    ), 0) AS stock_lot_count

FROM public.market_runs mr;

COMMENT ON VIEW public.market_run_summary IS
  'Market-run production, stock, commercial, and sale summary including legacy and stock-lot sales.';
