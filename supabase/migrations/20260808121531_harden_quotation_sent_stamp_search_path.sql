-- Trigger functions should not inherit a caller-controlled search path.
ALTER FUNCTION public.stamp_estimator_quote_sent_at()
  SET search_path = pg_catalog, public;
