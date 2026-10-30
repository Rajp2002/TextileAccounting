import { describe, expect, it } from 'vitest'
import { activation, ghosts, lastSeen, plansNow, renewalsDue, signupsByMonth, timeSpentByMonth, trialsEndingSoon, upgradeSignals, usageShare, wantedToPay } from '@/lib/admin/growth-usage'
import { factory, term, trial } from './fixtures/growth'

const month = (value: string, minutes: number, extra: Partial<{ areas: Record<string, number>; phone: number; tablet: number; desktop: number; installed: number }> = {}) =>
    ({ month: value, minutes, areas: {}, phone: 0, tablet: 0, desktop: minutes, installed: 0, ...extra })

describe('plansNow', () => {
    it('splits Lite trial from paid Lite and counts Free', () => {
        const free = factory({ hasFreeGrant: true })
        const onTrial = factory({ hasFreeGrant: true, subscriptions: [trial('2026-10-01T00:00:00Z', '2026-12-30T00:00:00Z')] })
        const paid = factory({ subscriptions: [term('2026-10-01T00:00:00Z', '2027-10-01T00:00:00Z')] })
        expect(plansNow([free, onTrial, paid], '2026-11-01T00:00:00Z')).toMatchObject({ free: [free.id], lite_trial: [onTrial.id], lite_paid: [paid.id], base: [], none: [] })
    })
})

describe('signupsByMonth', () => {
    it('buckets signups by India month', () => {
        const late = factory({ createdAt: '2026-10-31T19:00:00Z' }), early = factory({ createdAt: '2026-10-05T06:00:00Z' })
        expect(signupsByMonth([late, early], ['2026-10', '2026-11'])).toEqual([{ month: '2026-10', ids: [early.id] }, { month: '2026-11', ids: [late.id] }])
    })
})

describe('activation', () => {
    it('first costing within 7 days, came back on a second day within 30', () => {
        const S1 = factory({ createdAt: '2026-11-01T06:00:00Z', costings: { count: 1, first: '2026-11-05T06:00:00Z', latest: '2026-11-05T06:00:00Z', earlyDays: ['2026-11-05'] },
            activity: { months: [], earlyDays: ['2026-11-05', '2026-11-12'], minutesLast30: 0, lastSeenAt: null } })
        const S2 = factory({ createdAt: '2026-11-02T06:00:00Z', costings: { count: 1, first: '2026-11-15T06:00:00Z', latest: '2026-11-15T06:00:00Z', earlyDays: ['2026-11-15'] } })
        const S3 = factory({ createdAt: '2026-11-27T06:00:00Z' })
        expect(activation([S1, S2, S3], ['2026-11'], '2026-11-30T00:00:00Z')).toEqual({
            signedUp: [S1.id, S2.id], activated: [S1.id], cameBack: [S1.id],
            activatedRate: { count: 1, of: 2, percent: 50 }, cameBackRate: { count: 1, of: 1, percent: 100 },
        })
    })
    it('one active day is not coming back', () => {
        const once = factory({ createdAt: '2026-11-01T06:00:00Z', costings: { count: 1, first: '2026-11-01T08:00:00Z', latest: '2026-11-01T08:00:00Z', earlyDays: ['2026-11-01'] },
            activity: { months: [], earlyDays: ['2026-11-01'], minutesLast30: 0, lastSeenAt: null } })
        expect(activation([once], ['2026-11'], '2026-11-30T00:00:00Z').cameBack).toEqual([])
    })
})

describe('timeSpentByMonth', () => {
    it('average and median over active accounts only, plan at month end', () => {
        const a = factory({ hasFreeGrant: true, activity: { months: [month('2026-12', 10)], earlyDays: [], minutesLast30: 0, lastSeenAt: null } })
        const b = factory({ hasFreeGrant: true, activity: { months: [month('2026-12', 20)], earlyDays: [], minutesLast30: 0, lastSeenAt: null } })
        const c = factory({ hasFreeGrant: true, subscriptions: [trial('2026-12-15T00:00:00Z', '2027-03-15T00:00:00Z')], activity: { months: [month('2026-12', 300)], earlyDays: [], minutesLast30: 0, lastSeenAt: null } })
        const idle = factory({ hasFreeGrant: true, activity: { months: [month('2026-12', 0)], earlyDays: [], minutesLast30: 0, lastSeenAt: null } })
        const [december] = timeSpentByMonth([a, b, c, idle], ['2026-12'], '2027-01-10T00:00:00Z')
        expect(december).toMatchObject({ month: '2026-12', accounts: 3, averageMinutes: 110, medianMinutes: 20 })
        expect(december.byPlan).toEqual({ free: { accounts: 2, averageMinutes: 15, medianMinutes: 15 }, lite_trial: { accounts: 1, averageMinutes: 300, medianMinutes: 300 } })
    })
    it('a month nobody used shows no average', () => {
        expect(timeSpentByMonth([factory()], ['2026-12'], '2027-01-10T00:00:00Z')[0]).toMatchObject({ accounts: 0, averageMinutes: null, medianMinutes: null })
    })
})

describe('usageShare', () => {
    it('shares of minutes by area and device', () => {
        const f = factory({ activity: { months: [month('2026-12', 100, { areas: { estimator: 60, rate_book: 20 }, phone: 75, desktop: 25, installed: 50 })], earlyDays: [], minutesLast30: 0, lastSeenAt: null } })
        const share = usageShare([f], ['2026-12'])
        expect(share.areas.estimator).toBeCloseTo(0.75); expect(share.areas.rate_book).toBeCloseTo(0.25)
        expect(share.devices).toEqual({ phone: 0.75, tablet: 0, desktop: 0.25 })
        expect(share.installedShare).toBe(0.5)
    })
})

