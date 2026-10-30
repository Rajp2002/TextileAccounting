import { describe, expect, it } from 'vitest'
import { financialYear, financialYearMonths, indiaDay, indiaMonth } from '@/lib/admin/fiscal'
import { freeToLite, liteRenewals, rate, revenueReport, trialOutcomes } from '@/lib/admin/growth-money'
import { factory, pay, term, trial } from './fixtures/growth'

const GO = '2026-12-01T00:00:00Z'

describe('fiscal helpers', () => {
    it.each([['2026-03-31T18:29:59Z', '2025–26'], ['2026-03-31T18:30:00Z', '2026–27']])('financialYear(%s) is %s', (at, label) => {
        expect(financialYear(at).label).toBe(label)
    })
    it('financial year bounds are 1 April 00:00 India time, end exclusive', () => {
        expect(financialYear('2026-10-30T00:00:00Z')).toEqual({ label: '2026–27', start: '2026-03-31T18:30:00.000Z', end: '2027-03-31T18:30:00.000Z' })
    })
    it('lists April to March and buckets by India date', () => {
        expect(financialYearMonths('2026–27')).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'])
        expect(indiaDay('2026-10-30T19:00:00Z')).toBe('2026-10-31')
        expect(indiaMonth('2026-10-31T19:00:00Z')).toBe('2026-11')
    })
})

describe('rate', () => {
    it('never divides by zero', () => {
        expect(rate(0, 0)).toEqual({ count: 0, of: 0, percent: null })
        expect(rate(1, 3).percent).toBeCloseTo(33.33, 1)
        expect(rate(1, 2)).toEqual({ count: 1, of: 2, percent: 50 })
    })
})

describe('revenueReport', () => {
    it('nets refunds in their month, subtracts refunded payments without a refund row, and ignores pre-go-live payments', () => {
        const p1 = pay('2026-12-10T06:00:00Z', 299900)
        const fs = [factory({
            payments: [pay('2026-11-20T06:00:00Z', 299900), p1, { ...pay('2027-02-01T06:00:00Z', 299900), status: 'refunded' }, pay('2027-04-02T06:00:00Z', 149900, 'lite', 'renewal')],
            refunds: [{ paymentId: p1.id, amountPaise: 50000, at: '2027-01-05T06:00:00Z' }],
        })]
        const report = revenueReport(fs, GO, '2027-05-01T00:00:00Z', '2026–27')!
        expect(report).toMatchObject({ fyPaise: 249900, allTimePaise: 399800 })
        expect(report.months).toHaveLength(12)
        expect(report.months.find(month => month.month === '2026-12')).toMatchObject({ newPaise: 299900, renewalPaise: 0, refundPaise: 0, litePaise: 299900 })
        expect(report.months.find(month => month.month === '2027-01')).toMatchObject({ refundPaise: 50000 })
        expect(report.months.find(month => month.month === '2027-02')).toMatchObject({ newPaise: 299900, refundPaise: 299900 })
        expect(revenueReport(fs, GO, '2027-05-01T00:00:00Z', '2027–28')).toMatchObject({ fyPaise: 149900, lastFyPaise: 249900 })
        expect(revenueReport(fs, null, '2027-05-01T00:00:00Z', '2026–27')).toBeNull()
    })
})

describe('trialOutcomes', () => {
    it('converted within 14 days, back to Free, deciding, and pre-go-live trials excluded', () => {
        const A = factory({ subscriptions: [trial('2026-09-11T00:00:00Z', '2026-12-10T00:00:00Z')], payments: [pay('2026-12-20T06:00:00Z', 299900)] })
        const B = factory({ subscriptions: [trial('2026-09-06T00:00:00Z', '2026-12-05T00:00:00Z')] })
        const C = factory({ subscriptions: [trial('2026-09-26T00:00:00Z', '2026-12-25T00:00:00Z')] })
        const D = factory({ subscriptions: [trial('2026-10-21T00:00:00Z', '2026-11-20T00:00:00Z')] })
        expect(trialOutcomes([A, B, C, D], GO, '2026-12-30T00:00:00Z')).toEqual({
            converted: [A.id], backToFree: [B.id], deciding: [C.id], rate: { count: 1, of: 2, percent: 50 },
        })
        expect(trialOutcomes([A], null, '2026-12-30T00:00:00Z')).toBeNull()
    })
    it('a payment more than 14 days after the trial ended is not a trial conversion', () => {
        const late = factory({ subscriptions: [trial('2026-09-06T00:00:00Z', '2026-12-05T00:00:00Z')], payments: [pay('2026-12-25T06:00:00Z', 299900)] })
        expect(trialOutcomes([late], GO, '2027-01-10T00:00:00Z')).toMatchObject({ converted: [], backToFree: [late.id] })
    })
})

describe('freeToLite', () => {
    it('counts later live Lite payments and the median days', () => {
        const E = factory({ hasFreeGrant: true, createdAt: '2026-12-02T06:00:00Z', payments: [pay('2026-12-12T06:00:00Z', 299900)] })
        const F = factory({ hasFreeGrant: true, createdAt: '2026-12-03T06:00:00Z' })
        const notFree = factory({ hasFreeGrant: false })
        expect(freeToLite([E, F, notFree], GO, '2027-01-10T00:00:00Z')).toEqual({ converted: [E.id], everFree: [E.id, F.id], rate: { count: 1, of: 2, percent: 50 }, medianDays: 10 })
        expect(freeToLite([E], null, '2027-01-10T00:00:00Z')).toBeNull()
    })
    it('a trial account is Free only after its trial ends unpaid', () => {
        const running = factory({ hasFreeGrant: true, subscriptions: [trial('2026-12-01T00:00:00Z', '2027-03-01T00:00:00Z')] })
        const lapsed = factory({ hasFreeGrant: true, subscriptions: [trial('2026-09-01T00:00:00Z', '2026-12-05T00:00:00Z')] })
        expect(freeToLite([running, lapsed], GO, '2027-01-10T00:00:00Z')?.everFree).toEqual([lapsed.id])
    })
})

describe('liteRenewals', () => {
    it('within ±30 days renews, later is won back, young terms are excluded', () => {
        const t1 = term('2026-12-01T00:00:00Z', '2027-12-01T00:00:00Z'), t2 = term('2026-12-01T00:00:00Z', '2027-12-01T00:00:00Z'), t3 = term('2027-01-20T00:00:00Z', '2028-01-20T00:00:00Z')
        const T1 = factory({ subscriptions: [t1], payments: [pay('2026-12-01T06:00:00Z', 299900, 'lite', 'initial_purchase', t1.id), pay('2027-11-15T06:00:00Z', 149900, 'lite', 'renewal')] })
        const T2 = factory({ subscriptions: [t2], payments: [pay('2026-12-01T06:00:00Z', 299900, 'lite', 'initial_purchase', t2.id), pay('2028-01-15T06:00:00Z', 299900)] })
        const T3 = factory({ subscriptions: [t3], payments: [pay('2027-01-20T06:00:00Z', 299900, 'lite', 'initial_purchase', t3.id)] })
        expect(liteRenewals([T1, T2, T3], GO, '2028-02-01T00:00:00Z')).toEqual({ terms: [T1.id, T2.id], renewed: [T1.id], wonBack: [T2.id], rate: { count: 1, of: 2, percent: 50 } })
    })
    it('terms without a linked live payment are not paid terms', () => {
        const unpaid = factory({ subscriptions: [term('2026-12-01T00:00:00Z', '2027-12-01T00:00:00Z')] })
        expect(liteRenewals([unpaid], GO, '2028-02-01T00:00:00Z')?.terms).toEqual([])
    })
})
