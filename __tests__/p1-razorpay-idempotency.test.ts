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
        // Database-level race safety. The winning event owns referral
        // conversion; the losing event exits and the idempotent path retries.
        expect(routeContent).toContain("paymentWriteError.code === '23505'")
        expect(routeContent).toContain('referral conversion will be retried by the winning event')
    })

    it('referral conversion only fires after a successful insert', () => {
        // Conversion must come after the payment write error-check block.
        const chargedBlock = routeContent.slice(
            routeContent.indexOf("case 'subscription.charged'"),
            routeContent.indexOf("case 'subscription.halted'")
        )
        const insertErrorIdx = chargedBlock.indexOf("paymentWriteError.code === '23505'")
        const conversionIdx = chargedBlock.lastIndexOf('processReferralConversion')
        expect(insertErrorIdx).toBeGreaterThan(0)
        expect(conversionIdx).toBeGreaterThan(insertErrorIdx)
        expect(chargedBlock).not.toContain('issueReferralRefund')
    })

    it('app-level pre-check for existing failed payment in payment.failed', () => {
        expect(routeContent).toContain('Failed payment ${payment.id} already recorded')
    })

    it('handles unique-violation (23505) from subscription_payments insert in payment.failed', () => {
        expect(routeContent).toContain("failedInsertError.code === '23505'")
    })
})

// ── 3. Annual referral credit helper ──────────────────────────────────────────

describe('P1 Annual Referral Credit Guard', () => {
    const helperContent = readProjectFile('lib/referral-webhook.ts')
    const migration = readProjectFile('supabase/migrations/20260810182342_referral_year_credits.sql')

    it('uses one atomic database credit claim and never calls a provider refund', () => {
        expect(helperContent).toContain("rpc('claim_referral_conversion'")
        expect(helperContent).not.toContain('createIdempotentRazorpayRefund')
        expect(helperContent).not.toContain('issueReferralRefund')
        expect(migration).toContain('referral_year_credits')
        expect(migration).toContain('referral_free_annual_renewal')
        expect(migration).toContain("'annual_credit_policy'")
    })

    it('does not contain live-mode onboarding, KYC, or bank-setup logic', () => {
        const forbidden = ['kyc', 'pan', 'gst', 'bank_account', 'incorporation', 'live_mode']
        for (const term of forbidden) {
            expect(helperContent.toLowerCase()).not.toContain(term)
        }
    })
})

describe('P1 Referral Conversion Idempotency Guard', () => {
    const helperContent = readProjectFile('lib/referral-webhook.ts')
    const creditMigration = readProjectFile('supabase/migrations/20260810182342_referral_year_credits.sql')

    it('delegates conversion to one atomic database claim', () => {
        expect(helperContent).toContain("rpc('claim_referral_conversion'")
        expect(creditMigration).toContain('FOR UPDATE')
        expect(creditMigration).toContain("SET status = 'converted'")
    })

    it('serializes conversion, enforces the five-credit cap, and supports redemption', () => {
        expect(creditMigration).toContain('pg_advisory_xact_lock')
        expect(creditMigration).toContain("'alreadyProcessed', true")
        expect(creditMigration).toContain('referral_year_credits')
        expect(creditMigration).toContain('referral_cap_reached')
        expect(creditMigration).toContain('redeem_referral_year_credit')
    })

    it('confirms existing UNIQUE constraint on referral_use_id in migration', () => {
        const referralMigration = readProjectFile(
            'supabase/migrations/20260418000000_referral_scheme.sql'
        )
        expect(referralMigration).toContain('referral_use_id')
        expect(referralMigration).toContain('UNIQUE')
    })
})
