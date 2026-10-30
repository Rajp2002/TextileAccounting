import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { liteRecordsCopy } from '@/lib/i18n/lite-records'

const fixture = vi.hoisted(() => ({ grant: true, tier: 'lite', saved: true }))
vi.mock('@/lib/free-account', () => ({ getFreeGrant: async () => fixture.grant ? { subjectId: 'synthetic-subject', org_id: 'synthetic-org' } : null, hasSavedFreeCostings: async () => fixture.saved }))
vi.mock('@/lib/auth', () => ({ getSessionHint: async () => null, getAuthenticatedUser: async () => ({ user: { id: 'synthetic-owner', user_metadata: {} }, profile: { org_id: 'synthetic-org' } }) }))
vi.mock('@/lib/subscription', () => ({ getCachedOrgPlanAccess: async () => ({ effectiveTier: fixture.tier, subscriptionTier: fixture.tier }) }))
vi.mock('@/lib/owner-organization', () => ({ getCachedOwnerOrganization: async () => ({ data: { name: 'Synthetic factory' } }) }))
vi.mock('@/app/(dashboard)/owner/estimator/actions', () => ({ getEstimatorQuotes: async () => ({ data: [] }), getEstimatorTemplates: async () => ({ data: [] }) }))
vi.mock('@/app/(dashboard)/owner/quotes/QuotesClient', () => ({ default: () => <div data-paid-library-fixture /> }))
vi.mock('@/app/free/costings/SavedFreeCostings', () => ({ default: ({ idPrefix = '' }: { idPrefix?: string }) => <div data-free-history-fixture data-id-prefix={idPrefix} /> }))
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ language: 'en' }) }))
import QuotesPage from '@/app/(dashboard)/owner/quotes/page'

describe('retained Free history on the verified owner route', () => {
  beforeEach(() => { fixture.grant = true; fixture.tier = 'lite'; fixture.saved = true })
  it.each(['lite', 'base', 'free', 'none'])('keeps one prior history instance for %s and only opts verified Lite into disclosure', async tier => {
    fixture.tier = tier
    const html = renderToStaticMarkup(await QuotesPage({ searchParams: Promise.resolve({}) }))
    expect(html.match(/data-free-history-fixture/g)).toHaveLength(1)
    expect(html).toContain('data-paid-library-fixture')
    expect(html.includes('data-lite-prior-history')).toBe(tier === 'lite')
    expect(html).toContain(`data-id-prefix="${tier === 'lite' ? 'lite-prior-' : ''}"`)
    if (tier === 'lite') expect(html).toContain('aria-expanded="false"')
  })
  it('does not introduce Free history without the existing grant', async () => {
    fixture.grant = false
    const html = renderToStaticMarkup(await QuotesPage({ searchParams: Promise.resolve({}) }))
    expect(html).not.toContain('data-free-history-fixture')
    expect(html).not.toContain('data-lite-prior-history')
  })
  it('hides the Free history when the grant has no saved costings, as on a trial account', async () => {
    fixture.saved = false
    const html = renderToStaticMarkup(await QuotesPage({ searchParams: Promise.resolve({}) }))
    expect(html).not.toContain('data-free-history-fixture')
    expect(html).not.toContain('data-lite-prior-history')
    expect(html).toContain('data-paid-library-fixture')
  })
  it('provides matching complete English, Hindi and Gujarati copy keys', () => {
    for (const language of ['hi', 'gu'] as const) {
      expect(Object.keys(liteRecordsCopy[language])).toEqual(Object.keys(liteRecordsCopy.en))
      expect(Object.values(liteRecordsCopy[language]).every(text => text.trim().length > 0)).toBe(true)
    }
  })
})
