import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

describe('Staged annual referral rewards', () => {
    const migration = read('supabase/migrations/20260814150155_referral_staged_annual_rewards.sql')
    const referral = read('lib/referral.ts')
    const card = read('components/billing/ReferralCard.tsx')
    const button = read('components/billing/ReferralRewardButton.tsx')
    const route = read('app/api/billing/redeem-referral-year/route.ts')

    it('keeps the annual cap in a calendar-year ledger bucket', () => {
        expect(migration).toContain('credit_year integer')
        expect(migration).toContain("credit.credit_year = v_referral_year")
        expect(migration).toContain('maximum five credits per referrer per India calendar year')
        expect(migration).toContain("'year', v_referral_year")
    })

    it('redeems every active credit as consecutive future entitlements without a renewal-window gate', () => {
        expect(migration).toContain("AND credit.status = 'available'")
        expect(migration).toContain('FOR v_credit IN')
        expect(migration).toContain('v_redeemed_count := v_redeemed_count + 1')
        expect(migration).toContain("'redeemedCount', v_redeemed_count")
        expect(migration).not.toContain("v_current_end > v_now + interval '30 days'")
    })

    it('maps the user-facing referral stages and exposes one-click stacking', () => {
        expect(referral).toContain("export type ReferralHistoryStatus = 'used' | 'active'")
        expect(referral).toContain("? 'active'")
        expect(referral).toContain(": 'used'")
        expect(card).toContain('>Used</p>')
        expect(card).toContain('>Active</p>')
        expect(card).toContain('Referral activity')
        expect(button).toContain('Redeem all active referrals')
        expect(route).toContain('redeemedCount')
    })
})
