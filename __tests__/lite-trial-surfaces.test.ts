import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrialBanner } from '@/components/billing/TrialBanner'
import {
  readTrialEndedDismissal,
  TrialEndedNotice,
  trialEndedDismissKey,
  writeTrialEndedDismissal,
} from '@/components/billing/TrialEndedNotice'
import FreeClient from '@/app/free/FreeClient'

const state = vi.hoisted(() => ({
  language: 'en' as 'en' | 'hi' | 'gu',
  workspace: { paid: false, tier: 'free' as string },
}))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    language: state.language,
    t: (key: string) => key,
    tx: (text: string) => text,
  }),
}))
vi.mock('@/app/free/FreeWorkspace', () => ({ useFreeWorkspace: () => state.workspace }))
vi.mock('@/app/(dashboard)/owner/estimator/EstimatorClient', () => ({ default: () => null }))

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** A fixed clock, so the countdown is exact rather than depending on when the test runs. */
const NOW_MS = Date.parse('2026-10-11T04:00:00.000Z')

/** The instant `ms` after (or before, when negative) the fixed clock. */
function endsIn(ms: number) {
  return new Date(NOW_MS + ms).toISOString()
}

function endsInDays(days: number) {
  return endsIn(days * DAY_MS)
}

const ENDED_AT = '2026-10-01T00:00:00.000Z'

/** The anchor that links to `href`, whatever order React writes its attributes in. */
function anchorFor(html: string, href: string) {
  return html.match(/<a\b[^>]*>[^<]*<\/a>/g)?.find(tag => tag.includes(`href="${href}"`)) ?? ''
}

afterEach(() => {
  vi.unstubAllGlobals()
  state.language = 'en'
  state.workspace = { paid: false, tier: 'free' }
})

describe('TrialBanner', () => {
  // The countdown reads the clock, so pin it: every endsAt below is an exact offset from NOW_MS.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW_MS)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const render = (endsAt: string) => renderToStaticMarkup(createElement(TrialBanner, { endsAt }))

  it('shows the days left in the trial', () => {
    expect(render(endsInDays(20))).toContain('Lite trial: 20 days left')
  })

  it('reads the final 6 hours as one day left, with the singular and emphasised', () => {
    const html = render(endsIn(6 * HOUR_MS))
    expect(html).toContain('Lite trial: 1 day left')
    expect(html).not.toContain('1 days')
    expect(html).not.toContain('ends today')
    expect(html).toContain('bg-wv-status-warning-bg')
  })

  it('uses the singular for the last day in Hindi and Gujarati', () => {
    state.language = 'hi'
    expect(render(endsIn(6 * HOUR_MS))).toContain('Lite ट्रायल: 1 दिन बाकी')
    state.language = 'gu'
    expect(render(endsIn(6 * HOUR_MS))).toContain('Lite ટ્રાયલ: 1 દિવસ બાકી')
  })

  it('rounds a part day up to the plural count, so 2.5 days left reads 3 days', () => {
    const html = render(endsIn(2.5 * DAY_MS))
    expect(html).toContain('Lite trial: 3 days left')
    expect(html).not.toContain('1 day left')
  })

  it('keeps the ends-today copy as the defensive fallback once the countdown has run out', () => {
    const html = render(endsIn(-HOUR_MS))
    expect(html).toContain('Lite trial ends today')
    expect(html).not.toContain('days left')
  })

  it('links to the owner billing page with the subscribe label and a 44px tap target', () => {
    const link = anchorFor(render(endsInDays(20)), '/owner/billing')
    expect(link).toContain('min-h-[44px]')
    expect(link).toContain('>Subscribe to keep Lite</a>')
  })

  it('is emphasised with the warning status tokens in the last 7 days, and calm before that', () => {
    const lastWeek = render(endsInDays(7))
    expect(lastWeek).toContain('bg-wv-status-warning-bg')
    expect(lastWeek).not.toContain('saffron')

    expect(render(endsInDays(8))).not.toContain('bg-wv-status-warning-bg')
  })

  it('renders the Gujarati and Hindi plural copy for the same countdown', () => {
    state.language = 'hi'
    expect(render(endsInDays(5))).toContain('Lite ट्रायल: 5 दिन बाकी')
    state.language = 'gu'
    expect(render(endsInDays(5))).toContain('Lite ટ્રાયલ: 5 દિવસ બાકી')
  })
})

describe('TrialEndedNotice dismissal storage', () => {
  it('keys the dismissal by organization', () => {
    expect(trialEndedDismissKey('org-1')).toBe('weavly:lite-trial-ended:org-1')
  })

  it('treats a missing window as not dismissed and never throws', () => {
    expect(readTrialEndedDismissal('org-1', ENDED_AT)).toBe(false)
    expect(() => writeTrialEndedDismissal('org-1', ENDED_AT)).not.toThrow()
  })

  it('remembers a dismissal for the same lapse only', () => {
    const data = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value) },
      },
    })
    expect(readTrialEndedDismissal('org-1', ENDED_AT)).toBe(false)
    writeTrialEndedDismissal('org-1', ENDED_AT)
    expect(data.get('weavly:lite-trial-ended:org-1')).toBe(ENDED_AT)
    expect(readTrialEndedDismissal('org-1', ENDED_AT)).toBe(true)
    expect(readTrialEndedDismissal('org-2', ENDED_AT)).toBe(false)
    expect(readTrialEndedDismissal('org-1', '2026-11-01T00:00:00.000Z')).toBe(false)
  })

  it('reads as not dismissed when reading the storage throws', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage { throw new Error('storage blocked') },
    })
    expect(readTrialEndedDismissal('org-1', ENDED_AT)).toBe(false)
    expect(() => writeTrialEndedDismissal('org-1', ENDED_AT)).not.toThrow()
  })

  it('reads as not dismissed when getItem or setItem throws', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('quota') },
        setItem: () => { throw new Error('quota') },
      },
    })
    expect(readTrialEndedDismissal('org-1', ENDED_AT)).toBe(false)
    expect(() => writeTrialEndedDismissal('org-1', ENDED_AT)).not.toThrow()
  })

  it('still renders the notice, not dismissed, when storage throws', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage { throw new Error('storage blocked') },
    })
    const html = renderToStaticMarkup(createElement(TrialEndedNotice, { orgId: 'org-1', endedAt: ENDED_AT }))
    expect(html).toContain('Your Lite trial has ended')
  })
})

