import { describe, expect, it } from 'vitest'
import {
  BASE_PLAN_OPEN_TO_NEW_ACCOUNTS,
  canViewBase,
  normalizeSignupPlan,
} from '../lib/base-plan-visibility'
import { LITE_TRIAL_DAYS, trialDaysLeft } from '../lib/lite-trial'

const DAY = 24 * 60 * 60 * 1000

describe('canViewBase', () => {
  it('Base launch switch stays closed until the launch is deliberate', () => {
    expect(BASE_PLAN_OPEN_TO_NEW_ACCOUNTS).toBe(false)
  })

  it('shows Base when the organization visibility flag is set', () => {
    expect(canViewBase({
      flag: true,
      effectiveTier: 'lite',
      subscriptionRows: [{ plan_tier: 'lite' }],
    })).toBe(true)
  })

  it('shows Base to an organization whose effective tier is base', () => {
    expect(canViewBase({
      flag: false,
      effectiveTier: 'base',
      subscriptionRows: [],
    })).toBe(true)
  })

  it('shows Base to any organization with a Base row, even an expired one', () => {
    // An expired Base period retains Lite as the effective tier.
    expect(canViewBase({
      flag: false,
      effectiveTier: 'lite',
      subscriptionRows: [{ plan_tier: 'lite' }, { plan_tier: 'base' }],
    })).toBe(true)
  })

  it('openToAll overrides the flag', () => {
    expect(canViewBase({
      flag: false,
      effectiveTier: 'free',
      subscriptionRows: [],
      openToAll: true,
    })).toBe(true)
  })

  it('hides Base from a fresh Lite or Free organization', () => {
    expect(canViewBase({
      flag: false,
      effectiveTier: 'lite',
      subscriptionRows: [{ plan_tier: 'lite' }],
    })).toBe(false)
    expect(canViewBase({
      flag: false,
      effectiveTier: 'free',
      subscriptionRows: [{ plan_tier: 'free' }],
    })).toBe(false)
    expect(canViewBase({
      flag: undefined,
      effectiveTier: 'none',
      subscriptionRows: [],
    })).toBe(false)
  })
})

describe('normalizeSignupPlan', () => {
  it('turns a Base signup into Free while Base is closed', () => {
    expect(normalizeSignupPlan('base')).toBe('free')
  })

  it('keeps Lite signups', () => {
    expect(normalizeSignupPlan('lite')).toBe('lite')
  })

  it('defaults a missing plan to Free', () => {
    expect(normalizeSignupPlan(undefined)).toBe('free')
  })

  it('keeps Base when Base is opened to all accounts', () => {
    expect(normalizeSignupPlan('base', true)).toBe('base')
  })
})

describe('trialDaysLeft', () => {
  const now = Date.parse('2026-10-11T00:00:00.000Z')

  it('the Lite trial is 30 days', () => {
    expect(LITE_TRIAL_DAYS).toBe(30)
  })

  it('rounds a partial day up', () => {
    const endsAt = new Date(now + 29.2 * DAY).toISOString()
    expect(trialDaysLeft(endsAt, now)).toBe(30)
  })

  it('returns zero at the exact end', () => {
    expect(trialDaysLeft(new Date(now).toISOString(), now)).toBe(0)
  })

  it('returns zero once the trial has passed', () => {
    const endsAt = new Date(now - 3 * DAY).toISOString()
    expect(trialDaysLeft(endsAt, now)).toBe(0)
  })
})
