import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildCostingResult, calcFullTotals, makeDefaultEstimateState, type EstimateState } from '@/lib/estimator'
import { buildSavedCostingSpecs } from '@/lib/saved-costing-specs'
import { savedCostingSpecsText } from '@/lib/i18n/saved-costing-specs'

function savedCosting(edit: (state: EstimateState) => EstimateState) {
    const state = edit(makeDefaultEstimateState())
    return { state, result: buildCostingResult(state, calcFullTotals(state)) }
}

describe('saved costing inputs in the breakdown', () => {
    it('lists the construction, each yarn and the rates the costing was priced from', () => {
        const { state, result } = savedCosting(base => ({
            ...base,
            warpRows: [{ ...base.warpRows[0], label: 'Main', calcDenier: 75, beamEnds: 4800, yarnRate: 210, gstPct: 5, shortagePct: null }],
            weftRows: [{ ...base.weftRows[0], label: undefined, calcDenier: 150, picks: 52, reedSpace: 127, effectiveCostingWidthCm: 127, yarnRate: 180, gstPct: 5, shortagePct: 3 }],
            perPickCostPaisa: 0.16,
            yarnShortagePct: 2,
            warpingMode: 'outsourced',
            warpingRatePerKg: 12,
            sizingMode: 'in_house',
            overheadMode: 'direct',
            overheadOverridePerM: 10,
        }))
        const specs = buildSavedCostingSpecs(state, result)

        expect(specs.widthInches).toBe(50)
        expect(specs.totalEnds).toBe(4800)
        expect(specs.endsPerInch).toBe(96)
        expect(specs.totalPicks).toBe(52)
        expect(specs.warp).toEqual([expect.objectContaining({ name: 'Main', count: '75D', amount: 4800, ratePerKg: 210, gstPct: 5, wastePct: 2 })])
        expect(specs.weft).toEqual([expect.objectContaining({ name: null, count: '150D', amount: 52, ratePerKg: 180, wastePct: 3 })])
        expect(specs.weavingRatePerM).toBe(8.32)
        expect(specs.paisePerPick).toBe(16)
        expect(specs.warpingRatePerKg).toBe(12)
        expect(specs.sizingRatePerKg).toBeNull()
        expect(specs.overheadMode).toBe('direct')
        expect(specs.overheadPerM).toBe(10)
        expect(specs.overheadMonthlyTotal).toBeNull()
    })

    it('shows a manual-weight row by its weight, not a count', () => {
        const { state, result } = savedCosting(base => ({
            ...base,
            warpRows: [{ ...base.warpRows[0], calculationMode: 'manual', manualKgPer100m: 1.25 }],
        }))
        expect(buildSavedCostingSpecs(state, result).warp[0]).toEqual(expect.objectContaining({ count: null, manualKgPer100m: 1.25 }))
    })

    it('has every label in English, Hindi and Gujarati', () => {
        const keys = Object.keys(savedCostingSpecsText.en).sort()
        expect(Object.keys(savedCostingSpecsText.hi).sort()).toEqual(keys)
        expect(Object.keys(savedCostingSpecsText.gu).sort()).toEqual(keys)
    })

    it('renders under the economics of the saved costing breakdown, only for records with saved inputs', () => {
        const source = readFileSync('app/(dashboard)/owner/quotes/QuotesClient.tsx', 'utf8')
        expect(source).toContain('{activeSpecs && <SavedCostingSpecs specs={activeSpecs} />}')
        expect(source).toContain('activeRecord.snapshot_data != null')
    })
})
