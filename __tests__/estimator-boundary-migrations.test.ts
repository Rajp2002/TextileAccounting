import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const boundary = readFileSync(join(
  root,
  'supabase/migrations/20260710110907_enforce_standalone_estimator_boundary.sql'
), 'utf8')
const billing = readFileSync(join(
  root,
  'supabase/migrations/20260710112640_estimator_billing_atomic_activation.sql'
), 'utf8')

describe('standalone Estimator database boundary migration', () => {
  it('adds retry-safe quote identity and same-tenant source links', () => {
    expect(boundary).toContain('ADD COLUMN IF NOT EXISTS client_request_id uuid')
    expect(boundary).toContain('estimator_quotes_org_client_request_unique')
    expect(boundary).toContain('FOREIGN KEY (org_id, source_quote_id)')
    expect(boundary).toContain('REFERENCES public.estimator_quotes (org_id, id)')
  })

  it('uses live membership, role, period, and tier state', () => {
    expect(boundary).toContain('membership.id = auth.uid()')
    expect(boundary).toContain("membership.role::text = auth.jwt() ->> 'user_role'")
    expect(boundary).toContain('subscription.current_start <= now()')
    expect(boundary).toContain("subscription.plan_tier IN ('premium', 'trial')")
  })

  it('closes direct table and SECURITY DEFINER mutation bypasses', () => {
    expect(boundary).toContain('AS RESTRICTIVE FOR ALL TO authenticated')
    expect(boundary).toContain('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon')
    expect(boundary).toContain('CREATE TRIGGER require_premium_tenant_mutation')
    expect(boundary).toContain("auth.role() IS DISTINCT FROM 'authenticated'")
    expect(boundary).toContain("USING ERRCODE = '42501'")
  })

  it('guards production analytics RPCs and removes anonymous definer execution', () => {
    expect(boundary).toContain('assert_premium_rpc_access(p_org_id)')
    expect(boundary).toContain("proc.proname = 'get_order_forecast'")
    expect(boundary).toContain('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon')
    expect(boundary).toContain("v_function.proname <> 'rls_auto_enable'")
  })

  it('keeps order mutations owner-only', () => {
    expect(boundary).toContain("(auth.jwt() ->> 'user_role') = 'owner'")
    expect(boundary).toContain("public.org_has_subscription_tier(org_id, 'premium')")
  })
})

describe('atomic Estimator billing migration', () => {
  it('binds checkout context and unique external order identities', () => {
    expect(billing).toContain('checkout_purchase_type text')
    expect(billing).toContain('checkout_amount_paise integer')
    expect(billing).toContain('idx_org_subscriptions_razorpay_order_id_unique')
    expect(billing).toContain('idx_subscription_payments_captured_order_unique')
  })

  it('serializes activation and extends from the latest paid period', () => {
    expect(billing).toContain('pg_advisory_xact_lock')
    expect(billing).toContain('COALESCE(MAX(history.current_end), v_now)')
    expect(billing).toContain("v_anchor + interval '365 days'")
  })

  it('is callable only through the service-role backend', () => {
    expect(billing).toContain('FROM PUBLIC, anon, authenticated')
    expect(billing).toContain('TO service_role')
  })
})
