ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS receipt_confirmed_by_owner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_confirmation_note text,
  ADD COLUMN IF NOT EXISTS receipt_confirmed_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN dispatches.receipt_confirmed_by_owner IS
  'True if the receipt was confirmed by the factory owner on behalf of the trader. False if confirmed directly via the public tracking portal.';

CREATE OR REPLACE FUNCTION get_order_tracking_data(p_token TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSON;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders WHERE tracking_token = p_token) THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'party_name',          o.party_name,
    'total_target_meters', o.total_target_meters,
    'status',              o.status,
    'meters_produced', COALESCE((
      SELECT SUM(meters) FROM production_logs WHERE order_id = o.id
    ), 0),
    'dispatches', COALESCE((
      SELECT json_agg(json_build_object(
        'id',                          d.id,
        'dispatch_number',             d.dispatch_number,
        'qty_meters_sent',             d.qty_meters_sent,
        'qty_meters_received',         d.qty_meters_received,
        'receipt_confirmed_by_owner',  d.receipt_confirmed_by_owner,
        'status',                      d.status,
        'dispatched_at',               d.dispatched_at,
        'received_at',                 d.received_at
      ) ORDER BY d.dispatch_number)
      FROM dispatches d WHERE d.order_id = o.id
    ), '[]'::json)
  ) INTO v_result
  FROM orders o
  WHERE o.tracking_token = p_token;

  RETURN v_result;
END;
$$;
