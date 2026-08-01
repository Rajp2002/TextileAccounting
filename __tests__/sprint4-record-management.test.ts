import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getRateReviewStatus, type CostRateRow } from '../lib/cost-rates'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const discoveredRate: CostRateRow = {
    id: '00000000-0000-4000-8000-000000000004',
    name: '30/1000 Polyester',
    category: 'yarn_warp',
    unit: 'per_kg',
    current_value: 112,
    previous_value: null,
    effective_date: '2026-08-01',
    last_reviewed_at: '2026-08-01',
    review_interval_days: 90,
    source: 'Saved quality or costing',
    notes: 'Discovered from a saved quality layer.',
    apply_as_default: false,
    updated_at: '2026-08-01T00:00:00Z',
    is_reviewed: false,
}

describe('Sprint 4 quality, history, and record management', () => {
    it('does not treat automatically discovered yarn rates as reviewed', () => {
        expect(getRateReviewStatus(discoveredRate, new Date('2026-08-01T00:00:00Z'))).toBe('needs_review')
    })

    it('exposes recoverable lifecycle actions with version checks', () => {
        const actions = read('app/(dashboard)/owner/estimator/actions.ts')
        const rateActions = read('app/(dashboard)/owner/rates/actions.ts')

        expect(actions).toContain('export async function archiveTemplate')
        expect(actions).toContain('export async function restoreTemplate')
        expect(actions).toContain('This quality name is archived')
        expect(rateActions).toContain('export async function restoreCostRate')
        expect(rateActions).toContain("supabase.rpc('set_cost_rate_active_atomic'")
        expect(rateActions).toContain('p_expected_updated_at: expectedUpdatedAt')
    })

    it('keeps archived records read-only and makes draft dismissal explicit', () => {
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
        const library = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
        const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')

        expect(estimator).toContain('Discard this device draft?')
        expect(estimator).toContain('estimator.sprint1.correct_quality_name_help')
        expect(estimator).toContain('estimator.sprint1.save_name_correction')
        expect(library).toContain('Archived · read-only')
        expect(library).toContain('!latest.is_archived')
        expect(rates).toContain('Owner review needed')
        expect(rates).toContain('Recorded by {row.actor_name')
    })
})