describe('lastSeen and ghosts', () => {
    const quiet = factory({ createdAt: '2026-10-01T00:00:00Z', costings: { count: 1, first: '2026-10-02T00:00:00Z', latest: '2026-10-02T00:00:00Z', earlyDays: [] },
        activity: { months: [], earlyDays: [], minutesLast30: 0, lastSeenAt: '2026-12-15T00:00:00Z' } })
    const never = factory({ createdAt: '2026-12-01T00:00:00Z', owner: { name: null, phone: null, email: null, lastSignInAt: '2026-12-01T00:00:00Z' } })
    const active = factory({ createdAt: '2026-10-01T00:00:00Z', activity: { months: [], earlyDays: [], minutesLast30: 30, lastSeenAt: '2027-02-27T00:00:00Z' } })
    const fresh = factory({ createdAt: '2027-02-20T00:00:00Z' })

    it('last seen is the latest of activity, costing and sign-in', () => {
        expect(lastSeen(quiet)).toBe('2026-12-15T00:00:00Z')
        expect(lastSeen(never)).toBe('2026-12-01T00:00:00Z')
    })
    it('split never started and went quiet; new accounts are not ghosts; estimated while tracking is young', () => {
        expect(ghosts([quiet, never, active, fresh], '2027-03-01T00:00:00Z', '2026-11-06')).toEqual({ neverStarted: [never.id], wentQuiet: [quiet.id], estimated: false })
        expect(ghosts([quiet], '2026-12-01T00:00:00Z', '2026-11-06').estimated).toBe(true)
        expect(ghosts([quiet], '2027-03-01T00:00:00Z', null).estimated).toBe(true)
    })
})

describe('contact lists', () => {
    const asOf = '2026-12-01T00:00:00Z'
    const ending = (minutesLast30: number, phone: string | null = '+919800000001') => factory({
        subscriptions: [trial('2026-09-05T00:00:00Z', '2026-12-08T00:00:00Z')],
        owner: { name: 'Owner', phone, email: null, lastSignInAt: null },
        activity: { months: [], earlyDays: [], minutesLast30, lastSeenAt: null }, costings: { count: 3, first: null, latest: null, earlyDays: [] },
    })

    it('trials ending soon are sorted by recent minutes and keep owners without phones', () => {
        const busy = ending(120), idle = ending(0), noPhone = ending(40, null)
        const paidAnyway = factory({ subscriptions: [trial('2026-09-05T00:00:00Z', '2026-12-08T00:00:00Z'), term('2026-11-01T00:00:00Z', '2027-11-01T00:00:00Z')] })
        const rows = trialsEndingSoon([busy, idle, noPhone, paidAnyway], asOf)
        expect(rows.map(row => row.orgId)).toEqual([busy.id, noPhone.id, idle.id])
        expect(rows[1].phone).toBeNull()
        expect(rows[0]).toMatchObject({ detail: 'Ends in 7 days', minutesLast30: 120, costingsSaved: 3 })
    })

    it('renewals due within 30 days, soonest first', () => {
        const later = factory({ subscriptions: [term('2025-12-25T00:00:00Z', '2026-12-25T00:00:00Z')] })
        const sooner = factory({ subscriptions: [term('2025-12-12T00:00:00Z', '2026-12-12T00:00:00Z')] })
        const far = factory({ subscriptions: [term('2026-02-01T00:00:00Z', '2027-02-01T00:00:00Z')] })
        const rows = renewalsDue([later, sooner, far], asOf)
        expect(rows.map(row => row.orgId)).toEqual([sooner.id, later.id])
        expect(rows[0].detail).toBe('Lite ends 12 Dec')
    })

    it('checkout-not-completed signals only appear after go-live', () => {
        const tried = factory({ checkoutAttempts: [{ at: '2026-11-28T00:00:00Z', status: 'failed' }] })
        const done = factory({ checkoutAttempts: [{ at: '2026-11-28T00:00:00Z', status: 'failed' }, { at: '2026-11-29T00:00:00Z', status: 'activated' }] })
        expect(upgradeSignals([tried, done], null, asOf)).toEqual([])
        expect(upgradeSignals([tried, done], '2026-11-01T00:00:00Z', asOf).map(row => [row.orgId, row.detail])).toEqual([[tried.id, 'Checkout not completed']])
    })

    it('Notify me taps and Free signals from the last 14 days, newest first', () => {
        const tapped = factory({ interest: { firstAt: '2026-11-20T00:00:00Z', lastAt: '2026-11-25T00:00:00Z', taps: 2, lastSource: 'plan_card' } })
        const limit = factory({ freeSignals: [{ event: 'quota_reached', at: '2026-11-27T00:00:00Z' }] })
        const old = factory({ freeSignals: [{ event: 'upgrade_started', at: '2026-11-01T00:00:00Z' }] })
        expect(upgradeSignals([tapped, limit, old], null, asOf).map(row => [row.orgId, row.detail])).toEqual([[limit.id, 'Hit the monthly limit'], [tapped.id, 'Tapped Notify me']])
        expect(wantedToPay([tapped, limit]).map(row => row.orgId)).toEqual([tapped.id])
    })
})
