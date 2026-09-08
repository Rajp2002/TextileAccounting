import { describe, expect, it } from 'vitest'
import { hasCapability, hasEstablishedPaidHistory, resolveEffectiveSubscription, resolveOrgPlanAccess, tierSatisfies } from '../lib/subscription-access'
import { freeQuotaWindow } from '../lib/free-tier-policy'

describe('Free entitlement foundation', () => {
  it('retains Free after an unpaid cancelled checkout but never after established paid access', () => {
    const row = {plan_tier:'lite',status:'cancelled',current_end:null}
    expect(hasEstablishedPaidHistory([row])).toBe(false)
    expect(hasEstablishedPaidHistory([{...row,status:'failed'}])).toBe(false)
    expect(hasEstablishedPaidHistory([{...row,razorpay_payment_id:'captured-local-payment'}])).toBe(true)
    expect(hasEstablishedPaidHistory([{...row,current_end:'2025-01-01T00:00:00Z'}])).toBe(true)
    expect(hasEstablishedPaidHistory([{...row,status:'expired'}])).toBe(true)
  })
  it('grants calculation and account settings while excluding paid business capabilities', () => {
    expect(hasCapability('free', 'estimator')).toBe(true)
    expect(hasCapability('free', 'account_settings')).toBe(true)
    expect(hasCapability('free', 'saved_costings')).toBe(true)
    expect(hasCapability('free', 'export_document')).toBe(true)
    for (const capability of ['qualities', 'rate_book', 'existing_costing_tools', 'account_data', 'production', 'legacy_full_suite'] as const) {
      expect(hasCapability('free', capability)).toBe(false)
    }
    expect(tierSatisfies('free', 'base')).toBe(false)
    expect(tierSatisfies('free', 'premium')).toBe(false)
  })
  it('does not infer Free from absent, unknown, or expired subscriptions', () => {
    expect(resolveEffectiveSubscription([]).tier).toBe('none')
    for (const plan_tier of ['free', 'future', 'lite']) {
      expect(resolveEffectiveSubscription([{ plan_tier, status: 'expired', current_end: null }]).tier).toBe('none')
    }
    expect(resolveEffectiveSubscription([{ plan_tier: 'free', status: 'active', current_end: null }]).tier).toBe('none')
  })
  it('preserves Lite, Base, legacy and retained paid Base access', () => {
    for (const tier of ['lite', 'base', 'trial', 'premium'] as const) {
      expect(tierSatisfies(tier, 'base')).toBe(true)
      expect(hasCapability(tier, 'rate_book')).toBe(true)
      expect(hasCapability(tier, 'export_document')).toBe(true)
    }
    expect(resolveOrgPlanAccess('none', 'base', true).effectiveTier).toBe('lite')
    expect(resolveOrgPlanAccess('free', 'full_suite').effectiveTier).toBe('free')
    expect(resolveOrgPlanAccess('free', 'full_suite').productExperience).toBe('base')
  })
})

describe('India Monday quota window reference', () => {
  it('resets exactly at Sunday 18:30 UTC, independently of device timezone', () => {
    const before = freeQuotaWindow(new Date('2026-09-13T18:29:59.999Z'))
    const after = freeQuotaWindow(new Date('2026-09-13T18:30:00.000Z'))
    expect(before).toEqual({ start: '2026-09-06T18:30:00.000Z', end: '2026-09-13T18:30:00.000Z' })
    expect(after).toEqual({ start: before.end, end: '2026-09-20T18:30:00.000Z' })
  })
  it('handles year and leap-day boundaries', () => {
    expect(freeQuotaWindow(new Date('2027-01-01T00:00:00Z')).start).toBe('2026-12-27T18:30:00.000Z')
    expect(freeQuotaWindow(new Date('2028-02-29T00:00:00Z')).start).toBe('2028-02-27T18:30:00.000Z')
    expect(() => freeQuotaWindow(new Date('invalid'))).toThrow('INVALID_SERVER_TIME')
  })
})
