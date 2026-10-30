import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  language: 'en' as 'en' | 'hi' | 'gu',
  workspaceTier: 'free' as string,
}))

vi.mock('server-only', () => ({}))
vi.mock('next/dynamic', async () => {
  const { createElement: h } = await import('react')
  // Every dynamic import in the tested components is the checkout button, so render its label.
  return { default: () => (props: { buttonLabel?: string }) => h('span', null, `SUBSCRIBE ${props.buttonLabel ?? ''}`) }
})
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/app/(auth)/onboarding/plans/actions', () => ({ completePlanSelection: async () => ({}) }))
vi.mock('@/components/billing/PaymentHistoryDialog', () => ({ PaymentHistoryDialog: () => null }))
vi.mock('@/app/free/FreeWorkspace', () => ({ useFreeWorkspace: () => ({ tier: state.workspaceTier }) }))
vi.mock('@/components/billing/SubscribeButton', async () => {
  const { createElement: h } = await import('react')
  return {
    SubscribeButton: (props: { buttonLabel?: string }) => h('span', null, `SUBSCRIBE ${props.buttonLabel ?? ''}`),
  }
})
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    language: state.language,
    t: (key: string) => key,
    tx: (text: string) => text,
    setLanguage: async () => ({ ok: true }),
    languageStatus: 'ready',
    pendingLanguage: null,
    languageError: null,
  }),
}))

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

const TRIAL_START = 'Start 3-month free trial'
const TRIAL_DISCLOSURE = '90 days of Lite free, no payment needed.'
const PAY_NOW = 'Or pay now: ₹2,999 for the first year'

/** The Lite branch of PlanCard's CTA block, from its isLite test to the Base branch. */
function liteCtaBlock(card: string) {
  const start = card.indexOf('{isLite && (')
  const end = card.indexOf('{isBase && (')
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return card.slice(start, end)
}

describe('Lite trial entry: StartTrialButton', () => {
  it('is a client button that starts the trial, shows errors, and navigates to the returned href', () => {
    const button = read('components/plans/StartTrialButton.tsx')
    expect(button).toContain("'use client'")
    expect(button).toContain("completePlanSelection('trial')")
    expect(button).toContain('window.location.assign(result.href)')
    expect(button).toContain('onStarted?.()')
    expect(button).toContain('role="alert"')
    expect(button).toContain("liteTrialText(language, 'startTrial')")
  })

  it('keeps the 44px touch target and the ink primary style, not saffron', () => {
    const button = read('components/plans/StartTrialButton.tsx')
    expect(button).toContain('min-h-[44px]')
    expect(button).toContain('<Button')
    expect(button).not.toContain('variant="saffron"')
  })

  it('renders the trial label and carries the touch target class', async () => {
    const { StartTrialButton } = await import('@/components/plans/StartTrialButton')
    state.language = 'en'
    const html = renderToStaticMarkup(createElement(StartTrialButton))
    expect(html).toContain(TRIAL_START)
    expect(html).toContain('min-h-[44px]')
  })
})

