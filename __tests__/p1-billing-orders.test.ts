import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P1 Billing Orders Static Analysis Tests', () => {
    
    it('verifies billing-constants.ts contains the correct pricing values', () => {
        const content = readProjectFile('lib/billing-constants.ts')
        expect(content).toContain('FIRST_YEAR_BASE_PAISE = 1500000')
        expect(content).toContain('FIRST_YEAR_GST_PAISE = 270000')
        expect(content).toContain('FIRST_YEAR_TOTAL_PAISE = 1770000')
        expect(content).toContain('RENEWAL_BASE_PAISE = 700000')
        expect(content).toContain('RENEWAL_GST_PAISE = 126000')
        expect(content).toContain('RENEWAL_TOTAL_PAISE = 826000')
        expect(content).toContain("BILLING_MODEL = 'upfront_first_year_plus_annual_renewal'")
    })

    it('verifies create-order API route uses correct order amount and notes', () => {
        const content = readProjectFile('app/api/billing/create-order/route.ts')
        expect(content).toContain('FIRST_YEAR_TOTAL_PAISE')
        expect(content).toContain('BILLING_MODEL')
        expect(content).toContain('initial_purchase')
        expect(content).toContain('base_amount_paise')
        expect(content).toContain('gst_paise')
        expect(content).toContain('total_paise')
        expect(content).toContain("currency: 'INR'")
    })

    it('verifies verify-payment API route uses HMAC SHA256 verification and fetches Razorpay order', () => {
        const content = readProjectFile('app/api/billing/verify-payment/route.ts')
        expect(content).toContain('createHmac')
        expect(content).toContain('sha256')
        expect(content).toContain('razorpay.orders.fetch')
        expect(content).toContain('razorpay.payments.fetch')
        expect(content).toContain('activateInitialPurchase')
    })

    it('verifies billing page contains updated Full Suite pricing descriptions', () => {
        const content = readProjectFile('app/(dashboard)/owner/billing/page.tsx')
        expect(content).toContain('Weavly Full Suite')
        expect(content).toContain('₹17,700')
        expect(content).toContain('₹15,000')
        expect(content).toContain('₹7,000')
        expect(content).toContain('₹8,260')
        expect(content.toLowerCase()).not.toContain('₹2,360/month')
        expect(content.toLowerCase()).not.toContain('₹5,900/month')
        expect(content).not.toContain('AutoRenewToggle')
    })

    it('verifies SubscribeButton uses order_id and calls new endpoints', () => {
        const content = readProjectFile('components/billing/SubscribeButton.tsx')
        expect(content).toContain('/api/billing/create-order')
        expect(content).toContain('/api/billing/verify-payment')
        expect(content).toContain('order_id')
        expect(content).not.toContain('subscription_id: subscriptionId')
        expect(content).not.toContain('Auto-renew monthly')
    })

    it('verifies webhook route handles payment.captured and order.paid', () => {
        const content = readProjectFile('app/api/webhooks/razorpay/route.ts')
        expect(content).toContain("case 'payment.captured'")
        expect(content).toContain("case 'order.paid'")
        expect(content).toContain('activateInitialPurchase')
    })

    it('verifies AccessGate upgrade wall displays correct Weavly Full Suite info', () => {
        const content = readProjectFile('components/billing/AccessGate.tsx')
        expect(content).toContain('Weavly Full Suite')
        expect(content).toContain('₹15,000')
        expect(content).toContain('₹17,700')
    })

    it('verifies migration file is additive only and indexes razorpay_order_id', () => {
        const content = readProjectFile('supabase/migrations/20260708182000_billing_model_orders.sql')
        expect(content).toContain('ALTER TABLE public.org_subscriptions')
        expect(content).toContain('ADD COLUMN IF NOT EXISTS billing_model')
        expect(content).toContain('ADD COLUMN IF NOT EXISTS razorpay_order_id')
        expect(content).toContain('ADD COLUMN IF NOT EXISTS razorpay_payment_id')
        expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_org_subscriptions_razorpay_order_id')
    })

    it('verifies activateInitialPurchase helper has signature and duplicate checks for strong idempotency', () => {
        const content = readProjectFile('lib/billing-activation.ts')
        expect(content).toContain('activateInitialPurchase')
        expect(content).toContain('subscription_payments')
        expect(content).toContain('eq(\'razorpay_payment_id\', razorpayPaymentId)')
        expect(content).toContain('eq(\'razorpay_order_id\', razorpayOrderId)')
        expect(content).toContain('alreadyProcessed: true')
    })
})
