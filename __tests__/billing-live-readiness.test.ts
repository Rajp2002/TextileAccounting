import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { evaluateBillingReadiness, liveReadinessGaps } from '../lib/billing-readiness'
import { BILLING_DOCUMENT_POLICY } from '../lib/billing-document-policy'

const root = process.cwd()
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const liveEnvironment = {
    RAZORPAY_KEY_ID: 'rzp_live_matching',
    NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_live_matching',
    RAZORPAY_KEY_SECRET: 'secret',
    BILLING_GST_INVOICE_ENABLED: 'true',
    BILLING_SUPPLIER_LEGAL_NAME: 'Weavly Private Limited',
    BILLING_SUPPLIER_GSTIN: '24ABCDE1234F1Z5',
    BILLING_SUPPLIER_ADDRESS: 'Ankur Char Rasta, Surat',
    BILLING_SUPPLIER_STATE: 'Gujarat',
    BILLING_SUPPLIER_STATE_CODE: '24',
    BILLING_SUPPLIER_POSTAL_CODE: '395008',
    BILLING_SUPPLIER_SAC: '998314',
}

describe('go-live checklist', () => {
    it('lists every live requirement on test keys, instead of reporting nothing missing', () => {
        const testKeys = { RAZORPAY_KEY_ID: 'rzp_test_x', NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 'secret' }
        const gaps = liveReadinessGaps(testKeys, 'not_supported')
        expect(gaps[0]).toBe('live Razorpay keys')
        expect(gaps).toEqual(expect.arrayContaining(['billing document policy approval', 'GST invoice feature flag', 'valid supplier GSTIN', 'supplier legal name']))
    })
    it('lists the key gap when keys are missing, and nothing once live is fully configured', () => {
        expect(liveReadinessGaps({}, 'not_supported')[0]).toBe('live Razorpay keys')
        expect(liveReadinessGaps(liveEnvironment, 'supported')).toEqual([])
    })
})

describe('live billing readiness gate', () => {
    it('allows matching Razorpay test credentials without pretending GST invoicing is live', () => {
        const result = evaluateBillingReadiness({
            RAZORPAY_KEY_ID: 'rzp_test_matching',
            NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_test_matching',
            RAZORPAY_KEY_SECRET: 'test-secret',
        })

        expect(result).toMatchObject({ canCreateOrder: true, mode: 'test', code: 'test_ready' })
    })

    it('blocks missing or mismatched payment credentials', () => {
        expect(evaluateBillingReadiness({}).code).toBe('gateway_not_configured')
        expect(evaluateBillingReadiness({
            RAZORPAY_KEY_ID: 'rzp_live_private',
            NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_live_public',
            RAZORPAY_KEY_SECRET: 'secret',
        }).canCreateOrder).toBe(false)
    })

    it('keeps real checkout blocked under the current pre-incorporation document policy', () => {
        expect(BILLING_DOCUMENT_POLICY.state).toBe('not_supported')
        const result = evaluateBillingReadiness(liveEnvironment)

        expect(result).toMatchObject({
            canCreateOrder: false,
            code: 'live_supplier_not_ready',
        })
        expect(result.missing).toContain('billing document policy approval')
    })

    it('requires valid supplier GST particulars before allowing live orders', () => {
        const invalid = evaluateBillingReadiness({
            ...liveEnvironment,
            BILLING_SUPPLIER_GSTIN: 'invalid',
            BILLING_SUPPLIER_POSTAL_CODE: '000000',
        }, 'supported')

        expect(invalid.canCreateOrder).toBe(false)
        expect(invalid.missing).toContain('valid supplier GSTIN')
        expect(invalid.missing).toContain('supplier postal code')

        expect(evaluateBillingReadiness(liveEnvironment, 'supported')).toMatchObject({
            canCreateOrder: true,
            mode: 'live',
            code: 'live_ready',
        })
    })

    it('enforces readiness before pricing, database claims, or Razorpay side effects', () => {
        const route = source('app/api/billing/create-order/route.ts')
        const guard = route.indexOf('if (!billingReadiness.canCreateOrder)')

        expect(guard).toBeGreaterThan(-1)
        expect(guard).toBeLessThan(route.indexOf('getBillingPlan(planTier)'))
        expect(guard).toBeLessThan(route.indexOf('resolveBillingPurchase('))
        expect(guard).toBeLessThan(route.indexOf("rpc('claim_billing_checkout_attempt'"))
        expect(guard).toBeLessThan(route.indexOf('razorpay.orders.create'))
        expect(route).toContain('{ status: 503 }')
    })

    it('removes payment buttons from the owner billing page while blocked', () => {
        const page = source('app/(dashboard)/owner/billing/page.tsx')

        expect(page).toContain('Plan payments are not open yet')
        expect(page).toContain('canShowPlanCards && billingReadiness.canCreateOrder')
        expect(page).toContain('billingReady={billingReadiness.canCreateOrder}')
    })
})