describe('Lite trial entry: PlanCard', () => {
  const base = {
    currentPlan: 'free' as const,
    isOnboarding: false,
    freeAvailable: true,
    billingReady: true,
    busy: false,
    onSelectFree: () => {},
    onOpenPreview: () => {},
  }

  it('takes liteTrialEligible and defaults it to hidden', () => {
    const card = read('components/plans/PlanCard.tsx')
    expect(card).toContain('liteTrialEligible?: boolean')
    expect(card).toContain('liteTrialEligible = false')
    expect(card).toMatch(/import \{[^}]*\bStartTrialButton\b[^}]*\} from '@\/components\/plans\/StartTrialButton'/)
  })

  it('makes the Lite trial the primary action with the disclosure and a pay-now link only when eligible', () => {
    const block = liteCtaBlock(read('components/plans/PlanCard.tsx'))
    expect(block).toContain('liteTrialEligible ? (')
    expect(block).toContain('<StartTrialButton')
    expect(block).toContain("liteTrialText(language, 'trialDisclosure')")
    expect(block).toContain("liteTrialText(language, 'trialPayNow')")
    expect(block).toMatch(/liteTrialEligible \? \([\s\S]*?<DialogTrigger[\s\S]*?\) : billingReady \? \(/)
    expect(read('components/plans/PlanCard.tsx')).toMatch(/\{showTrial && billingReady && checkoutOpen && \(\s*<SubscribeButton/)
  })

  it('renders the trial button and the disclosure for an eligible Lite card', async () => {
    const { PlanCard } = await import('@/components/plans/PlanCard')
    state.language = 'en'
    const html = renderToStaticMarkup(createElement(PlanCard, { ...base, planTier: 'lite', liteTrialEligible: true }))
    expect(html).toContain(TRIAL_START)
    expect(html).toContain(TRIAL_DISCLOSURE)
    expect(html).toContain(PAY_NOW)
    // The pay-now entry opens plan details; checkout and its document disclosure render inside that dialog.
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).not.toContain('Upgrade to Lite')
  })

  it('keeps the normal subscribe button for a Lite card that is not eligible', async () => {
    const { PlanCard } = await import('@/components/plans/PlanCard')
    state.language = 'en'
    const html = renderToStaticMarkup(createElement(PlanCard, { ...base, planTier: 'lite' }))
    expect(html).not.toContain(TRIAL_START)
    expect(html).not.toContain(TRIAL_DISCLOSURE)
    expect(html).not.toContain(PAY_NOW)
    expect(html).toContain('SUBSCRIBE Upgrade to Lite')
  })

  it('leaves the Base card untouched even when the org is trial-eligible', async () => {
    const { PlanCard } = await import('@/components/plans/PlanCard')
    state.language = 'en'
    const html = renderToStaticMarkup(createElement(PlanCard, { ...base, planTier: 'base', currentPlan: 'lite', liteTrialEligible: true }))
    expect(html).not.toContain(TRIAL_START)
    expect(html).not.toContain(PAY_NOW)
  })

  it('does not show a trial to the Lite card once Lite is the current plan', async () => {
    const { PlanCard } = await import('@/components/plans/PlanCard')
    state.language = 'en'
    const html = renderToStaticMarkup(createElement(PlanCard, { ...base, planTier: 'lite', currentPlan: 'lite', liteTrialEligible: true }))
    expect(html).not.toContain(TRIAL_START)
    expect(html).toContain('Current')
  })
})

describe('Lite trial entry: plan chooser threading', () => {
  it('PlanChooserClient takes liteTrialEligible and passes it to the Lite card only', () => {
    const client = read('components/plans/PlanChooserClient.tsx')
    expect(client).toContain('liteTrialEligible: boolean')
    expect(client).toContain('liteTrialEligible,')
    const liteCard = client.slice(client.indexOf('planTier="lite"'), client.indexOf('{baseVisible && ('))
    expect(liteCard).toContain('liteTrialEligible={liteTrialEligible}')
    const freeCard = client.slice(client.indexOf('planTier="free"'), client.indexOf('planTier="lite"'))
    expect(freeCard).not.toContain('liteTrialEligible')
  })

  it('the plans page passes liteTrialEligible from the effective org access', () => {
    const page = read('app/(plan-selection)/plans/page.tsx')
    expect(page).toContain('liteTrialEligible={access.liteTrialEligible === true}')
  })

  it('renders the trial start on the chooser for an eligible org and omits it otherwise', async () => {
    const { PlanChooserClient } = await import('@/components/plans/PlanChooserClient')
    state.language = 'en'
    const props = { currentPlan: 'free' as const, isOnboarding: false, freeAvailable: true, billingReady: true, paid: false, baseVisible: false }
    const eligible = renderToStaticMarkup(createElement(PlanChooserClient, { ...props, liteTrialEligible: true }))
    expect(eligible).toContain(TRIAL_START)
    const ineligible = renderToStaticMarkup(createElement(PlanChooserClient, { ...props, liteTrialEligible: false }))
    expect(ineligible).not.toContain(TRIAL_START)
    expect(ineligible).toContain('Upgrade to Lite')
  })
})

