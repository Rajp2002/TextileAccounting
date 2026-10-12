import { describe, expect, it } from 'vitest'
import { buildCostingResult, calcFullTotals } from '@/lib/estimator'
import { makeSavedCostingTourExamples } from '@/lib/saved-costings-tour'
import {
    evaluateMarginAdjustment,
    marginBounds,
    marginsDiffer,
    previewMargin,
    snapMargin,
} from '@/lib/costing-margin'
import { f1State } from './fixtures/costing-characterization'

const [sampleV2] = makeSavedCostingTourExamples()

describe('what a margin means', () => {
    it('is the share of the SELLING price, so 12% on ₹17.44 of cost sells at ₹19.82', () => {
        // The guided tour's sample is built with a 12% margin (lib/saved-costings-tour.ts),
        // which is why its breakdown reads 12.0% and ₹19.82, not 10%.
        expect(sampleV2.estimate.profitPct).toBe(12)
        expect(sampleV2.result.productionCostPerM).toBe(17.44)
        expect(sampleV2.result.suggestedSellingPricePerM).toBe(19.82)
        expect(17.44 / (1 - 0.12)).toBeCloseTo(19.82, 2)
    })

    it('puts 10% at ₹19.38 (cost ÷ 0.90), not at a 10% mark-up on cost', () => {
        const at10 = previewMargin(sampleV2.estimate, 10)
        expect(at10.suggestedSellingPricePerM).toBe(19.38)
        expect(at10.suggestedSellingPricePerM).not.toBe(19.18)
        expect(at10.targetMarginPct).toBe(10)
        expect(at10.actualMarginPct).toBeCloseTo(10, 1)
    })

    it('keeps a typed margin readable after commission and transport are folded into the price', () => {
        const state = { ...sampleV2.estimate, commissionPct: 2, transportPerM: 1, enabledSections: { ...sampleV2.estimate.enabledSections, commission: true, transport: true } }
        const result = previewMargin(state, 10)
        expect(result.targetMarginPct).toBe(10)
        expect(result.actualMarginPct).toBeCloseTo(10, 0)
    })
})

describe('margin preview', () => {
    it('moves price and profit with the margin and never touches production cost', () => {
        const margins = [0, 5, 10, 12, 15, 20, 30]
        const results = margins.map(margin => previewMargin(sampleV2.estimate, margin))
        for (const result of results) expect(result.productionCostPerM).toBe(sampleV2.result.productionCostPerM)
        for (let index = 1; index < results.length; index += 1) {
            expect(results[index].suggestedSellingPricePerM).toBeGreaterThan(results[index - 1].suggestedSellingPricePerM)
            expect(results[index].profitPerM).toBeGreaterThan(results[index - 1].profitPerM)
        }
        expect(results[0].suggestedSellingPricePerM).toBe(results[0].productionCostPerM)
    })

    it('equals exactly what the save action stores for that margin', () => {
        const state = { ...sampleV2.estimate, profitPct: 14.5 }
        const stored = buildCostingResult(state, calcFullTotals(state))
        expect(previewMargin(sampleV2.estimate, 14.5)).toEqual(stored)
    })

    it('at the saved margin reproduces the saved price to the paisa', () => {
        expect(previewMargin(sampleV2.estimate, sampleV2.result.targetMarginPct).suggestedSellingPricePerM).toBe(sampleV2.result.suggestedSellingPricePerM)
    })
})

describe('slider range', () => {
    it('runs 0% to 30% in half-point steps for ordinary margins', () => {
        expect(marginBounds(12, 0)).toEqual({ min: 0, max: 30, step: 0.5 })
    })

    it('widens for a saved margin above the usual range', () => {
        expect(marginBounds(42, 0).max).toBe(45)
        expect(marginBounds(42, 0).max).toBeGreaterThanOrEqual(42)
    })

    it('never lets commission and margin reach 100%', () => {
        const bounds = marginBounds(1, 98)
        expect(bounds.max + 98).toBeLessThan(100)
        expect(marginBounds(12, 2).max + 2).toBeLessThan(100)
    })

    it('snaps to the step, clamps to the range and rejects noise', () => {
        const bounds = marginBounds(12, 0)
        expect(snapMargin(12.26, bounds)).toBe(12.5)
        expect(snapMargin(12.24, bounds)).toBe(12)
        expect(snapMargin(-3, bounds)).toBe(0)
        expect(snapMargin(80, bounds)).toBe(30)
        expect(snapMargin(0.1 + 0.2, bounds)).toBe(0.5)
        expect(snapMargin(Number.NaN, bounds)).toBe(0)
    })

    it('treats margins within half a hundredth as the same margin', () => {
        expect(marginsDiffer(12, 12)).toBe(false)
        expect(marginsDiffer(12, 12.001)).toBe(false)
        expect(marginsDiffer(12, 12.5)).toBe(true)
    })
})

describe('which saved costings can be adjusted', () => {
    it('allows a costing whose saved inputs reproduce its saved numbers', () => {
        expect(evaluateMarginAdjustment(sampleV2.estimate, sampleV2.result)).toEqual({ adjustable: true })
        const state = f1State({ profitPct: 12 })
        expect(evaluateMarginAdjustment(state, buildCostingResult(state, calcFullTotals(state)))).toEqual({ adjustable: true })
    })

    it('refuses when the saved price no longer follows from the saved inputs', () => {
        const stale = { ...sampleV2.result, suggestedSellingPricePerM: sampleV2.result.suggestedSellingPricePerM + 0.01 }
        expect(evaluateMarginAdjustment(sampleV2.estimate, stale)).toEqual({ adjustable: false, reason: 'mismatch' })
        const otherCost = { ...sampleV2.result, productionCostPerM: sampleV2.result.productionCostPerM + 1 }
        expect(evaluateMarginAdjustment(sampleV2.estimate, otherCost)).toEqual({ adjustable: false, reason: 'mismatch' })
    })

    it('refuses when the stored margin and the saved target disagree', () => {
        const other = { ...sampleV2.estimate, profitPct: 10 }
        expect(evaluateMarginAdjustment(other, sampleV2.result)).toMatchObject({ adjustable: false })
    })

    it('refuses inputs the save action would reject', () => {
        const broken = { ...sampleV2.estimate, warpRows: [{ ...sampleV2.estimate.warpRows[0], yarnRate: -5 }] }
        expect(evaluateMarginAdjustment(broken, sampleV2.result)).toMatchObject({ adjustable: false })
    })
})
