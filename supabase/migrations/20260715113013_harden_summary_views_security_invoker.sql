-- Restore tenant RLS enforcement for authenticated summary-view reads.
--
-- CREATE OR REPLACE VIEW resets view options unless they are declared again.
-- Several historical view rebuilds therefore lost security_invoker even though
-- every underlying table is RLS-enabled and grants authenticated SELECT.
-- This migration changes no rows, calculations, columns, or view definitions.

ALTER VIEW public.order_progress_summary
  SET (security_invoker = true);

ALTER VIEW public.party_ledger_entries
  SET (security_invoker = true);

ALTER VIEW public.yarn_lot_stock_summary
  SET (security_invoker = true);

ALTER VIEW public.order_yarn_variance_summary
  SET (security_invoker = true);

ALTER VIEW public.market_run_summary
  SET (security_invoker = true);

ALTER VIEW public.order_dispatch_summary
  SET (security_invoker = true);

COMMENT ON VIEW public.order_progress_summary IS
  'Order production summary evaluated with caller permissions and tenant RLS.';

COMMENT ON VIEW public.party_ledger_entries IS
  'Party ledger union evaluated with caller permissions and tenant RLS.';

COMMENT ON VIEW public.yarn_lot_stock_summary IS
  'Yarn lot stock summary evaluated with caller permissions and tenant RLS.';

COMMENT ON VIEW public.order_yarn_variance_summary IS
  'Order yarn variance summary evaluated with caller permissions and tenant RLS.';

COMMENT ON VIEW public.market_run_summary IS
  'Market-run production, stock, and sales summary evaluated with caller permissions and tenant RLS.';

COMMENT ON VIEW public.order_dispatch_summary IS
  'Order dispatch summary evaluated with caller permissions and tenant RLS.';

-- Rollback (metadata only):
-- ALTER VIEW public.order_progress_summary RESET (security_invoker);
-- ALTER VIEW public.party_ledger_entries RESET (security_invoker);
-- ALTER VIEW public.yarn_lot_stock_summary RESET (security_invoker);
-- ALTER VIEW public.order_yarn_variance_summary RESET (security_invoker);
-- ALTER VIEW public.market_run_summary RESET (security_invoker);
-- ALTER VIEW public.order_dispatch_summary RESET (security_invoker);
