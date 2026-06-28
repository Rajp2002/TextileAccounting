-- Batch 6 follow-up: preserve the completed-order dispatch contract while
-- restoring the Batch 3-qualified RETURNING clause inside create_stock_sale_dispatch.
-- The previous Batch 6 migration intentionally allowed active/completed orders,
-- but copied back an unqualified RETURNING reference that conflicts with the
-- function's output parameter named dispatch_number.

DO $$
DECLARE
  v_function_sql TEXT;
  v_corrected_sql TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.create_stock_sale_dispatch(uuid,uuid,uuid[],numeric[],numeric[],date,text,text,text,text,text,numeric,timestamp with time zone,uuid,text)'::regprocedure
  )
  INTO v_function_sql;

  IF POSITION('IF v_status NOT IN (''active'', ''completed'') THEN' IN v_function_sql) = 0 THEN
    RAISE EXCEPTION 'create_stock_sale_dispatch does not contain the Batch 6 completed-order status gate';
  END IF;

  v_corrected_sql := REPLACE(
    v_function_sql,
    'RETURNING id, dispatch_number INTO v_dispatch_id, v_dispatch_number;',
    'RETURNING dispatches.id, dispatches.dispatch_number INTO v_dispatch_id, v_dispatch_number;'
  );

  IF v_corrected_sql = v_function_sql THEN
    RAISE EXCEPTION 'create_stock_sale_dispatch ambiguous RETURNING clause was not found';
  END IF;

  EXECUTE v_corrected_sql;
END;
$$;

GRANT EXECUTE ON FUNCTION create_stock_sale_dispatch(
  UUID, UUID, UUID[], NUMERIC[], NUMERIC[], DATE, TEXT, TEXT, TEXT, TEXT,
  TEXT, NUMERIC, TIMESTAMPTZ, UUID, TEXT
) TO authenticated, service_role;
