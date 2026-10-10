import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

/** Base copy as a whole word. Upsell surfaces must not show it to a hidden org. */
const BASE_WORD = /\bBase\b/

const state = vi.hoisted(() => ({
  workspaceTier: 'free' as string,
  effectiveTier: 'lite' as string,
  baseVisible: undefined as boolean | undefined,
}))

vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/app/free/FreeWorkspace', () => ({ useFreeWorkspace: () => ({ tier: state.workspaceTier }) }))
vi.mock('@/components/billing/PaymentHistoryDialog', () => ({ PaymentHistoryDialog: () => null }))
vi.mock('@/components/billing/SubscribeButton', () => ({ SubscribeButton: () => null }))
vi.mock('@/app/(auth)/onboarding/plans/actions', () => ({ completePlanSelection: async () => ({}) }))
vi.mock('@/lib/auth', () => ({
  getCachedSession: async () => ({ user: { id: 'u', app_metadata: {} }, profile: { org_id: 'org', role: 'owner' } }),
}))
vi.mock('@/lib/subscription', () => ({
  getCachedOrgPlanAccess: async () => ({
    subscriptionTier: state.effectiveTier,
    effectiveTier: state.effectiveTier,
    baseVisible: state.baseVisible,
  }),
}))

afterEach(() => {
  vi.doUnmock('@/lib/base-plan-visibility')
  vi.resetModules()
})

