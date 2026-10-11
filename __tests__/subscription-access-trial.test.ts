import { describe, expect, it } from 'vitest'
import {
  applyFreeGrantToAccess,
  hasEstablishedPaidHistory,
  resolveOrgAccessFromRows,
  type SubscriptionAccessRow,
} from '../lib/subscription-access'

const NOW = Date.parse('2026-10-11T00:00:00.000Z')

function trialRow(overrides: Partial<SubscriptionAccessRow> = {}): SubscriptionAccessRow {
  return {
    plan_tier: 'lite',
    status: 'active',
    current_start: '2026-10-01T00:00:00.000Z',
    current_end: '2026-10-31T00:00:00.000Z',
    razorpay_payment_id: null,
    created_at: '2026-10-01T00:00:00.000Z',
    is_trial: true,
    ...overrides,
  }
}

function paidLiteRow(overrides: Partial<SubscriptionAccessRow> = {}): SubscriptionAccessRow {
  return {
    plan_tier: 'lite',
    status: 'active',
    current_start: '2026-10-05T00:00:00.000Z',
    current_end: '2027-10-05T00:00:00.000Z',
    razorpay_payment_id: 'pay_test_paid_lite',
    created_at: '2026-10-05T00:00:00.000Z',
    is_trial: false,
    ...overrides,
  }
}

const LAPSED_TRIAL_END = '2026-10-10T00:00:00.000Z'

describe('trial-aware organization access', () => {
  it('an active trial row resolves to lite with trialEndsAt', () => {
    const rows = [trialRow()]
    const access = resolveOrgAccessFromRows({ rows, baseFlag: false, trialFlag: true, nowMs: NOW })

    expect(access.effectiveTier).toBe('lite')
    expect(access.subscriptionTier).toBe('lite')
    expect(access.trialEndsAt).toBe('2026-10-31T00:00:00.000Z')
    expect(access.trialEndedAt).toBeNull()
    expect(access.liteTrialEligible).toBe(false)
  })

  it('a trial row gets no 24 hour grace', () => {
    const oneMinuteAfterEnd = Date.parse(LAPSED_TRIAL_END) + 60 * 1000
    const lapsed = resolveOrgAccessFromRows({
      rows: [trialRow({ current_end: LAPSED_TRIAL_END })],
      baseFlag: false,
      trialFlag: true,
      nowMs: oneMinuteAfterEnd,
    })
    expect(lapsed.effectiveTier).toBe('none')

    // Exactly at the end the trial is still current; the boundary is inclusive.
    const atEnd = resolveOrgAccessFromRows({
      rows: [trialRow({ current_end: LAPSED_TRIAL_END })],
      baseFlag: false,
      trialFlag: true,
      nowMs: Date.parse(LAPSED_TRIAL_END),
    })
    expect(atEnd.effectiveTier).toBe('lite')

    // Non-trial rows keep the 24 hour grace after the same one-minute overrun.
    const paidWithGrace = resolveOrgAccessFromRows({
      rows: [paidLiteRow({ current_end: LAPSED_TRIAL_END, is_trial: false })],
      baseFlag: false,
      trialFlag: false,
      nowMs: oneMinuteAfterEnd,
    })
    expect(paidWithGrace.effectiveTier).toBe('lite')
  })

  it('a lapsed trial with a Free grant resolves to free and reports trialEndedAt', () => {
    const rows = [trialRow({ current_end: LAPSED_TRIAL_END })]
    const access = resolveOrgAccessFromRows({ rows, baseFlag: false, trialFlag: true, nowMs: NOW })
    expect(access.effectiveTier).toBe('none')
    expect(access.trialEndedAt).toBe(LAPSED_TRIAL_END)

    const granted = applyFreeGrantToAccess(access, rows, true)
    expect(granted.effectiveTier).toBe('free')
    expect(granted.subscriptionTier).toBe('free')
    expect(granted.freeAccount).toBe(true)
    expect(granted.trialEndedAt).toBe(LAPSED_TRIAL_END)
  })

  it('a lapsed trial without a Free grant resolves to none', () => {
    const rows = [trialRow({ current_end: LAPSED_TRIAL_END })]
    const access = resolveOrgAccessFromRows({ rows, baseFlag: false, trialFlag: true, nowMs: NOW })

    const ungranted = applyFreeGrantToAccess(access, rows, false)
    expect(ungranted.effectiveTier).toBe('none')
    expect(ungranted.freeAccount).toBeFalsy()
    expect(ungranted.trialEndedAt).toBe(LAPSED_TRIAL_END)
  })

  it('a lapsed paid lite row with a Free grant stays none and freeAccount', () => {
    const rows = [paidLiteRow({ current_end: '2026-01-01T00:00:00.000Z' })]
    const access = resolveOrgAccessFromRows({ rows, baseFlag: false, trialFlag: false, nowMs: NOW })
    expect(access.effectiveTier).toBe('none')
    expect(access.trialEndedAt).toBeNull()

    const granted = applyFreeGrantToAccess(access, rows, true)
    expect(granted.effectiveTier).toBe('none')
    expect(granted.subscriptionTier).toBe('none')
    expect(granted.freeAccount).toBe(true)
  })

  it('a trial row is not established paid history', () => {
    expect(hasEstablishedPaidHistory([trialRow()])).toBe(false)
    expect(hasEstablishedPaidHistory([trialRow({ status: 'expired' })])).toBe(false)
    // A cancelled row with a period is paid history, but a trial row never is.
    expect(hasEstablishedPaidHistory([trialRow({ status: 'cancelled' })])).toBe(false)
    expect(hasEstablishedPaidHistory([trialRow({ current_end: LAPSED_TRIAL_END }), paidLiteRow({ is_trial: false })])).toBe(true)
  })

  it('a paid lite row created after the trial wins and trialEndsAt is null', () => {
    const rows = [trialRow(), paidLiteRow()]
    const access = resolveOrgAccessFromRows({ rows, baseFlag: false, trialFlag: true, nowMs: NOW })

    expect(access.effectiveTier).toBe('lite')
    expect(access.trialEndsAt).toBeNull()
    expect(access.trialEndedAt).toBeNull()
    expect(access.liteTrialEligible).toBe(false)
  })

  it('liteTrialEligible is false when a trial row exists, when paid history exists, or when the flag is false', () => {
    const fresh = resolveOrgAccessFromRows({ rows: [], baseFlag: false, trialFlag: true, nowMs: NOW })
    expect(fresh.liteTrialEligible).toBe(true)

    const activeTrial = resolveOrgAccessFromRows({ rows: [trialRow()], baseFlag: false, trialFlag: true, nowMs: NOW })
    expect(activeTrial.liteTrialEligible).toBe(false)

    const lapsedTrial = resolveOrgAccessFromRows({
      rows: [trialRow({ current_end: LAPSED_TRIAL_END })],
      baseFlag: false,
      trialFlag: true,
      nowMs: NOW,
    })
    expect(lapsedTrial.liteTrialEligible).toBe(false)

    const lapsedPaid = resolveOrgAccessFromRows({
      rows: [paidLiteRow({ current_end: '2026-01-01T00:00:00.000Z' })],
      baseFlag: false,
      trialFlag: true,
      nowMs: NOW,
    })
    expect(lapsedPaid.liteTrialEligible).toBe(false)

    for (const trialFlag of [false, null, undefined] as const) {
      const flagged = resolveOrgAccessFromRows({ rows: [], baseFlag: false, trialFlag, nowMs: NOW })
      expect(flagged.liteTrialEligible).toBe(false)
    }
  })
})
