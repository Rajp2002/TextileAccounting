import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Standardized Subscription & Billing for Paid Plans (Lite & Base)', () => {
    const ownerBilling = read('app/(dashboard)/owner/billing/page.tsx')
    const freeBilling = read('app/free/billing/FreeBillingClient.tsx')
    const planChooser = read('components/plans/PlanChooserClient.tsx')

    it('1. Owner billing page renders standard sections matching Free plan architecture', () => {
        // Page Header
        expect(ownerBilling).toContain('Subscription & Billing')
        expect(ownerBilling).toContain('View your active workspace status, explore available plans, and manage billing history.')

        // Section 1: Active Workspace
        expect(ownerBilling).toContain('id="active-workspace-heading"')
        expect(ownerBilling).toContain('Active Workspace')
        expect(ownerBilling).toContain('Weavly Lite workspace')
        expect(ownerBilling).toContain('Weavly Base workspace')
        expect(ownerBilling).toContain('Costing Desk')
        expect(ownerBilling).toContain('Saved Costings')
        expect(ownerBilling).toContain('Connected Production')
        expect(ownerBilling).toContain('Plan Status')

        // Section 2: Choose your plan (Available Plans & Upgrades)
        expect(ownerBilling).toContain('id="view-plans-heading"')
        expect(ownerBilling).toContain('Available Plans & Upgrades')
        expect(ownerBilling).toContain('Choose your plan')

        // Section 3: Billing & Invoices
        expect(ownerBilling).toContain('id="billing-history-heading"')
        expect(ownerBilling).toContain('Billing & Invoices')
        expect(ownerBilling).toContain('<PaymentHistoryDialog entries={billingHistoryEntries}')

        // Section 4: Referral rewards
        expect(ownerBilling).toContain('Referral rewards')

        // Section 5: Value proposition highlights
        expect(ownerBilling).toContain('Instant Plan Activation')
        expect(ownerBilling).toContain('Official GST Invoices')
        expect(ownerBilling).toContain('Secure Razorpay Processing')

        // Section 6: Trust & Policy footer banner
        expect(ownerBilling).toContain('Secure Razorpay payment gateway · Transparent flat pricing · No lock-in, cancel or upgrade anytime')
    })

    it('2. Choose your plan has both a CTA button and pill linking to /plans?from=billing', () => {
        // Owner billing has CTA link to /plans?from=billing
        expect(ownerBilling).toContain('<Link href="/plans?from=billing"')
        expect(ownerBilling).toContain('Explore plans')

        // Owner billing has clickable pill link to /plans?from=billing
        expect(ownerBilling).toContain('href="/plans?from=billing"')
        expect(ownerBilling).toContain("subscriptionTier === 'lite'\n                                            ? 'Upgrade to Base'")

        // Free billing has both CTA and clickable pill to /plans?from=billing
        expect(freeBilling).toContain('<Link href="/plans?from=billing"')
        expect(freeBilling).toContain('Recommended')
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
