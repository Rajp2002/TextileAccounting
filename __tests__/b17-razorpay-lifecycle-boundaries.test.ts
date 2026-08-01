import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIdempotentRazorpayRefund } from '../lib/razorpay-refund-client'
import { resolveEffectiveSubscription } from '../lib/subscription-access'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe('B17 Razorpay lifecycle boundaries', () => {
    it('keeps a paid period accessible after failure, halt, or cycle-end cancellation', () => {
        const now = Date.parse('2026-07-14T00:00:00.000Z')
        for (const status of ['pending', 'paused', 'halted', 'cancelled', 'completed']) {
            const result = resolveEffectiveSubscription([{
                status,
                plan_tier: 'premium',
                current_end: '2026-08-14T00:00:00.000Z',
            }], now)
            expect(result.tier, status).toBe('premium')
        }
    })

    it('removes entitlement after provider expiry without deleting business data', () => {
        const result = resolveEffectiveSubscription([{
            status: 'expired',
            plan_tier: 'premium',
            current_end: '2027-08-14T00:00:00.000Z',
        }], Date.parse('2026-07-14T00:00:00.000Z'))
        expect(result).toEqual({ tier: 'none', subscription: null })
    })

    it('uses Razorpay provider idempotency for refund retries', async () => {
        vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test_boundary')
        vi.stubEnv('RAZORPAY_KEY_SECRET', 'test-secret')
        const providerFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            id: 'rfnd_b17',
            status: 'processed',
        }), { status: 200, headers: { 'content-type': 'application/json' } }))
        vi.stubGlobal('fetch', providerFetch)

        await expect(createIdempotentRazorpayRefund({
            paymentId: 'pay_b17',
            amountPaise: 82600,
            idempotencyKey: 'wvl_refund_pay_b17',
            note: 'B17 test refund',
        })).resolves.toMatchObject({ id: 'rfnd_b17' })

        expect(providerFetch).toHaveBeenCalledTimes(1)
        const [url, init] = providerFetch.mock.calls[0] as [string, RequestInit]
        expect(url).toBe('https://api.razorpay.com/v1/payments/pay_b17/refund')
        expect(new Headers(init.headers).get('x-refund-idempotency')).toBe('wvl_refund_pay_b17')
        expect(JSON.parse(String(init.body))).toMatchObject({ amount: 82600 })
    })

    it('claims webhook identity and applies provider lifecycle events atomically', () => {
        const migration = read('supabase/migrations/20260714090000_b17_harden_razorpay_lifecycle.sql')
        expect(migration).toContain('claim_razorpay_webhook_event')
        expect(migration).toContain('payload_hash IS DISTINCT FROM p_payload_hash')
        expect(migration).toContain('apply_razorpay_subscription_event')
        expect(migration).toContain('provider_event_created_at > p_event_created_at')
        expect(migration).toContain('provider_status_rank >= v_rank')
        expect(migration).toContain('TO service_role')
    })

    it('repairs QA activation parity and promotes canonical capture after a failed snapshot', () => {
        const migration = read('supabase/migrations/20260714090000_b17_harden_razorpay_lifecycle.sql')
        expect(migration).toContain('checkout_purchase_type')
        expect(migration).toContain('idx_org_subscriptions_razorpay_order_id_unique')
        expect(migration).toContain('activate_order_billing_purchase_legacy')
        expect(migration).toContain("payment.status = 'failed'")
        expect(migration).toContain('Failed payment context does not match captured checkout.')
    })

    it('claims referral conversion and refund before external side effects', () => {
        const helper = read('lib/referral-webhook.ts')
        const migration = read('supabase/migrations/20260714090000_b17_harden_razorpay_lifecycle.sql')
        const issueBlock = helper.slice(helper.indexOf('export async function issueReferralRefund'))
        expect(helper).toContain("rpc('claim_referral_conversion'")
        expect(helper).toContain("rpc('claim_referral_refund'")
        expect(issueBlock.indexOf("rpc('claim_referral_refund'")).toBeLessThan(issueBlock.indexOf('createIdempotentRazorpayRefund'))
        expect(migration).toContain('idx_referral_refunds_idempotency_key_unique')
        expect(migration).toContain("v_existing.status = 'pending' AND v_existing.updated_at > v_now - interval '5 minutes'")
    })

    it('fetches canonical payment state before captured or failed mutations', () => {
        const route = read('app/api/webhooks/razorpay/route.ts')
        const captured = route.slice(route.indexOf("case 'payment.captured'"), route.indexOf("case 'order.paid'"))
        const failed = route.slice(route.indexOf("case 'payment.failed'"), route.indexOf('default:'))
        expect(captured.indexOf('razorpay.payments.fetch')).toBeLessThan(captured.indexOf('reconcileBillingOrder'))
        expect(captured).toContain("payment.status !== 'captured'")
        expect(failed.indexOf('razorpay.payments.fetch')).toBeLessThan(failed.indexOf("status: 'failed'"))
        expect(failed).toContain("payment.status !== 'failed'")
        expect(failed).not.toContain('payment.notes?.org_id')
    })

    it('rejects a replayed event ID if its signed body identity changes', () => {
        const route = read('app/api/webhooks/razorpay/route.ts')
        expect(route).toContain("rpc('claim_razorpay_webhook_event'")
        expect(route).toContain('Webhook event identity mismatch')
        expect(route).toContain('status: 409')
        expect(route.indexOf('verifyRazorpaySignature')).toBeLessThan(route.indexOf("rpc('claim_razorpay_webhook_event'"))
    })
})
