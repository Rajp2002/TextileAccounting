import { describe, expect, it } from 'vitest'
import type { CostRateRow } from '@/lib/cost-rates'
import { daysUntil, priceMovesInMonth, priceTrail, priceTrailPath, reviewDueDate, upcomingReviews } from '@/lib/rate-book-board'

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

describe('priceMovesInMonth', () => {
    it('ranks this month’s changes by size and counts up, down and unchanged', () => {
        const rates = [
            rate({ name: 'Demo Polyester Weft 150D', current_value: 140, previous_value: 128, effective_date: '2026-10-02' }),
            rate({ name: '40 span', current_value: 115, previous_value: 107, effective_date: '2026-10-05' }),
            rate({ name: 'cheaper', current_value: 95, previous_value: 100, effective_date: '2026-10-07' }),
            rate({ name: 'mulati', current_value: 140, previous_value: null, effective_date: '2026-10-09' }),
            rate({ name: 'test', current_value: 145, previous_value: 145, effective_date: '2026-10-05' }),
            rate({ name: 'september', current_value: 150, previous_value: 120, effective_date: '2026-09-20' }),
        ]
        const { moves, up, down, unchanged } = priceMovesInMonth(rates, '2026-10')
        expect(moves.map(move => move.name)).toEqual(['Demo Polyester Weft 150D', '40 span', 'cheaper'])
        expect(moves[0].difference).toBe(12)
        expect(moves[0].percent).toBeCloseTo(9.375)
        expect(moves[2].percent).toBeCloseTo(-5)
        expect({ up, down, unchanged }).toEqual({ up: 2, down: 1, unchanged: 3 })
    })

    it('ignores a previous price of zero, which has no meaningful percentage', () => {
        expect(priceMovesInMonth([rate({ previous_value: 0, current_value: 10 })], '2026-10').moves).toEqual([])
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
