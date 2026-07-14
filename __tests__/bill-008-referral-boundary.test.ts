import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const referralSource = readFileSync('lib/referral.ts', 'utf8')
const applyRouteSource = readFileSync('app/api/referrals/apply/route.ts', 'utf8')
const signupSource = readFileSync('app/(auth)/actions/auth.ts', 'utf8')

describe('BILL-008 referral application boundary', () => {
    it('keeps referral application server-only and writes through the guarded admin client', () => {
        const applyStart = referralSource.indexOf('export async function applyReferralCode')
        const applyBody = referralSource.slice(applyStart)

        expect(referralSource).toContain("import 'server-only'")
        expect(referralSource).toContain("import { createAdminClient } from '@/lib/supabase/admin'")
        expect(applyBody).toContain('const supabase = createAdminClient()')
        expect(applyBody).not.toContain('await createClient()')
    })

    it('rejects self-referral before insert and maps duplicate use to a stable error', () => {
        const applyStart = referralSource.indexOf('export async function applyReferralCode')
        const applyBody = referralSource.slice(applyStart)
        const selfGuard = applyBody.indexOf('codeRow.org_id === refereeOrgId')
        const insert = applyBody.indexOf(".from('referral_uses')")

        expect(selfGuard).toBeGreaterThan(-1)
        expect(insert).toBeGreaterThan(selfGuard)
        expect(applyBody).toContain('Cannot use your own referral code')
        expect(applyBody).toContain('Referral code already applied for this organization')
    })

    it('derives the referee organization at both server call sites', () => {
        expect(applyRouteSource).toContain("const { profile } = await requireRole(['owner'])")
        expect(applyRouteSource).toContain('await applyReferralCode(referralCode, profile.org_id)')
        expect(signupSource).toContain('await applyReferralCode(parsed.data.referralCode, org.id)')
    })
})
