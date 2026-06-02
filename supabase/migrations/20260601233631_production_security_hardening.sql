-- Production security hardening:
-- - remove public internal IDs from tracking RPCs
-- - make tracking tokens cryptographically generated
-- - add Razorpay webhook idempotency ledger
-- - revoke anonymous table/function access where the app uses server-side routes
-- - keep authenticated policies conservative; do not add broad blanket policies

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Razorpay webhook idempotency ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.razorpay_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.razorpay_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.razorpay_webhook_events FROM anon, authenticated;

-- ─── DPDP erasure support ───────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.worker_consent_artifacts
  ALTER COLUMN worker_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS erased_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE IF EXISTS public.audit_log
  ADD CONSTRAINT audit_log_action_check
  CHECK (
    action IN (
      'INSERT',
      'UPDATE',
      'DELETE',
      'EXPORT',
      'payroll.settle',
      'payroll.unsettle',
      'payroll.manual_adjustment',
      'shift_self_correction',
      'dpdp.erasure'
    )
  );

-- ─── Tracking tokens and public tracking RPCs ───────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_tracking_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
$$;

ALTER TABLE IF EXISTS public.orders
  ALTER COLUMN tracking_token SET DEFAULT public.generate_tracking_token();

ALTER TABLE IF EXISTS public.orders DROP CONSTRAINT IF EXISTS orders_tracking_token_format_secure;
ALTER TABLE IF EXISTS public.orders
  ADD CONSTRAINT orders_tracking_token_format_secure
  CHECK (tracking_token ~ '^[A-Za-z0-9_-]{12,64}$');

CREATE OR REPLACE FUNCTION public.get_order_tracking_data(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{12,64}$' THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'party_name',          o.party_name,
    'total_target_meters', o.total_target_meters,
    'status',              o.status,
    'meters_produced', COALESCE((
      SELECT SUM(pl.meters)
      FROM public.production_logs pl
      WHERE pl.order_id = o.id
        AND pl.org_id = o.org_id
    ), 0),
    'dispatches', COALESCE((
      SELECT json_agg(json_build_object(
        'dispatch_number',             d.dispatch_number,
        'qty_meters_sent',             d.qty_meters_sent,
        'qty_meters_received',         d.qty_meters_received,
        'receipt_confirmed_by_owner',  d.receipt_confirmed_by_owner,
        'status',                      d.status,
        'dispatched_at',               d.dispatched_at,
        'received_at',                 d.received_at
      ) ORDER BY d.dispatch_number)
      FROM public.dispatches d
      WHERE d.order_id = o.id
        AND d.org_id = o.org_id
    ), '[]'::json)
  ) INTO v_result
  FROM public.orders o
  WHERE o.tracking_token = p_token;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_fabric_dispatch_receipt_by_number(
  p_dispatch_number INTEGER,
  p_tracking_token TEXT,
  p_qty_received NUMERIC
)
RETURNS TABLE (
  qty_received NUMERIC,
  shortage_meters NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dispatch_id UUID;
BEGIN
  IF p_tracking_token IS NULL
    OR p_tracking_token !~ '^[A-Za-z0-9_-]{12,64}$'
    OR p_dispatch_number IS NULL
    OR p_dispatch_number <= 0
  THEN
    RAISE EXCEPTION 'Invalid tracking link';
  END IF;

  SELECT d.id
    INTO v_dispatch_id
  FROM public.dispatches d
  JOIN public.orders o
    ON o.id = d.order_id
   AND o.org_id = d.org_id
  WHERE o.tracking_token = p_tracking_token
    AND d.dispatch_number = p_dispatch_number
  LIMIT 1;

  IF v_dispatch_id IS NULL THEN
    RAISE EXCEPTION 'Invalid tracking link';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.confirm_fabric_dispatch_receipt(
    v_dispatch_id,
    p_tracking_token,
    p_qty_received
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_tracking_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_tracking_token() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_order_tracking_data(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_tracking_data(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.confirm_fabric_dispatch_receipt_by_number(INTEGER, TEXT, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_fabric_dispatch_receipt_by_number(INTEGER, TEXT, NUMERIC)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_fabric_dispatch_receipt(UUID, TEXT, NUMERIC) FROM anon;

-- ─── Public grant cleanup ───────────────────────────────────────────────────
-- All public unauthenticated reads/writes now flow through server-side routes.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Billing and webhook ledgers are server-managed only.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.org_subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.subscription_payments FROM anon, authenticated;
REVOKE ALL ON TABLE public.whatsapp_settings FROM anon, authenticated;

-- Ensure every current public base table has RLS enabled. This does not create
-- permissive policies; tables without policies remain closed to client roles.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END;
$$;

COMMENT ON TABLE public.whatsapp_settings IS
  'Internal pg_cron/pg_net configuration. Do not store literal secrets in migrations; rotate existing values and move runtime secrets to Supabase Vault where available.';

COMMENT ON FUNCTION public.get_order_tracking_data(TEXT) IS
  'Service-role-only public tracking payload. Returns no internal UUIDs and validates capability-token format.';

COMMENT ON FUNCTION public.confirm_fabric_dispatch_receipt_by_number(INTEGER, TEXT, NUMERIC) IS
  'Service-role-only public receipt confirmation by token plus dispatch number. The internal dispatch UUID is never accepted from the client.';