describe('Lite trial entry: Free upgrade surfaces', () => {
  it('UpgradeBenefitsPreview takes liteTrialEligible and swaps the Lite paid action for the trial', () => {
    const preview = read('components/estimator/UpgradeBenefitsPreview.tsx')
    expect(preview).toContain('liteTrialEligible?: boolean')
    expect(preview).toContain("lite: paidAction('lite', liteTrialEligible)")
    expect(preview).toContain('const paidAction = (tier: PurchasablePlanTier, trialFirst = false)')
    expect(preview).toContain('<StartTrialButton')
    expect(preview).toContain("liteTrialText(language, 'trialDisclosure')")
    expect(preview).toContain("liteTrialText(language, 'trialPayNow')")
  })

  it('shows the trial start in the estimator upgrade preview for an eligible org only', async () => {
    const { UpgradeBenefitsPreview } = await import('@/components/estimator/UpgradeBenefitsPreview')
    state.language = 'en'
    const common = { onActivated: () => {}, open: true, onOpenChange: () => {} }
    const eligible = renderToStaticMarkup(createElement(UpgradeBenefitsPreview, { ...common, liteTrialEligible: true }))
    expect(eligible).toContain(TRIAL_START)
    expect(eligible).toContain(TRIAL_DISCLOSURE)
    expect(eligible).toContain(`SUBSCRIBE ${PAY_NOW}`)
    expect(eligible).toContain('Compare all plans')
    const ineligible = renderToStaticMarkup(createElement(UpgradeBenefitsPreview, common))
    expect(ineligible).not.toContain(TRIAL_START)
    expect(ineligible).not.toContain(PAY_NOW)
    expect(ineligible).toContain('SUBSCRIBE')
  })

  it('threads liteTrialEligible from the Free route through FreeClient and EstimatorClient', () => {
    const freePage = read('app/free/page.tsx')
    const freeClient = read('app/free/FreeClient.tsx')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    expect(freePage).toContain('liteTrialEligible={access.liteTrialEligible === true}')
    expect(freeClient).toContain('liteTrialEligible = false')
    expect(freeClient).toContain('liteTrialEligible={liteTrialEligible}')
    expect(estimator).toMatch(/liteTrialEligible\?: boolean/)
    expect(estimator).toMatch(/<UpgradeBenefitsPreview[^>]*liteTrialEligible=\{liteTrialEligible\}/)
  })

  it('FreeBillingClient takes liteTrialEligible and shows the trial start only for a Free workspace', () => {
    const client = read('app/free/billing/FreeBillingClient.tsx')
    expect(client).toContain('liteTrialEligible?: boolean')
    expect(client).toContain("liteTrialEligible && tier !== 'lite' && tier !== 'base'")
    expect(client).toContain('<StartTrialButton')
    expect(client).toContain("liteTrialText(language, 'trialDisclosure')")
  })

  it('the Free billing page passes liteTrialEligible from the server access', () => {
    const page = read('app/free/billing/page.tsx')
    expect(page).toContain('liteTrialEligible={access.liteTrialEligible === true}')
  })

  it('renders the trial start on the Free billing page for an eligible org and omits it otherwise', async () => {
    const { default: FreeBillingClient } = await import('@/app/free/billing/FreeBillingClient')
    state.language = 'en'
    state.workspaceTier = 'free'
    const common = { organizationName: 'Factory', initialTier: 'free', grantState: 'active' }
    const eligible = renderToStaticMarkup(createElement(FreeBillingClient, { ...common, liteTrialEligible: true }))
    expect(eligible).toContain(TRIAL_START)
    expect(eligible).toContain(TRIAL_DISCLOSURE)
    const ineligible = renderToStaticMarkup(createElement(FreeBillingClient, common))
    expect(ineligible).not.toContain(TRIAL_START)
    expect(ineligible).toContain('Compare all plans')
  })
})