describe('TrialEndedNotice content', () => {
  it('shows the title, the body, a dismiss button and a Subscribe link to the Free billing page', () => {
    const html = renderToStaticMarkup(createElement(TrialEndedNotice, { orgId: 'org-1', endedAt: ENDED_AT }))
    expect(html).toContain('Your Lite trial has ended')
    expect(html).toContain('You are now on Free.')
    expect(html).toContain('Dismiss')
    const link = anchorFor(html, '/free/billing')
    expect(link).toContain('min-h-[44px]')
    expect(link).toContain('>Subscribe to keep Lite</a>')
  })
})

describe('Free workspace shows the trial-ended notice only on Free', () => {
  it('renders the notice for an organization on Free whose trial lapsed', () => {
    state.workspace = { paid: false, tier: 'free' }
    const html = renderToStaticMarkup(createElement(FreeClient, { userId: 'u1', orgId: 'org-1', organizationName: 'Factory', trialEndedAt: ENDED_AT }))
    expect(html).toContain('Your Lite trial has ended')
  })

  it('never renders the notice when the organization resolves to no tier', () => {
    state.workspace = { paid: false, tier: 'none' }
    const html = renderToStaticMarkup(createElement(FreeClient, { userId: 'u1', orgId: 'org-1', organizationName: 'Factory', trialEndedAt: ENDED_AT }))
    expect(html).not.toContain('Your Lite trial has ended')
  })

  it('renders nothing extra when no lapsed trial is passed, and defaults to hidden', () => {
    state.workspace = { paid: false, tier: 'free' }
    const html = renderToStaticMarkup(createElement(FreeClient, { userId: 'u1', orgId: 'org-1', organizationName: 'Factory' }))
    expect(html).not.toContain('Your Lite trial has ended')
  })

  it('never renders the notice on a paid workspace', () => {
    state.workspace = { paid: true, tier: 'lite' }
    const html = renderToStaticMarkup(createElement(FreeClient, { userId: 'u1', orgId: 'org-1', organizationName: 'Factory', trialEndedAt: ENDED_AT }))
    expect(html).not.toContain('Your Lite trial has ended')
  })
})

describe('Trial surfaces are wired from the server', () => {
  it('the owner layout renders TrialBanner only when the access has a trial, above the route content', () => {
    const layout = read('app/(dashboard)/owner/layout.tsx')
    expect(layout).toContain("import { TrialBanner } from '@/components/billing/TrialBanner'")
    expect(layout).toMatch(/\{planAccess\.trialEndsAt \? \([\s\S]*?<TrialBanner endsAt=\{planAccess\.trialEndsAt\} \/>[\s\S]*?\) : null\}\s*\{children\}/)
  })

  it('the billing page presents a trial as "Free trial ends <date>" in Surat time, not as a paid period', () => {
    const page = read('app/(dashboard)/owner/billing/page.tsx')
    expect(page).toContain("import { formatToSurat } from '@/lib/time'")
    expect(page).toContain("import { liteTrialText } from '@/lib/i18n/lite-trial'")
    expect(page).toContain('const trialEndsAt = planAccess.trialEndsAt ?? null')
    expect(page).toMatch(/const accessTiming = trialEndsAt\s*\?\s*liteTrialText\('en', 'trialEndsOn', \{ date: formatToSurat\(trialEndsAt, 'd MMM yyyy'\) \}\)\s*:\s*paidAccessTiming/)
    expect(page).toContain("{trialEndsAt ? 'Free trial' : 'Annual access'}")
    expect(page).toContain("{trialEndsAt ? null : ' · Annual renewals are manual.'}")
  })

  it('the billing page offers the Lite subscribe button at first-year pricing from the purchase decision', () => {
    const page = read('app/(dashboard)/owner/billing/page.tsx')
    expect(page).toContain("const trialPrice = trialEndsAt ? getBillingPrice('lite', purchaseDecisions.lite.purchaseType) : null")
    expect(page).toMatch(/planTier="lite"[\s\S]{0,400}displayAmount=\{formatAmount\(trialPrice\.totalPaise\)\}/)
    expect(page).toContain('buttonLabel={`Subscribe for ${formatAmount(trialPrice.totalPaise)}`}')
  })

  it('the Free route passes the lapsed-trial end only to a Free organization', () => {
    const freePage = read('app/free/page.tsx')
    expect(freePage).toContain("trialEndedAt={access.effectiveTier === 'free' ? access.trialEndedAt ?? null : null}")
    const freeClient = read('app/free/FreeClient.tsx')
    expect(freeClient).toContain("import {TrialEndedNotice} from '@/components/billing/TrialEndedNotice'")
    expect(freeClient).toContain('trialEndedAt = null')
    expect(freeClient).toContain("{tier==='free'&&trialEndedAt&&<TrialEndedNotice orgId={orgId} endedAt={trialEndedAt} />}")
  })
})
