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
        // The title matches the sidebar entry.
        expect(ownerBilling).toMatch(/<PageHeader\s+title="Plan & Billing"\s+actions=\{<>\s*<BillingGuide \/>\s*\{primaryPlanAction\}/)

        // The plan at a glance: name, status, dates and renewal price, then what it includes
        expect(ownerBilling).toContain('id="current-plan-heading"')
        expect(ownerBilling).toContain('Your plan')
        expect(ownerBilling).toContain("label: 'Access until'")
        expect(ownerBilling).toContain("label: 'Renewal price'")
        expect(ownerBilling).toContain('<PlanIncludesTiles tier={shownTier} />')
        expect(readFileSync(join(process.cwd(), 'components/billing/PlanIncludesTiles.tsx'), 'utf8')).toContain('PLAN_INCLUDES[tier]')

        // Payments are listed in place with their receipts
        expect(ownerBilling).toContain('Annual renewals are manual')
        expect(ownerBilling).toContain('id="billing-history-heading"')
        expect(ownerBilling).toContain('Payments &amp; receipts')
        expect(ownerBilling).toContain('<PaymentHistoryList entries={billingHistoryEntries}')
        expect(ownerBilling).toContain('<BillingGuide />')
        // Referral rewards appear only for an owner who has a referral code.
        expect(ownerBilling).toContain('id="billing-referral-heading"')
        expect(ownerBilling).toContain('Referral rewards')
        expect(ownerBilling).toContain('{(failed || eligible) && (')
    })

    it('2. Paid and free billing pages link to the standalone plan comparison', () => {
        expect(ownerBilling).toContain('href="/plans?from=billing"')
        expect(ownerBilling).toContain('<span>View plans</span>')

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
