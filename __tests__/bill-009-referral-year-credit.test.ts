import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

describe('Annual referral credit policy', () => {
    const migration = read('supabase/migrations/20260810182342_referral_year_credits.sql')

    it('requires paid initial Base membership and protects referral data with owner-scoped RLS', () => {
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.referral_year_credits')
        expect(migration).toContain('CHECK (status IN (\'available\', \'redeemed\', \'revoked\'))')
        expect(migration).toContain('referral_has_paid_base_initial_purchase')
        expect(migration).toContain('referral_is_active_base_member')
        expect(migration).toContain('ALTER TABLE public.referral_year_credits ENABLE ROW LEVEL SECURITY')
        expect(migration).toContain('owners_see_own_year_credits')
        expect(migration).toContain('TO authenticated')
        expect(migration).toContain('TO service_role')
    })

    it('serializes conversion, caps rewards at five, and never creates a discount window', () => {
        expect(migration).toContain('pg_advisory_xact_lock')
        expect(migration).toContain('IF v_credit_count >= 5 THEN')
        expect(migration).toContain("'referral_cap_reached'")
        expect(migration).toContain("'referee_initial_base_payment_required'")
        expect(migration).toContain("'referrer_active_base_required'")
        expect(migration).not.toContain('INSERT INTO public.referral_discount_windows')
    })

    it('redeems one credit only in the final 30-day renewal window as a free entitlement', () => {
        expect(migration).toContain('redeem_referral_year_credit')
        expect(migration).toContain("v_current_end > v_now + interval '30 days'")
        expect(migration).toContain("'referral_free_annual_renewal'")
        expect(migration).toContain("'renewal'")
        expect(migration).toContain("'activeUntil'")
        expect(migration).toContain('checkout_amount_paise,')
        expect(migration).toContain('NULL,')
    })
})

describe('Annual referral application and redemption wiring', () => {
    it('keeps payment callbacks on the conversion path and removes referral refunds', () => {
        const webhook = read('app/api/webhooks/razorpay/route.ts')
        const activation = read('lib/billing-activation.ts')
        const helper = read('lib/referral-webhook.ts')

        expect(webhook).toContain('processReferralConversion')
        expect(activation).toContain('processReferralConversion')
        expect(webhook).not.toContain('issueReferralRefund')
        expect(activation).not.toContain('issueReferralRefund')
        expect(helper).not.toContain('createIdempotentRazorpayRefund')
    })

    it('restricts redemption to owner sessions and the service-role RPC', () => {
        const route = read('app/api/billing/redeem-referral-year/route.ts')
        const button = read('components/billing/ReferralRewardButton.tsx')
        const card = read('components/billing/ReferralCard.tsx')

        expect(route).toContain("requireRole(['owner'])")
        expect(route).toContain("rpc('redeem_referral_year_credit'")
        expect(button).toContain("'/api/billing/redeem-referral-year'")
        expect(card).toContain('initial Weavly Base payment is required')
        expect(card).toContain('capped at five')
    })
})
