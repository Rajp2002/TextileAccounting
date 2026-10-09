import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { freeSupportingText } from '../lib/i18n/free-supporting'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Paid plan subscription and billing pages', () => {
    const ownerBilling = read('app/(dashboard)/owner/billing/page.tsx')
    const freeBilling = read('app/free/billing/FreeBillingClient.tsx')
    const planChooser = read('components/plans/PlanChooserClient.tsx')

    it('1. Owner billing page renders the current workspace, plan comparison, and billing sections', () => {
        // The Guide (billing document notes) and the plan action are the header's actions.
        expect(ownerBilling).toMatch(/<PageHeader\s+title="Subscription & Billing"\s+actions=\{<>\s*<BillingGuide \/>\s*\{primaryPlanAction\}/)

        // Active workspace and included capabilities
        expect(ownerBilling).toContain('id="active-workspace-heading"')
        expect(ownerBilling).toContain('Active workspace')
        expect(ownerBilling).toContain('Weavly Lite workspace')
        expect(ownerBilling).toContain('Weavly Base workspace')
        expect(ownerBilling).toContain('Current plan')
        expect(ownerBilling).toContain('Costing desk')
        expect(ownerBilling).toContain('Saved costings')
        expect(ownerBilling).toContain('Connected production')

        // Standalone plan comparison and billing history
        expect(ownerBilling).toContain('id="view-plans-heading"')
        expect(ownerBilling).toContain('Compare plan options')
        expect(ownerBilling).toContain('Annual renewals are manual')
        expect(ownerBilling).toContain('id="billing-history-heading"')
        expect(ownerBilling).toContain('Billing &amp; invoices')
        expect(ownerBilling).toContain('<PaymentHistoryDialog entries={billingHistoryEntries}')
        expect(ownerBilling).toContain('<BillingGuide />')
        // Referral rewards are a page section now, not a collapsed rail disclosure.
        expect(ownerBilling).toContain('id="billing-referral-heading"')
        expect(ownerBilling).toContain('Referral rewards')
    })

    it('2. Paid and free billing pages link to the standalone plan comparison', () => {
        expect(ownerBilling).toContain('href="/plans?from=billing"')
        expect(ownerBilling).toContain("subscriptionTier === 'lite' ? 'Upgrade to Base'")
        expect(ownerBilling).toContain("subscriptionTier === 'base' ? 'Compare plans'")
        expect(ownerBilling).toContain("'Explore plans'")

        expect(freeBilling).toContain('<Link href="/plans?from=billing"')
        expect(freeSupportingText('en', 'compare')).toBe('Compare plan options')
        expect(freeBilling).toContain('compareAllPlans')
    })

    it('3. Standalone plans page allows existing paid users to browse without premature auto-finalization', () => {
        // Check that auto-finalize effect requires isOnboarding
        expect(planChooser).toContain('if (!paid || !isOnboarding) return')
    })

    it('4. Inline UpgradeWall is removed from the owner billing flow in favor of the standalone upgrade wall', () => {
        // Confirm that the standalone page is the destination
        expect(ownerBilling).toContain('/plans?from=billing')
        // Confirm floating desktop aside rail is not used
        expect(ownerBilling).not.toContain('aside className="billing-payment-history-rail-desktop"')
    })
})
