import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

// ── 1. Database-level unique guards ──────────────────────────────────────────

describe('P1 Razorpay Idempotency: Database Guards', () => {
    const migration = readProjectFile(
        'supabase/migrations/20260509180000_razorpay_idempotency_unique_guards.sql'
    )

    it('adds a unique index on referral_refunds.razorpay_payment_id', () => {
        expect(migration).toContain('idx_referral_refunds_payment_id_unique')
        expect(migration).toContain('ON public.referral_refunds(razorpay_payment_id)')
        // Must be a unique index, not a plain one
        expect(migration.toUpperCase()).toContain('CREATE UNIQUE INDEX')
    })

    it('does not touch live-mode KYC, PAN, bank, GST, or incorporation logic', () => {
        const forbidden = ['kyc', 'pan', 'gst', 'bank_account', 'incorporation', 'live_mode']
        for (const term of forbidden) {
            expect(migration.toLowerCase()).not.toContain(term)
        }
    })
})

// ── 2. App-level pre-checks remain present (fast-path) ────────────────────────

describe('P1 Razorpay Webhook Idempotency Guard', () => {
    const routeContent = readProjectFile('app/api/webhooks/razorpay/route.ts')

    it('signature verification is present', () => {
        expect(routeContent).toContain('verifyRazorpaySignature')
        expect(routeContent).toContain('crypto.timingSafeEqual')
    })

    it('app-level pre-check for existing payment in subscription.charged', () => {
        // Fast-path check before touching DB / billing period
        expect(routeContent).toContain('Payment ${payment.id} already processed')
    })

    it('handles unique-violation (23505) from subscription_payments insert in subscription.charged', () => {
        // Database-level race safety
        expect(routeContent).toContain("insertError.code === '23505'")
        // Referral refund must NOT be issued when insert fails
        expect(routeContent).toContain('skipping refund')
    })

    it('referral refund only fires after a successful insert', () => {
        // issueReferralRefund must come after the error-check block, not unconditionally
        const chargedBlock = routeContent.slice(
            routeContent.indexOf("case 'subscription.charged'"),
            routeContent.indexOf("case 'subscription.halted'")
        )
        const insertErrorIdx = chargedBlock.indexOf("insertError.code === '23505'")
        const refundIdx      = chargedBlock.indexOf('issueReferralRefund')
        expect(insertErrorIdx).toBeGreaterThan(0)
        expect(refundIdx).toBeGreaterThan(insertErrorIdx)
    })

    it('app-level pre-check for existing failed payment in payment.failed', () => {
        expect(routeContent).toContain('Failed payment ${payment.id} already recorded')
    })

    it('handles unique-violation (23505) from subscription_payments insert in payment.failed', () => {
        expect(routeContent).toContain("failedInsertError.code === '23505'")
    })
})

// ── 3. Referral refund helper ─────────────────────────────────────────────────

describe('P1 Referral Refund Idempotency Guard', () => {
    const helperContent = readProjectFile('lib/referral-webhook.ts')

    it('app-level pre-check for existing refund in issueReferralRefund', () => {
        expect(helperContent).toContain('Refund already processed for payment ${paymentId}')
        expect(helperContent).toContain('maybeSingle()')
    })

    it('does not contain live-mode onboarding, KYC, or bank-setup logic', () => {
        const forbidden = ['kyc', 'pan', 'gst', 'bank_account', 'incorporation', 'live_mode']
        for (const term of forbidden) {
            expect(helperContent.toLowerCase()).not.toContain(term)
        }
    })
})
