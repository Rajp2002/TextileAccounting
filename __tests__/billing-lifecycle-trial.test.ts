import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    resolveBillingCheckoutPresentation,
    resolveBillingPurchase,
    type BillingSubscriptionRow,
} from '../lib/billing-lifecycle'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

const now = new Date('2026-07-10T00:00:00.000Z')

// A Lite trial: an active entitlement row with no Razorpay ids, 27 days left.
const liteTrial: BillingSubscriptionRow = {
    id: 'lite-trial',
    plan_tier: 'lite',
    status: 'active',
    current_start: '2026-07-10T00:00:00.000Z',
    current_end: '2026-08-06T00:00:00.000Z',
    is_trial: true,
}

describe('Billing lifecycle ignores Lite trial rows', () => {
    it('trial then pay is an initial_purchase and allowed immediately', () => {
        expect(resolveBillingPurchase([liteTrial], [], 'lite', now)).toMatchObject({
            allowed: true,
            purchaseType: 'initial_purchase',
            periodStart: now.toISOString(),
        })
    })

    it('a trial row is not renewal history for pricing', () => {
        // Even when a trial row carries payment-looking evidence, it must not
        // become paid history for either the lite or the base target.
        const trialWithPaymentProof: BillingSubscriptionRow = {
            ...liteTrial,
            razorpay_payment_id: 'pay_should_not_count',
            razorpay_subscription_id: 'sub_should_not_count',
        }
        expect(resolveBillingPurchase(
            [trialWithPaymentProof],
            [{ subscription_id: liteTrial.id, status: 'captured' }],
            'lite',
            now,
        )).toMatchObject({
            allowed: true,
            purchaseType: 'initial_purchase',
            periodStart: now.toISOString(),
        })

        // A trial row must never block a Base purchase as an active Base period.
        const baseTrial: BillingSubscriptionRow = {
            ...liteTrial,
            id: 'base-trial',
            plan_tier: 'base',
        }
        expect(resolveBillingPurchase([baseTrial], [], 'base', now)).toMatchObject({
            allowed: true,
            purchaseType: 'initial_purchase',
            periodStart: now.toISOString(),
        })
        expect(resolveBillingPurchase([baseTrial], [], 'lite', now)).toMatchObject({
            allowed: true,
            purchaseType: 'initial_purchase',
        })
    })

    it('a real paid lite row still gives renewal pricing', () => {
        const paidLite: BillingSubscriptionRow = {
            id: 'lite-paid',
            plan_tier: 'lite',
            status: 'active',
            is_trial: false,
            current_start: '2026-06-01T00:00:00.000Z',
            current_end: '2026-07-25T00:00:00.000Z',
            razorpay_payment_id: 'pay_paid_lite',
        }
        expect(resolveBillingPurchase([paidLite], [], 'lite', now)).toMatchObject({
            allowed: true,
            purchaseType: 'renewal',
            periodStart: '2026-07-25T00:00:00.000Z',
        })

        // A trial row alongside the paid row does not change renewal pricing or
        // the period start, which still comes from the paid row.
        expect(resolveBillingPurchase([liteTrial, paidLite], [], 'lite', now)).toMatchObject({
            allowed: true,
            purchaseType: 'renewal',
            periodStart: '2026-07-25T00:00:00.000Z',
        })
    })

    it('a trial row never hides a retryable checkout as the latest row', () => {
        // The checkout is older than the 15-minute pending window, so it is retryable.
        // The trial was created after it and must not be read as the latest checkout.
        const staleCheckout: BillingSubscriptionRow = {
            id: 'lite-checkout-stale',
            plan_tier: 'lite',
            status: 'created',
            current_end: null,
            razorpay_order_id: 'order_stale',
            created_at: '2026-07-09T22:00:00.000Z',
        }
        const trialAfterCheckout: BillingSubscriptionRow = {
            ...liteTrial,
            created_at: '2026-07-09T23:50:00.000Z',
        }
        expect(resolveBillingCheckoutPresentation([staleCheckout, trialAfterCheckout], [], now)).toMatchObject({
            state: 'retryable',
            subscription: staleCheckout,
        })
    })

    it('a fresh pending checkout stays pending when a trial is newer', () => {
        const freshCheckout: BillingSubscriptionRow = {
            id: 'lite-checkout-fresh',
            plan_tier: 'lite',
            status: 'created',
            current_end: null,
            razorpay_order_id: 'order_fresh',
            created_at: '2026-07-09T23:55:00.000Z',
        }
        const trialNewer: BillingSubscriptionRow = {
            ...liteTrial,
            created_at: '2026-07-09T23:58:00.000Z',
        }
        expect(resolveBillingCheckoutPresentation([freshCheckout, trialNewer], [], now)).toMatchObject({
            state: 'pending',
            subscription: freshCheckout,
        })
    })

    it('a trial alone is no checkout at all', () => {
        expect(resolveBillingCheckoutPresentation([liteTrial], [], now)).toEqual({ state: 'none', subscription: null })
    })

    it('reads is_trial in the org_subscriptions selects that build billing rows', () => {
        const selectPattern = /\.from\('org_subscriptions'\)\s*\.select\('[^']*\bis_trial\b[^']*'\)/
        expect(readProjectFile('app/api/billing/create-order/route.ts')).toMatch(selectPattern)
        expect(readProjectFile('app/(dashboard)/owner/billing/page.tsx')).toMatch(selectPattern)
    })
})