describe('Base suppression: plan chooser', () => {
  it('the plans page passes baseVisible from the effective org access, not a default', () => {
    const page = read('app/(plan-selection)/plans/page.tsx')
    expect(page).toContain('baseVisible={access.baseVisible === true}')
  })

  it('PlanChooserClient takes baseVisible and renders the Base card only inside that guard', () => {
    const client = read('components/plans/PlanChooserClient.tsx')
    expect(client).toContain('baseVisible: boolean')
    expect(client).toMatch(/\{baseVisible && \([\s\S]*?planTier="base"/)
  })

  it('PlanChooserClient uses a two-column grid when Base is hidden and keeps the three-column grid otherwise', () => {
    const client = read('components/plans/PlanChooserClient.tsx')
    expect(client).toContain('baseVisible ? "max-w-6xl lg:grid-cols-3" : "max-w-4xl lg:grid-cols-2"')
  })

  it('the feature preview modal receives baseVisible and drops the Base note for hidden orgs', () => {
    const client = read('components/plans/PlanChooserClient.tsx')
    const modal = read('components/plans/PlanPreviewModal.tsx')
    expect(client).toContain('baseVisible={baseVisible}')
    expect(modal).toContain('baseVisible?: boolean')
    expect(modal).toMatch(/\{baseVisible && <DialogDescription/)
  })

  it('renders only Free and Lite cards for a hidden org, and keeps the Base card for a visible one', async () => {
    const { PlanChooserClient } = await import('@/components/plans/PlanChooserClient')
    const base = { currentPlan: 'free' as const, isOnboarding: false, freeAvailable: true, billingReady: true, paid: false }
    const hidden = renderToStaticMarkup(createElement(PlanChooserClient, { ...base, baseVisible: false }))
    expect(hidden).not.toMatch(BASE_WORD)
    expect(hidden).not.toContain('Costing, production and payroll')
    expect(hidden).toContain('lg:grid-cols-2')
    expect(hidden).not.toContain('lg:grid-cols-3')

    const visible = renderToStaticMarkup(createElement(PlanChooserClient, { ...base, baseVisible: true }))
    expect(visible).toMatch(BASE_WORD)
    expect(visible).toContain('Costing, production and payroll')
    expect(visible).toContain('lg:grid-cols-3')
  })
})

describe('Base suppression: public landing plans', () => {
  it('plans.tsx reads the launch constant and gates the Base column, the Base-only factory rows and the owner-led line', () => {
    const plans = read('components/landing/plans.tsx')
    expect(plans).toContain("import { BASE_PLAN_OPEN_TO_NEW_ACCOUNTS } from '@/lib/base-plan-visibility'")
    expect(plans).toContain("plan.key !== 'base' || BASE_PLAN_OPEN_TO_NEW_ACCOUNTS")
    expect(plans).toContain('baseOnly: true')
    expect(plans).toContain('group.baseOnly')
    expect(plans).toMatch(/\{BASE_PLAN_OPEN_TO_NEW_ACCOUNTS && \(\s*<p[^>]*>\s*Base is owner-led/)
  })

  it('omits Base from the static landing plans table while the launch switch is closed', async () => {
    const { default: LandingPlans } = await import('@/components/landing/plans')
    const html = renderToStaticMarkup(createElement(LandingPlans))
    expect(html).not.toMatch(BASE_WORD)
    expect(html).not.toContain('Workers, piece-rate payroll')
    expect(html).toContain('Reusable fabric qualities')
  })

  it('shows Base on the landing plans table once the launch switch is flipped', async () => {
    vi.resetModules()
    vi.doMock('@/lib/base-plan-visibility', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@/lib/base-plan-visibility')>()),
      BASE_PLAN_OPEN_TO_NEW_ACCOUNTS: true,
    }))
    const { default: LandingPlans } = await import('@/components/landing/plans')
    const html = renderToStaticMarkup(createElement(LandingPlans))
    expect(html).toMatch(BASE_WORD)
    expect(html).toContain('Workers, piece-rate payroll')
  })

  it('pricing.tsx gates the Base card and its CTA behind the launch switch', () => {
    const pricing = read('components/landing/pricing.tsx')
    expect(pricing).toContain('BASE_PLAN_OPEN_TO_NEW_ACCOUNTS')
    expect(pricing).toContain("tier !== 'base' || BASE_PLAN_OPEN_TO_NEW_ACCOUNTS")
  })

  it('omits the Base pricing card while the launch switch is closed', async () => {
    const { default: LandingPricing } = await import('@/components/landing/pricing')
    const html = renderToStaticMarkup(createElement(LandingPricing))
    expect(html).not.toContain('pricing-base-title')
    expect(html).not.toContain('signup?plan=base')
    expect(html).toContain('signup?plan=lite')
  })
})

describe('Base suppression: public landing sections', () => {
  // Fully gated: no Base copy at all while the launch switch is closed.
  // The footer tagline, fit line and FAQ answers still name Base; they need new
  // curated copy and are tracked as an open decision, so they are not asserted here.
  const fullyGated = [
    'components/landing/plans',
    'components/landing/pricing',
    'components/landing/workflow',
  ]
  const baseFaqQuestion = 'Does Base include supervisor accounts or statutory payroll?'

  it('no fully gated landing section names Base while the launch switch is closed', async () => {
    for (const section of fullyGated) {
      const mod = await import(`@/${section}`)
      const html = renderToStaticMarkup(createElement(mod.default))
      expect(html, section).not.toMatch(BASE_WORD)
    }
  })

  it('the Base-only FAQ question is hidden while the launch switch is closed', async () => {
    const { default: LandingFAQ } = await import('@/components/landing/faq')
    const html = renderToStaticMarkup(createElement(LandingFAQ))
    expect(html).not.toContain(baseFaqQuestion)
    expect(html).toContain('Which plan should I start with?')
  })

  it('the same landing sections name Base again once the launch switch is flipped', async () => {
    vi.resetModules()
    vi.doMock('@/lib/base-plan-visibility', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@/lib/base-plan-visibility')>()),
      BASE_PLAN_OPEN_TO_NEW_ACCOUNTS: true,
    }))
    for (const section of fullyGated) {
      const mod = await import(`@/${section}`)
      const html = renderToStaticMarkup(createElement(mod.default))
      expect(html, section).toMatch(BASE_WORD)
    }
    const { default: LandingFAQ } = await import('@/components/landing/faq')
    expect(renderToStaticMarkup(createElement(LandingFAQ))).toContain(baseFaqQuestion)
  })
})

describe('Base suppression: upgrade wall and access gate', () => {
  it('UpgradeWall hides the Base card unless baseVisible is passed, defaulting to hidden', () => {
    const wall = read('components/billing/UpgradeWall.tsx')
    expect(wall).toContain('baseVisible?: boolean')
    expect(wall).toContain("baseVisible ? ['free', 'lite', 'base'] : ['free', 'lite']")
  })

  it('UpgradeWall renders Free and Lite only by default and Base when visible', async () => {
    const { UpgradeWall } = await import('@/components/billing/UpgradeWall')
    const hidden = renderToStaticMarkup(createElement(UpgradeWall, { currentPlan: 'free' }))
    expect(hidden).not.toMatch(BASE_WORD)
    expect(hidden).not.toContain('Costing, production and payroll')
    const visible = renderToStaticMarkup(createElement(UpgradeWall, { currentPlan: 'free', baseVisible: true }))
    expect(visible).toMatch(BASE_WORD)
    expect(visible).toContain('Costing, production and payroll')
  })

  it('AccessGate returns the unavailable wall for production when baseVisible is not true', () => {
    const gate = read('components/billing/AccessGate.tsx')
    expect(gate).toContain('planAccess.baseVisible !== true')
    expect(gate).toMatch(/planAccess\.baseVisible !== true\)\s*\{?\s*return <UnavailableCapabilityWall/)
    expect(gate).toContain('<UpgradeWall currentPlan={currentTier} baseVisible')
  })

  it('AccessGate shows the generic wall without Base copy to a hidden org, and the production wall to a visible one', async () => {
    const { default: AccessGate } = await import('@/components/billing/AccessGate')
    const element = (): ReturnType<typeof createElement> => createElement('span', null, 'child')
    state.effectiveTier = 'lite'

    state.baseVisible = false
    const hidden = renderToStaticMarkup(await AccessGate({ requiredCapability: 'production', routeName: '/owner/production', children: element() }))
    expect(hidden).toContain('outside your current plan')
    expect(hidden).not.toMatch(BASE_WORD)
    expect(hidden).not.toContain('Take costing into production')

    state.baseVisible = true
    const visible = renderToStaticMarkup(await AccessGate({ requiredCapability: 'production', routeName: '/owner/production', children: element() }))
    expect(visible).toContain('Take costing into production')
    expect(visible).toMatch(BASE_WORD)
  })

  it('UpgradeBenefitsPreview receives baseVisible from its parent and offers no Base action when hidden', () => {
    const preview = read('components/estimator/UpgradeBenefitsPreview.tsx')
    expect(preview).toContain('baseVisible?: boolean')
    expect(preview).toContain("base: baseVisible ? paidAction('base') : undefined")
    expect(preview).toContain('baseVisible={baseVisible}')
    expect(preview).toContain("baseVisible ? 'planSummary' : 'planLiteFit'")
  })

  it('UpgradeBenefitsPreview shows no Base upgrade copy to a hidden org and keeps it for a visible one', async () => {
    const { UpgradeBenefitsPreview } = await import('@/components/estimator/UpgradeBenefitsPreview')
    const hidden = renderToStaticMarkup(createElement(UpgradeBenefitsPreview, { onActivated: () => {}, open: true, onOpenChange: () => {} }))
    expect(hidden).not.toMatch(BASE_WORD)
    expect(hidden).toContain('Compare all plans')
    const visible = renderToStaticMarkup(createElement(UpgradeBenefitsPreview, { onActivated: () => {}, open: true, onOpenChange: () => {}, baseVisible: true }))
    expect(visible).toMatch(BASE_WORD)
  })

  it('the Free estimator threads baseVisible from the server access into the upgrade preview', () => {
    const freePage = read('app/free/page.tsx')
    const freeClient = read('app/free/FreeClient.tsx')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    expect(freePage).toContain('baseVisible={access.baseVisible === true}')
    expect(freeClient).toContain('baseVisible={baseVisible}')
    expect(estimator).toMatch(/<UpgradeBenefitsPreview[^>]*baseVisible=\{baseVisible\}/)
  })
})

describe('Base suppression: free billing and owner billing', () => {
  it('FreeBillingClient takes baseVisible and shows the Upgrade to Base label and plan-comparison copy only when visible', () => {
    const client = read('app/free/billing/FreeBillingClient.tsx')
    expect(client).toContain('baseVisible?: boolean')
    expect(client).toContain("tier === 'lite' && baseVisible ? 'Upgrade to Base'")
    expect(client).toMatch(/\{baseVisible && \(\s*<p[^>]*>\s*\{text\('compareBody'\)\}/)
  })

  it('the free billing page passes baseVisible from the server access', () => {
    const page = read('app/free/billing/page.tsx')
    expect(page).toContain('baseVisible={access.baseVisible === true}')
  })

  it('FreeBillingClient shows no Base label or plan copy to a hidden Lite org, and keeps both for a visible one', async () => {
    const { default: FreeBillingClient } = await import('@/app/free/billing/FreeBillingClient')
    state.workspaceTier = 'lite'
    const hidden = renderToStaticMarkup(createElement(FreeBillingClient, { organizationName: 'Factory', initialTier: 'lite', grantState: 'active', baseVisible: false }))
    expect(hidden).not.toContain('Upgrade to Base')
    expect(hidden).not.toContain('Compare features and pricing')
    expect(hidden).toContain('Compare all plans')
    const visible = renderToStaticMarkup(createElement(FreeBillingClient, { organizationName: 'Factory', initialTier: 'lite', grantState: 'active', baseVisible: true }))
    expect(visible).toContain('Upgrade to Base')
    expect(visible).toContain('Compare features and pricing')
    state.workspaceTier = 'free'
  })

  it('the owner billing page filters the self-serve tiers by visibility and never shows Base to a hidden org', () => {
    const page = read('app/(dashboard)/owner/billing/page.tsx')
    expect(page).toContain('const baseVisible = planAccess.baseVisible === true')
    expect(page).toContain("BILLING_SELF_SERVE_PLAN_TIERS.filter(tier => tier !== 'base' || baseVisible)")
    expect(page).toContain('const cardPlanTiers: readonly PurchasablePlanTier[] = subscriptionTier === \'lite\'')
    expect(page).toContain('<AccessStateCallout')
    expect(page).toMatch(/<AccessStateCallout[\s\S]*?baseVisible=\{baseVisible\}/)
  })

  it('the owner billing upgrade label offers Base only to a visible Lite org', () => {
    const page = read('app/(dashboard)/owner/billing/page.tsx')
    const gated = page.split("subscriptionTier === 'lite' && baseVisible ? 'Upgrade to Base'").length - 1
    expect(gated).toBe(2)
    expect(page).not.toContain("subscriptionTier === 'lite' ? 'Upgrade to Base'")
  })
})

describe('Base suppression: existing Base organizations see no change', () => {
  it('keeps the Base copy of the owner billing plan action for a visible Lite org', () => {
    const page = read('app/(dashboard)/owner/billing/page.tsx')
    expect(page).toContain("Upgrade to Base' : subscriptionTier === 'base' ? 'Compare plans' : 'Explore plans'")
  })
})
