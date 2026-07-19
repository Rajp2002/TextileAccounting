import { describe, expect, it } from 'vitest'
import { filterCostRates, formatRateValue, getRateReviewDueDate, getRateReviewStatus, type CostRateRow } from '../lib/cost-rates'

const base: CostRateRow = {
    id: '00000000-0000-4000-8000-000000000001',
    name: '75D Polyester',
    category: 'yarn_warp',
    unit: 'per_kg',
    current_value: 110,
    previous_value: 105,
    effective_date: '2026-07-01',
    last_reviewed_at: '2026-07-01',
    review_interval_days: 90,
    source: 'Supplier A',
    notes: 'Email confirmation',
    apply_as_default: true,
    updated_at: '2026-07-01T00:00:00Z',
}

describe('cost rate review memory', () => {
    it('calculates deterministic review due dates and statuses', () => {
        expect(getRateReviewDueDate(base).toISOString().slice(0, 10)).toBe('2026-09-29')
        expect(getRateReviewStatus(base, new Date('2026-09-10T00:00:00Z'))).toBe('current')
        expect(getRateReviewStatus(base, new Date('2026-09-20T00:00:00Z'))).toBe('due_soon')
        expect(getRateReviewStatus(base, new Date('2026-10-01T00:00:00Z'))).toBe('overdue')
    })

    it('filters by text, category, and review status', () => {
        const rates: CostRateRow[] = [
            base,
            { ...base, id: '00000000-0000-4000-8000-000000000002', name: 'Processing', category: 'processing', unit: 'per_m', source: 'Internal', last_reviewed_at: '2026-01-01' },
        ]
        expect(filterCostRates(rates, { query: 'supplier', category: 'all', status: 'all' }, new Date('2026-07-19')).map(rate => rate.name)).toEqual(['75D Polyester'])
        expect(filterCostRates(rates, { query: '', category: 'processing', status: 'overdue' }, new Date('2026-07-19')).map(rate => rate.name)).toEqual(['Processing'])
    })

    it('formats money and percentage units clearly', () => {
        expect(formatRateValue(110, 'per_kg')).toBe('₹110.00/kg')
        expect(formatRateValue(2.5, 'percent')).toBe('2.50%')
    })
})
