import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BILLING_PLANS } from '@/lib/billing-constants'
import {
  UPGRADE_FEATURE_IMAGES,
  UPGRADE_PLAN_FEATURES,
  upgradeText,
} from '@/lib/upgrade-wall'
import { CARD_FEATURE_PREVIEWS } from '@/components/plans/PlanCard'

const root = process.cwd()
function read(file: string): string {
  return readFileSync(join(root, file), 'utf8')
}

describe('Standalone Plan Chooser & Upgrade Experience', () => {
  describe('ROUTE: Routing, Shell & Proxy Guarding', () => {
    it('ROUTE-01: proxy.ts allows /plans for owners during onboarding and pending plan selection', () => {
      const proxy = read('proxy.ts')

      // Verifies /plans bypasses onboarding block
      expect(proxy).toContain("!pathname.startsWith('/plans')")

      // Verifies plan_selection_pending redirects to /plans?from=onboarding
      expect(proxy).toContain("NextResponse.redirect(new URL('/plans?from=onboarding', request.url))")
    })

    it('ROUTE-02: onboarding plans compatibility page forwards to /plans?from=onboarding', () => {
      const onboardingPage = read('app/(auth)/onboarding/plans/page.tsx')
      expect(onboardingPage).toContain("redirect('/plans?from=onboarding')")
    })

    it('ROUTE-03: plan chooser layout is standalone and does not import application sidebar', () => {
      const layout = read('app/(plan-selection)/layout.tsx')
      expect(layout).not.toContain('owner-sidebar')
      expect(layout).not.toContain('supervisor-nav')
      expect(layout).toContain('PlanChooserHeader')
      expect(layout).toContain('BrandBackground')
    })

    it('ROUTE-04: header handles contextual return destinations and signout for onboarding', () => {
      const header = read('components/plans/PlanChooserHeader.tsx')

      // Contextual back routing
      expect(header).toContain("from === 'billing'")
      expect(header).toContain("from === 'estimator'")
      expect(header).toContain("from === 'workspace'")
      expect(header).toContain('/owner/billing')
      expect(header).toContain('/free/billing')
      expect(header).toContain('/owner/estimator')
      expect(header).toContain('/free/estimator')
      expect(header).toContain('LogoutButton')
    })
  })

  describe('UI: Feature Differentiation & Previews', () => {
    it('UI-01: cards have distinct starting preview features (Free: estimator, Lite: qualities, Base: production)', () => {
      // Prevents all three cards from redundantly showing estimator on first render
      expect(CARD_FEATURE_PREVIEWS.free[0]).toBe('estimator')
      expect(CARD_FEATURE_PREVIEWS.lite[0]).toBe('qualities')
      expect(CARD_FEATURE_PREVIEWS.base[0]).toBe('production')

      // All preview images are registered
      expect(UPGRADE_FEATURE_IMAGES.estimator.src).toBe('/images/plans/estimator.png')
      expect(UPGRADE_FEATURE_IMAGES.costings.src).toBe('/images/plans/costings.png')
      expect(UPGRADE_FEATURE_IMAGES.qualities.src).toBe('/images/plans/qualities.png')
      expect(UPGRADE_FEATURE_IMAGES.rates.src).toBe('/images/plans/rates.png')
      expect(UPGRADE_FEATURE_IMAGES.production.src).toBe('/images/plans/production.svg')
      expect(UPGRADE_FEATURE_IMAGES.payroll.src).toBe('/images/plans/payroll.svg')
    })

    it('UI-02: preview modal is accessible with dialog role, modal attribute and close action', () => {
      const modal = read('components/plans/PlanPreviewModal.tsx')
      expect(modal).toContain('role="dialog"')
      expect(modal).toContain('aria-modal="true"')
      expect(modal).toContain('aria-labelledby="preview-modal-title"')
      expect(modal).toContain("event.key === 'Escape'")
      expect(modal).toContain('data-modal-close')
    })

    it('UI-03: clear incremental feature inheritance headers are present', () => {
      const card = read('components/plans/PlanCard.tsx')
      expect(card).toContain("upgradeText(language, 'everythingInFree')")
      expect(card).toContain("upgradeText(language, 'everythingInLite')")

      expect(upgradeText('en', 'everythingInFree')).toBe('Everything in Free, plus:')
      expect(upgradeText('gu', 'everythingInFree')).toBe('Free ની તમામ સુવિધાઓ ઉપરાંત:')
      expect(upgradeText('hi', 'everythingInFree')).toBe('Free की सभी सुविधाओं के अलावा:')

      expect(upgradeText('en', 'everythingInLite')).toBe('Everything in Lite, plus:')
      expect(upgradeText('gu', 'everythingInLite')).toBe('Lite ની તમામ સુવિધાઓ ઉપરાંત:')
      expect(upgradeText('hi', 'everythingInLite')).toBe('Lite की सभी सुविधाओं के अलावा:')
    })
  })

  describe('STATE & CTAs: Truthful Actions Matrix', () => {
    it('STATE-01: PlanCard defines context-aware actions for Free, Lite and Base', () => {
      const card = read('components/plans/PlanCard.tsx')

      // Free CTA logic
      expect(card).toContain("upgradeText(language, 'current')")
      expect(card).toContain("upgradeText(language, 'comparison')")
      expect(card).toContain("upgradeText(language, 'continueFree')")

      // Lite CTA logic
      expect(card).toContain("upgradeText(language, 'upgradeToLite')")
      expect(card).toContain("upgradeText(language, 'chooseLite')")
      expect(card).toContain("upgradeText(language, 'includedInBase')")

      // Base CTA logic
      expect(card).toContain("upgradeText(language, 'upgradeToBase')")
      expect(card).toContain("upgradeText(language, 'chooseBase')")
    })

    it('STATE-02: Free button is never disabled for eligible onboarding users', () => {
      const card = read('components/plans/PlanCard.tsx')
      // Only disabled when busy or when explicitly not eligible
      expect(card).toContain('disabled={busy || !freeAvailable}')
    })

    it('STATE-03: onboarding users with pre-provisioned free plan see Continue with Free instead of disabled current plan', () => {
      const card = read('components/plans/PlanCard.tsx')
      const page = read('app/(plan-selection)/plans/page.tsx')

      // isCurrent excludes onboarding so Free tier is not marked as disabled current plan during onboarding
      expect(card).toContain('const isCurrent = currentPlan === planTier && !isOnboarding')
      expect(card).toContain('id="continue-free-btn"')

      // Plans page detects onboarding from both app_metadata and URL searchParams
      expect(page).toContain("isOnboarding = user.app_metadata.plan_selection_pending === true || from === 'onboarding'")
    })
  })

  describe('PAY: Pricing & Commercial Terms Disclosure', () => {
    it('PAY-01: pricing matches commercial catalog strictly', () => {
      expect(BILLING_PLANS.lite.firstYearTotalPaise).toBe(299900)
      expect(BILLING_PLANS.lite.firstYearBasePaise).toBe(254153)
      expect(BILLING_PLANS.lite.firstYearGstPaise).toBe(45747)
      expect(BILLING_PLANS.lite.renewalTotalPaise).toBe(149900)

      expect(BILLING_PLANS.base.firstYearTotalPaise).toBe(999900)
      expect(BILLING_PLANS.base.firstYearBasePaise).toBe(847373)
      expect(BILLING_PLANS.base.firstYearGstPaise).toBe(152527)
      expect(BILLING_PLANS.base.renewalTotalPaise).toBe(499900)
    })

    it('PAY-02: client layout provides full commercial disclosure section', () => {
      const client = read('components/plans/PlanChooserClient.tsx')
      expect(client).toContain('18% GST Included')
      expect(client).toContain('Manual Renewal')
      expect(client).toContain('Instant Activation')
      expect(client).toContain('Secure Checkout')
    })
  })

  describe('REG: Entry Points & Billing Integration', () => {
    it('REG-01: owner billing page links its plan comparison card to /plans?from=billing', () => {
      const billing = read('app/(dashboard)/owner/billing/page.tsx')
      expect(billing).toContain('id="view-plans-heading"')
      expect(billing).toContain('Compare plan options')
      expect(billing).toContain('href="/plans?from=billing"')
      expect(billing).toContain("subscriptionTier === 'lite' ? 'Upgrade to Base'")
      expect(billing).toContain("subscriptionTier === 'base' ? 'Compare plans'")
      expect(billing).toContain("'Explore plans'")
    })

    it('REG-02: free billing page includes compare plans button pointing to /plans?from=billing', () => {
      const freeBilling = read('app/free/billing/FreeBillingClient.tsx')
      expect(freeBilling).toContain('/plans?from=billing')
      expect(freeBilling).toContain('compareAllPlans')
    })

    it('REG-03: estimator upgrade preview includes compare all plans link to /plans?from=estimator', () => {
      const estimatorPreview = read('components/estimator/UpgradeBenefitsPreview.tsx')
      expect(estimatorPreview).toContain('/plans?from=estimator')
      expect(estimatorPreview).toContain('compareAllPlans')
    })
  })
})
