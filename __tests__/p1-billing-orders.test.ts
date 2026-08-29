import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BILLING_MODEL, BILLING_PLANS, getBillingPrice, RENEWAL_ELIGIBILITY_DAYS } from '../lib/billing-constants'
import { readBillingOrderContext, resolveBillingPurchase, type BillingSubscriptionRow } from '../lib/billing-lifecycle'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P1 Billing Orders Static Analysis Tests', () => {
    
    it('verifies billing-constants.ts contains the correct pricing values', () => {
        expect(BILLING_PLANS.lite).toMatchObject({ firstYearTotalPaise: 299900, renewalTotalPaise: 149900 })
        expect(BILLING_PLANS.base).toMatchObject({ firstYearTotalPaise: 999900, renewalTotalPaise: 499900 })
        expect(BILLING_PLANS.premium).toMatchObject({ firstYearTotalPaise: 2950000, renewalTotalPaise: 826000 })
        const content = readProjectFile('lib/billing-constants.ts')
        expect(content).toContain("BILLING_MODEL = 'upfront_first_year_plus_annual_renewal'")
    })

    it('verifies create-order API route uses correct order amount and notes', () => {
        const content = readProjectFile('app/api/billing/create-order/route.ts')
        expect(content).toContain('getBillingPlan')
        expect(content).toContain('plan_tier')
        expect(content).toContain('BILLING_MODEL')
        expect(content).toContain('resolveBillingPurchase')
        expect(content).toContain('purchase_type')
        expect(content).toContain('base_amount_paise')
        expect(content).toContain('gst_paise')
        expect(content).toContain('total_paise')
        expect(content).toContain("currency: 'INR'")
        expect(content).toContain('checkout_purchase_type')
        expect(content).toContain('checkout_amount_paise')
        expect(content).toContain('checkout_currency')
    })

    it('verifies verify-payment API route uses HMAC SHA256 and shared reconciliation', () => {
        const content = readProjectFile('app/api/billing/verify-payment/route.ts')
        expect(content).toContain('createHmac')
        expect(content).toContain('sha256')
        expect(content).toContain('reconcileBillingOrder')
        expect(content).toContain("source: 'callback'")
        expect(content).toContain('Do not pay again')
    })

    it('verifies billing page contains the Lite and Base pricing descriptions', () => {
        const content = readProjectFile('app/(dashboard)/owner/billing/page.tsx')
        expect(content).toContain('Weavly Lite')
        expect(content).toContain('Weavly Base')
        expect(content).toContain('Complete costing desk')
        expect(content).toContain('Everything in Lite')
        expect(content).toContain('Manual annual renewal from year 2')
        expect(content).toContain('activeRenewalPrice')
        expect(content).toContain("subscriptionTier === 'lite'")
        expect(content).toContain('Payment history')
        expect(content).toContain('Download receipt')
        expect(content.toLowerCase()).not.toContain('₹2,360/month')
        expect(content.toLowerCase()).not.toContain('₹5,900/month')
        expect(content).not.toContain('Weavly Full Suite')
        expect(content).not.toContain('AutoRenewToggle')
    })

    it('keeps public landing pricing aligned with the annual billing catalog', () => {
        const content = readProjectFile('components/landing/pricing.tsx')
        expect(content).toContain('BILLING_PLANS')
        expect(content).toContain('First year')
        expect(content).toContain('Renewal from year 2')
        expect(content).toContain('Weavly Lite')
        expect(content).toContain('Weavly Base')
        expect(content).not.toContain('/month')
        expect(content).not.toContain('Weavly Full Suite')
    })

    it('verifies SubscribeButton uses order_id and calls new endpoints', () => {
        const content = readProjectFile('components/billing/SubscribeButton.tsx')
        expect(content).toContain('/api/billing/create-order')
        expect(content).toContain('/api/billing/status')
        expect(content).toContain('order_id')
        expect(content).toContain('purchaseType')
        expect(content).toContain('clientRequestId')
        expect(content).toContain('Check payment status')
        expect(content).toContain('Do not pay again')
        expect(content).not.toContain('subscription_id: subscriptionId')
        expect(content).not.toContain('Auto-renew monthly')
    })

    it('verifies webhook route handles payment.captured and order.paid', () => {
        const content = readProjectFile('app/api/webhooks/razorpay/route.ts')
        expect(content).toContain("case 'payment.captured'")
        expect(content).toContain("case 'order.paid'")
        expect(content).toContain('reconcileBillingOrder')
        expect(content).toContain("case 'payment.authorized'")
        expect(content).toContain('readBillingOrderContext')
        expect(content).toContain('orderContext.orgId')
    })

    it('verifies AccessGate upgrade wall displays correct Weavly Base production info', () => {
        const content = readProjectFile('components/billing/AccessGate.tsx')
        expect(content).toContain('Weavly Base')
        expect(content).toContain("getBillingPrice('base', 'initial_purchase')")
        expect(content).toContain("getBillingPrice('base', 'renewal')")
        expect(content).toContain('Take your costing into production')
        expect(content).toContain('featureName')
    })

    it('verifies migration file is additive only and indexes razorpay_order_id', () => {
        const content = readProjectFile('supabase/migrations/20260708182000_billing_model_orders.sql')
        expect(content).toContain('ALTER TABLE public.org_subscriptions')
        expect(content).toContain('ADD COLUMN IF NOT EXISTS billing_model')
        expect(content).toContain('ADD COLUMN IF NOT EXISTS razorpay_order_id')
        expect(content).toContain('ADD COLUMN IF NOT EXISTS razorpay_payment_id')
        expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_org_subscriptions_razorpay_order_id')
    })

    it('verifies activateInitialPurchase delegates to the atomic activation RPC', () => {
        const content = readProjectFile('lib/billing-activation.ts')
        expect(content).toContain('activateInitialPurchase')
        expect(content).toContain("rpc('activate_order_billing_purchase'")
        expect(content).toContain('p_purchase_type: purchaseType')
        expect(content).toContain("p_currency: 'INR'")
        expect(content).toContain('alreadyProcessed: boolean')
        expect(content).toContain('processReferralConversion')
        expect(content).not.toContain('issueReferralRefund')
    })

    it('verifies the atomic activation migration locks, binds, validates, and extends billing periods', () => {
        const content = readProjectFile('supabase/migrations/20260710112640_estimator_billing_atomic_activation.sql')
        expect(content).toContain('SECURITY DEFINER')
        expect(content).toContain('pg_advisory_xact_lock')
        expect(content).toContain('idx_org_subscriptions_razorpay_order_id_unique')
        expect(content).toContain('idx_subscription_payments_captured_order_unique')
        expect(content).toContain('checkout_purchase_type')
        expect(content).toContain('checkout_amount_paise')
        expect(content).toContain('checkout_currency')
        expect(content).toContain("p_purchase_type = 'renewal' AND NOT v_has_target_history")
        expect(content).toContain("current_end = v_anchor + interval '365 days'")
        expect(content).toContain('REVOKE ALL ON FUNCTION')
        expect(content).toContain('TO service_role')
    })

    it('backs renewal pricing with captured or otherwise proven paid history in the database', () => {
        const content = readProjectFile('supabase/migrations/20260730214000_reject_unearned_billing_renewal_pricing.sql')
        expect(content).toContain('enforce_paid_history_for_billing_renewal')
        expect(content).toContain("payment.status = 'captured'")
        expect(content).toContain("history.status IN ('active', 'authenticated', 'paused', 'completed', 'expired')")
        expect(content).not.toContain("'halted', 'cancelled'")
        expect(content).toContain('history.current_start IS NOT NULL')
        expect(content).toContain('history.current_end IS NOT NULL')
        expect(content).toContain('BEFORE INSERT OR UPDATE OF')
        expect(content).toContain('Renewal pricing requires prior captured or paid history')
    })

    it('enforces the 30-day manual renewal window in the database backstop', () => {
        const content = readProjectFile('supabase/migrations/20260801100000_manual_renewal_window.sql')
        expect(content).toContain('enforce_manual_renewal_window')
        expect(content).toContain("interval '30 days'")
        expect(content).toContain('BEFORE INSERT OR UPDATE OF')
    })

    it('derives first-year and renewal pricing from paid lifecycle history, never trial state', () => {
        const now = new Date('2026-07-10T00:00:00.000Z')
        const trial: BillingSubscriptionRow = {
            id: 'trial',
            plan_tier: 'trial',
            status: 'active',
            current_end: '2026-07-15T00:00:00.000Z',
        }
        expect(resolveBillingPurchase([trial], [], 'base', now)).toMatchObject({
            allowed: true,
            purchaseType: 'initial_purchase',
        })
        const activeBase: BillingSubscriptionRow = {
            id: 'base-paid',
            plan_tier: 'base',
            status: 'active',
            current_end: '2027-01-01T00:00:00.000Z',
        }
        expect(resolveBillingPurchase([activeBase], [], 'base', now)).toMatchObject({
            allowed: false,
            purchaseType: 'renewal',
            periodStart: '2027-01-01T00:00:00.000Z',
        })
        expect(resolveBillingPurchase([activeBase], [], 'base', now).reason).toContain(`${RENEWAL_ELIGIBILITY_DAYS} days`)
        expect(resolveBillingPurchase([{
            ...activeBase,
            current_end: '2026-07-25T00:00:00.000Z',
        }], [], 'base', now)).toMatchObject({
            allowed: true,
            purchaseType: 'renewal',
        })
    })

    it('keeps a failed first-purchase checkout on first-year pricing even when Razorpay assigned a payment ID', () => {
        const now = new Date('2026-07-30T00:00:00.000Z')
        const failedBase: BillingSubscriptionRow = {
            id: 'base-failed-first-purchase',
            plan_tier: 'base',
            status: 'halted',
            current_end: null,
            razorpay_order_id: 'order_failed_first_purchase',
        }

        expect(resolveBillingPurchase(
            [failedBase],
            [{
                subscription_id: failedBase.id,
                status: 'failed',
                razorpay_order_id: failedBase.razorpay_order_id,
                razorpay_payment_id: 'pay_failed_first_purchase',
            }],
            'base',
            now,
        )).toMatchObject({
            allowed: true,
            purchaseType: 'initial_purchase',
            periodStart: now.toISOString(),
        })
        expect(getBillingPrice('base', 'initial_purchase').totalPaise).toBe(999900)
    })

    it('keeps halted or cancelled paid history eligible for renewal only with payment proof', () => {
        const now = new Date('2026-07-30T00:00:00.000Z')
        const haltedBase: BillingSubscriptionRow = {
            id: 'base-halted-paid',
            plan_tier: 'base',
            status: 'halted',
            current_end: null,
        }
        const cancelledBase: BillingSubscriptionRow = {
            id: 'base-cancelled-paid',
            plan_tier: 'base',
            status: 'cancelled',
            current_end: null,
            razorpay_subscription_id: 'sub_created_but_never_paid',
        }

        expect(resolveBillingPurchase([haltedBase, cancelledBase], [], 'base', now)).toMatchObject({
            purchaseType: 'initial_purchase',
        })
        expect(resolveBillingPurchase(
            [haltedBase, cancelledBase],
            [{ subscription_id: haltedBase.id, status: 'captured' }],
            'base',
            now,
        )).toMatchObject({
            purchaseType: 'renewal',
        })

        expect(resolveBillingPurchase(
            [{
                ...cancelledBase,
                current_start: '2025-07-30T00:00:00.000Z',
                current_end: '2026-07-29T00:00:00.000Z',
            }],
            [],
            'base',
            now,
        )).toMatchObject({
            purchaseType: 'renewal',
        })
    })

    it('blocks an active legacy operations downgrade and uses renewal prices for current tiers', () => {
        const now = new Date('2026-07-10T00:00:00.000Z')
        const activePremium: BillingSubscriptionRow = {
            id: 'premium-paid',
            plan_tier: 'premium',
            status: 'active',
            current_end: '2026-12-31T00:00:00.000Z',
        }
        expect(resolveBillingPurchase([activePremium], [], 'base', now)).toMatchObject({
            allowed: false,
        })
        expect(getBillingPrice('base', 'renewal').totalPaise).toBe(499900)
        expect(getBillingPrice('premium', 'renewal').totalPaise).toBe(826000)
    })

    it('binds plan, purchase type, amount split, currency, model, and access days in order context', () => {
        const validOrder = {
            amount: 499900,
            currency: 'INR',
            notes: {
                org_id: 'org-1',
                plan_tier: 'base',
                payment_type: 'renewal',
                purchase_type: 'renewal',
                billing_model: BILLING_MODEL,
                base_amount_paise: '423644',
                gst_paise: '76256',
                total_paise: '499900',
                currency: 'INR',
                access_days: '365',
            },
        }

        expect(readBillingOrderContext(validOrder)).toEqual({
            orgId: 'org-1',
            planTier: 'base',
            purchaseType: 'renewal',
            amountPaise: 499900,
        })
        expect(readBillingOrderContext({ ...validOrder, amount: 999900 })).toBeNull()
        expect(readBillingOrderContext({ ...validOrder, currency: 'USD' })).toBeNull()
        expect(readBillingOrderContext({
            ...validOrder,
            notes: { ...validOrder.notes, purchase_type: 'initial_purchase' },
        })).toBeNull()
    })
})
