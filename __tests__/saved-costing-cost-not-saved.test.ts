import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createEstimatorDraft, parseEstimatorDraft } from '@/lib/estimator-drafts'
import { costingCatalogueText } from '@/lib/i18n/costing-catalogue'
import { getSavedCostingMetrics, type SavedCostingListItem } from '@/lib/saved-costings'

// Costings saved before 1 Aug 2026 (20260801141654_sprint0_costing_truth)
// have a saved price but no stored cost or result snapshot. Their card asks
// the owner to recalculate into a new version instead of showing a bare
// "Not available", and never rewrites the old version.

const olderCosting: SavedCostingListItem = {
    id: 'q-old',
    party_name: null,
    quality_label: 'D.NO:251 PENNAL',
    quote_price_per_meter: 52.56,
    landed_cost_per_meter: 0,
    intended_margin_percent: 10,
    meters: 0,
    created_at: '2026-07-22T10:00:00Z',
    updated_at: '2026-07-22T10:00:00Z',
    production_cost_per_meter: null,
    costing_result_snapshot: null,
}

describe('older saved costing without a stored cost', () => {
    it('has a saved price but no cost or margin', () => {
        const metrics = getSavedCostingMetrics(olderCosting)
        expect(metrics.status).toBe('legacy')
        expect(metrics.suggestedSellingPricePerM).toBe(52.56)
        expect(metrics.productionCostPerM).toBeNull()
        expect(metrics.actualMarginPct).toBeNull()
    })

    it('carries the "cost not saved" flag from Saved Costings into the estimator draft', () => {
        const draft = createEstimatorDraft({ state: { isConfigured: true }, partyName: '', qualityLabel: 'Q', warpInstruction: '', weftInstruction: '', sourceQuoteId: 'q-old', sourceCostNotSaved: true })
        const parsed = parseEstimatorDraft(JSON.stringify(draft))
        expect(parsed?.sourceCostNotSaved).toBe(true)

        const without = parseEstimatorDraft(JSON.stringify({ ...draft, sourceCostNotSaved: 'yes' }))
        expect(without?.sourceCostNotSaved).toBeUndefined()
    })

    it('the card offers Recalculate in place of Use and explains why', () => {
        const source = readFileSync('app/(dashboard)/owner/quotes/QuotesClient.tsx', 'utf8')
        expect(source).toContain('const costNotSaved = latestMetrics != null && latestMetrics.productionCostPerM == null')
        expect(source).toContain('copy.costNotSavedNote')
        expect(source).toContain('{copy.recalculate}')
        expect(source).toContain('sourceCostNotSaved: isDuplicate ? undefined : getProductionCostPerM(quote) == null || undefined')
    })

    it('the estimator explains the recalculation and clears the flag once saved', () => {
        const source = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
        expect(source).toContain('This costing was saved before Weavly kept cost and margin.')
        expect(source).toContain('setSourceCostNotSaved(false)')
    })

    it('has the new card copy in English, Hindi and Gujarati', () => {
        for (const language of ['en', 'hi', 'gu'] as const) {
            const copy = costingCatalogueText[language]
            expect(copy.notSaved.length).toBeGreaterThan(0)
            expect(copy.costNotSavedNote).toContain('v{n}')
            expect(copy.recalculate.length).toBeGreaterThan(0)
            expect(copy.recalculateLabel).toContain('{name}')
        }
    })
})
