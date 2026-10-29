import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// PlanCard imports StartTrialButton, which imports the server action module. Keep the server code out of this contract test.
vi.mock('@/app/(auth)/onboarding/plans/actions', () => ({ completePlanSelection: async () => ({}) }))

import { BILLING_PLANS } from '@/lib/billing-constants'
import {
  UPGRADE_FEATURE_IMAGES,
  upgradeText,
} from '@/lib/upgrade-wall'
import { BILLING_DOCUMENT_POLICY } from '@/lib/billing-document-policy'
import { freeMobileEntryText } from '@/lib/i18n/free-mobile-entry'
import { planTrustDetails } from '@/lib/i18n/plan-trust-tiles'
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
      expect(header).toContain("backHref = isFree ? '/free' : '/owner/estimator'")
      expect(header).not.toContain('/free/estimator')
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

    it('UI-02: video preview uses the shared accessible dialog and restores launcher focus', () => {
      const modal = read('components/plans/PlanPreviewModal.tsx')
      expect(modal).toContain('@/components/ui/dialog')
      expect(modal).toContain('<DialogTitle')
      expect(modal).toContain('<DialogDescription')
      expect(modal).toContain('onCloseAutoFocus')
      expect(modal).toContain('previousFocusRef.current?.focus()')
      expect(modal).toContain("upgradeText(language, 'closePreview')")
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
      // The disclosure lives in the trust tiles under the plan cards; each tile opens a full explanation.
      expect(read('components/plans/PlanChooserClient.tsx')).toContain('<PlanTrustTiles mobileCompact={mobileCompact} />')
      const client = read('components/plans/PlanTrustTiles.tsx')
      expect(BILLING_DOCUMENT_POLICY.state).toBe('not_supported')
      expect(client).toContain('data-billing-document-state={BILLING_DOCUMENT_POLICY.state}')
      expect(client).toContain("t('base_plan.billing.receipt_only')")
      expect(client).not.toContain('Full tax invoices with GSTIN compliance')
      expect(read('components/plans/PlanCard.tsx')).toContain('GST (18%)')
      expect(freeMobileEntryText('en', 'receiptDocument')).toBe(BILLING_DOCUMENT_POLICY.customerDocument)
      for (const language of ['en', 'hi', 'gu'] as const) {
        for (const key of ['receiptDocument', 'manualRenewal', 'verifiedActivation', 'secureCheckout'] as const) {
          expect(freeMobileEntryText(language, key)).toBeTruthy()
          expect(client).toContain(`freeMobileEntryText(language, '${key}')`)
        }
        for (const topic of ['receipt', 'renewal', 'activation', 'checkout'] as const) {
          expect(planTrustDetails(language, topic).length).toBeGreaterThan(0)
        }
      }
      // The receipt explanation must keep the not-a-GST-invoice disclosure in every language.
      expect(planTrustDetails('en', 'receipt').join(' ')).toContain('not a GST tax invoice')
      expect(planTrustDetails('gu', 'receipt').join(' ')).toContain('GST')
      expect(planTrustDetails('hi', 'receipt').join(' ')).toContain('GST')
    })

    it('PAY-03: trust tiles lift on the compositor and their dialog grows out of the tile', () => {
      const tiles = read('components/plans/PlanTrustTiles.tsx')
      const css = read('app/globals.css')
      const lift = css.slice(css.indexOf('.ui-tile-lift {'), css.indexOf('/* Spring pop shared by every modal'))
      expect(tiles).toContain("'ui-tile-lift ")
      // Only translate, scale and opacity move: the hover shadow is a faded layer, never a box-shadow transition.
      expect(lift).toContain('.ui-tile-lift::after')
      expect(lift).not.toMatch(/transition:[^;]*box-shadow/)
      expect(lift).toContain('prefers-reduced-motion: reduce')
      // The shared modal spring stays; only its origin and scale are tuned, and the dialog stays mounted for its exit.
      expect(tiles).toContain('ref={growFromTile}')
      expect(tiles).toContain('node.style.transformOrigin')
      expect(tiles).toContain('<Dialog open={open} onOpenChange={setOpen}>')
      expect(tiles).not.toMatch(/\{active && \(\s*<DialogContent/)
    })
  })

  describe('REG: Entry Points & Billing Integration', () => {
    it('REG-01: owner billing page links its plan comparison card to /plans?from=billing', () => {
      const billing = read('app/(dashboard)/owner/billing/page.tsx')
      expect(billing).toContain('id="view-plans-heading"')
      expect(billing).toContain('Compare plan options')
      expect(billing).toContain('href="/plans?from=billing"')
      expect(billing).toContain("subscriptionTier === 'lite' && baseVisible ? 'Upgrade to Base'")
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
