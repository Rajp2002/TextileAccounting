import { describe, expect, it } from 'vitest'
import type { CostRateRow } from '@/lib/cost-rates'
import { compareReviewUrgency, daysUntil, priceTrail, priceTrailPath, reviewDueDate, reviewOutcome, startRateReview, upcomingReviews } from '@/lib/rate-book-board'

const rate = (overrides: Partial<CostRateRow>): CostRateRow => ({
    id: overrides.name ?? 'rate',
    name: 'Yarn',
    category: 'yarn_warp',
    unit: 'per_kg',
    current_value: 140,
    previous_value: null,
    effective_date: '2026-10-02',
    last_reviewed_at: '2026-10-09',
    review_interval_days: 30,
    source: null,
    notes: null,
    apply_as_default: false,
    updated_at: '2026-10-09T00:00:00Z',
    is_active: true,
    is_reviewed: true,
    ...overrides,
})

describe('price review', () => {
    const now = new Date('2026-10-28T06:00:00Z')

    it('lists a never-confirmed yarn first, then the longest overdue, then the soonest due, then by name', () => {
        const rates = [
            rate({ name: 'due in 14', last_reviewed_at: '2026-10-12' }),
            rate({ name: 'b due in 13', last_reviewed_at: '2026-10-11' }),
            rate({ name: 'a due in 13', last_reviewed_at: '2026-10-11' }),
            rate({ name: 'overdue 1 day', last_reviewed_at: '2026-09-27' }),
            rate({ name: 'overdue 8 days', last_reviewed_at: '2026-09-20' }),
            rate({ name: 'unconfirmed', is_reviewed: false }),
        ]
        expect([...rates].sort((left, right) => compareReviewUrgency(left, right, now)).map(entry => entry.name))
            .toEqual(['unconfirmed', 'overdue 8 days', 'overdue 1 day', 'a due in 13', 'b due in 13', 'due in 14'])
    })

    it('keeps the prices due when the review opened, with each price and save stamp then', () => {
        const session = startRateReview([rate({ name: 'a', current_value: 115 }), rate({ name: 'b', current_value: 248, updated_at: '2026-10-12T00:00:00Z' })])
        expect(session.ids).toEqual(['a', 'b'])
        expect(session.before.b).toEqual({ value: 248, updatedAt: '2026-10-12T00:00:00Z' })
    })

    it('reads a price as waiting until it is saved again, then as confirmed or changed', () => {
        const before = { value: 115, updatedAt: '2026-10-11T00:00:00Z' }
        expect(reviewOutcome({ current_value: 115, updated_at: before.updatedAt }, before, true)).toBe('waiting')
        expect(reviewOutcome({ current_value: 115, updated_at: '2026-10-28T09:00:00Z' }, before, false)).toBe('confirmed')
        expect(reviewOutcome({ current_value: 120, updated_at: '2026-10-28T09:00:00Z' }, before, false)).toBe('changed')
        // A short review interval can leave a confirmed price due again at once; the new save stamp still marks it checked.
        expect(reviewOutcome({ current_value: 115, updated_at: '2026-10-28T09:00:00Z' }, before, true)).toBe('confirmed')
    })
})

describe('upcomingReviews', () => {
    const now = new Date('2026-10-10T06:00:00Z')

    it('groups current rates by their next review date, soonest first, and skips rates already due', () => {
        const rates = [
            rate({ name: 'a', last_reviewed_at: '2026-10-02' }),
            rate({ name: 'b', last_reviewed_at: '2026-10-02' }),
            rate({ name: 'c', last_reviewed_at: '2026-10-09' }),
            rate({ name: 'due soon', last_reviewed_at: '2026-09-15' }),
            rate({ name: 'unconfirmed', is_reviewed: false }),
        ]
        expect(upcomingReviews(rates, now)).toEqual([{ date: '2026-11-01', count: 2 }, { date: '2026-11-08', count: 1 }])
    })

    it('reads review dates and day counts as calendar days', () => {
        expect(reviewDueDate({ last_reviewed_at: '2026-10-02', review_interval_days: 30 })).toBe('2026-11-01')
        expect(daysUntil('2026-11-01', '2026-10-10')).toBe(22)
        expect(daysUntil('2026-11-01', '2026-11-02')).toBe(-1)
    })
})

describe('priceTrail', () => {
    it('orders the recorded prices, keeps the last one per day and ends on today’s price', () => {
        const trail = priceTrail([
            { date: '2026-10-02', value: 135 },
            { date: '2026-09-12', value: 128 },
            { date: '2026-10-02', value: 140 },
        ], 140, '2026-10-10')
        expect(trail).toEqual([
            { date: '2026-09-12', value: 128 },
            { date: '2026-10-02', value: 140 },
            { date: '2026-10-10', value: 140 },
        ])
    })

    it('draws nothing for a price that never moved or has no history', () => {
        expect(priceTrail([], 140, '2026-10-10')).toBeNull()
        expect(priceTrail([{ date: '2026-10-05', value: 145 }], 145, '2026-10-10')).toBeNull()
    })

    it('skips prices that apply after today', () => {
        expect(priceTrail([{ date: '2026-12-01', value: 160 }], 140, '2026-10-10')).toBeNull()
    })
})

describe('priceTrailPath', () => {
    it('scales between the lowest and highest price so a small change is a visible step', () => {
        const { line, area } = priceTrailPath([
            { date: '2026-09-12', value: 128 },
            { date: '2026-10-02', value: 140 },
            { date: '2026-10-10', value: 140 },
        ], 112, 40)
        expect(line).toBe('M0 34 H80 V4 H112 V4 H112')
        expect(area).toBe(`${line} V40 H0 Z`)
    })

    it('returns empty paths for an empty trail', () => {
        expect(priceTrailPath([], 112, 40)).toEqual({ line: '', area: '' })
    })
})
