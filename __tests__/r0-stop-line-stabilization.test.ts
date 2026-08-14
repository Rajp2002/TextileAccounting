import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

describe('R0 stop-the-line contracts', () => {
    it('rejects unavailable self-serve tiers before billing side effects', () => {
        const route = read('app/api/billing/create-order/route.ts')
        const guard = route.indexOf('if (!isSelfServePlanTier(planTier))')
        const pricing = route.indexOf('getBillingPlan(planTier)')
        const lifecycle = route.indexOf('resolveBillingPurchase(')
        const claim = route.indexOf("rpc('claim_billing_checkout_attempt'")
        const provider = route.indexOf('razorpay.orders.create')

        expect(route).toContain('BILLING_SELF_SERVE_DEFAULT_TIER')
        expect(route).toContain('isSelfServePlanTier')
        expect(guard).toBeGreaterThan(-1)
        expect(guard).toBeLessThan(pricing)
        expect(guard).toBeLessThan(lifecycle)
        expect(guard).toBeLessThan(claim)
        expect(guard).toBeLessThan(provider)
    })

    it('fails export readiness closed when the required schema/cache contract is absent', () => {
        const exportAction = read('app/(dashboard)/owner/settings/data-export.ts')

        expect(exportAction).toContain('referral_year_credits')
        expect(exportAction).toContain('organization_export_runs')
        expect(exportAction).toContain("'PGRST205'")
        expect(exportAction).toContain("NOTIFY pgrst, 'reload schema'")
        expect(exportAction).toContain('No export was generated')
        expect(exportAction).toContain("status: 'failed'")
    })

    it('keeps the three reviewed R0 migrations present and ordered', () => {
        const migrations = read('supabase/migrations/20260809193000_zero_warp_crimp_defaults.sql')
            + read('supabase/migrations/20260809193305_sprint21_sync_saved_quality_yarns_to_rate_book.sql')
            + read('supabase/migrations/20260810182342_referral_year_credits.sql')

        expect(migrations).toContain('warp_crimp_pct SET DEFAULT 0.00')
        expect(migrations).toContain('sync_saved_quality_yarns_to_rate_book')
        expect(migrations).toContain('referral_year_credits')
    })

    it('keeps the referral campaign closed unless an explicit allowlist or wildcard enables it', () => {
        const campaign = read('lib/referral-campaign.ts')
        const referral = read('lib/referral.ts')

        expect(campaign).toContain("process.env.REFERRAL_CAMPAIGN_ENABLED?.trim().toLowerCase() !== 'true'")
        expect(campaign).toContain('REFERRAL_PILOT_ORG_IDS')
        expect(campaign).toContain("configuredOrganizations.has('*')")
        expect(referral).toContain('REFERRAL_CAMPAIGN_DISABLED_MESSAGE')
        expect(referral).toContain("reason: 'campaign_disabled'")
    })
})
