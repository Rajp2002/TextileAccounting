import { describe, expect, it } from 'vitest'
import { buildCostingResult, calcFullTotals, type EstimateState } from '@/lib/estimator'
import { buildEstimatorQuotePayload } from '@/lib/estimator-quote-payload'
import { resolveSavedCostingInputBasis, restoreSavedQualityCostingAssumptions } from '@/lib/saved-costings'
import { makeDefaultEstimateState } from '@/lib/estimator'
import { f1State } from './fixtures/costing-characterization'

// LT01B (LC74 / CS-2): a saved costing keeps the warping and overhead basis it
// was calculated on, so reopening it does not silently change its inputs.

function payloadFor(estimate: EstimateState) {
    const totals = calcFullTotals(estimate)
    const result = buildCostingResult(estimate, totals)
    return buildEstimatorQuotePayload({
        orgId: 'org', recordKind: 'costing', partyName: null, qualityLabel: 'Q', templateId: null,
        warpInstruction: null, weftInstruction: null, estimate, result,
        commercial: { commissionPct: 3, transportPerM: 0.5, orderQuantityM: 5000, profitPct: 12 },
        status: 'draft', clientRequestId: 'req', workerRatePerM: 0, costingInputFingerprint: null,
        factoryProfileUpdatedAt: null, reconciledAt: '2026-10-04T00:00:00.000Z',
    })
}

describe('saved costing payload keeps the input basis', () => {
    it('stores in-house warping even when a reference warping rate is kept', () => {
        const payload = payloadFor(f1State({ warpingMode: 'in_house', warpingRatePerKg: 12 }))
        expect(payload).toMatchObject({ warping_mode: 'in_house', warping_rate_per_kg: 12 })
    })

    it('stores the overhead the engine applied in monthly mode', () => {
        const payload = payloadFor(f1State({ overheadMode: 'monthly_expenses', overheadOverridePerM: 2.5 }))
        expect(payload).toMatchObject({ overhead_mode: 'monthly_expenses', overhead_override_per_m: 2.5 })
        expect(payload.overhead_per_meter).toBe(2.5)
    })

    it('stores direct mode and its rate', () => {
        expect(payloadFor(f1State({ overheadMode: 'direct', overheadOverridePerM: 3 }))).toMatchObject({ overhead_mode: 'direct', overhead_override_per_m: 3 })
    })

    it('stores a derived monthly overhead as no override', () => {
        expect(payloadFor(f1State())).toMatchObject({ overhead_mode: 'monthly_expenses', overhead_override_per_m: null, warping_mode: 'outsourced' })
    })

    it('records the warping mode the engine inferred when none was set', () => {
        const estimate = { ...f1State({ warpingRatePerKg: 12 }), warpingMode: undefined } as unknown as EstimateState
        expect(payloadFor(estimate).warping_mode).toBe('outsourced')
    })
})

describe('reading a saved costing basis', () => {
    it('prefers the stored modes over inference', () => {
        expect(resolveSavedCostingInputBasis({
            warping_mode: 'in_house', warping_rate_per_kg: 12, overhead_mode: 'monthly_expenses', overhead_override_per_m: 2.5,
        })).toEqual({ warpingMode: 'in_house', overheadMode: 'monthly_expenses', overheadOverridePerM: 2.5 })
    })

    it('keeps the legacy inference for records saved before the basis was stored', () => {
        expect(resolveSavedCostingInputBasis({ warping_rate_per_kg: 12, overhead_override_per_m: null })).toEqual({
            warpingMode: 'outsourced', overheadMode: 'monthly_expenses', overheadOverridePerM: null,
        })
        expect(resolveSavedCostingInputBasis({ warping_rate_per_kg: 0, overhead_override_per_m: 3, warping_mode: null, overhead_mode: null })).toEqual({
            warpingMode: undefined, overheadMode: 'direct', overheadOverridePerM: 3,
        })
    })

    it('lets an in-memory snapshot win over the row', () => {
        expect(resolveSavedCostingInputBasis(
            { warping_mode: 'outsourced', overhead_mode: 'direct', overhead_override_per_m: 3 },
            { warpingMode: 'in_house', overheadMode: 'monthly_expenses', overheadOverridePerM: 1.5 },
        )).toEqual({ warpingMode: 'in_house', overheadMode: 'monthly_expenses', overheadOverridePerM: 1.5 })
    })

    it('reopens to the same production cost as was saved', () => {
        const saved = f1State({ warpingMode: 'in_house', warpingRatePerKg: 12, overheadMode: 'monthly_expenses', overheadOverridePerM: 2.5 })
        const payload = payloadFor(saved)
        const basis = resolveSavedCostingInputBasis(payload)
        const reopened = { ...saved, ...basis, warpingMode: basis.warpingMode ?? saved.warpingMode } as EstimateState
        const reopenedResult = buildCostingResult(reopened, calcFullTotals(reopened))
        expect(reopenedResult.productionCostPerM).toBe(payload.production_cost_per_meter)
    })
})

describe('reusing the latest costing assumptions on a saved quality', () => {
    it('keeps monthly mode with its applied overhead and the warping mode', () => {
        const restored = restoreSavedQualityCostingAssumptions({ ...makeDefaultEstimateState(), warpingMode: 'outsourced' }, {
            overhead_mode: 'monthly_expenses', overhead_override_per_m: 2.5, warping_mode: 'in_house', warping_rate_per_kg: 12,
        })
        expect(restored).toMatchObject({ overheadMode: 'monthly_expenses', overheadOverridePerM: 2.5, warpingMode: 'in_house', warpingRatePerKg: 12 })
    })
})
