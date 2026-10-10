import { describe, expect, it } from 'vitest'
import {
    allocateWeftPicks,
    buildCostingResult,
    calcFullTotals,
    getTotalWeftPicks,
    getWeftPickConvention,
    type EstimateState,
} from '@/lib/estimator'
import { validateEstimatorSnapshot } from '@/lib/estimator-validation'
import { f1State, warpRow, weftRow } from './fixtures/costing-characterization'

// Multiple-warp and multiple-weft engine requirements (owner brief, 2026-10-10).
// Expected values are worked by hand from the documented formulas:
//   warp kg/100m = denier × ends × 100 / 9,000,000
//   weft kg/100m = denier × PPI × width inches × 100 / 9,000,000
// with no GST, waste or crimp unless a test says otherwise.

const plain: Partial<EstimateState> = {
    yarnShortagePct: 0,
    warpCrimpPct: 0,
    enabledSections: { winding: false, processing: false, finishing: false, commission: false, transport: false },
}

function totalsFor(state: EstimateState) {
    return calcFullTotals(state)
}

function doubleLayer(overrides: Partial<EstimateState> = {}): EstimateState {
    return f1State({
        ...plain,
        warpRows: [
            warpRow({ id: 'face-warp', label: 'Face warp', calcDenier: 75, beamEnds: 3444, yarnRate: 180, gstPct: 0 }),
            warpRow({ id: 'back-warp', label: 'Back warp', calcDenier: 150, beamEnds: 1722, yarnRate: 200, gstPct: 0 }),
        ],
        weftRows: [
            weftRow({ id: 'face-weft', label: 'Face weft', calcDenier: 75, picks: 32, yarnRate: 170, gstPct: 0, pickRatio: null }),
            weftRow({ id: 'back-weft', label: 'Back weft', calcDenier: 150, picks: 32, yarnRate: 150, gstPct: 0, pickRatio: null }),
        ],
        ...overrides,
    })
}

describe('pick allocation', () => {
    it('Test A: 64 total PPI at 1:1 gives each weft 32 PPI', () => {
        const allocation = allocateWeftPicks(64, [1, 1])
        expect(allocation).toEqual({ ok: true, picks: [32, 32], totalPicks: 64 })
    })

    it('Test B: 64 total PPI at 2:1 gives two thirds and one third, summing to 64', () => {
        const allocation = allocateWeftPicks(64, [2, 1])
        if (!allocation.ok) throw new Error('allocation failed')
        expect(allocation.picks[0]).toBeCloseTo(128 / 3, 10)
        expect(allocation.picks[1]).toBeCloseTo(64 / 3, 10)
        expect(allocation.picks[0] + allocation.picks[1]).toBe(64)
    })

    it('Test C: 64 PPI for each weft in per-system mode means 128 total, never halved', () => {
        const state = doubleLayer({
            weftRows: [
                weftRow({ id: 'a', picks: 64, pickRatio: null }),
                weftRow({ id: 'b', picks: 64, pickRatio: null }),
            ],
        })
        expect(getWeftPickConvention(state.weftRows)).toBe('per_system')
        expect(getTotalWeftPicks(state.weftRows)).toBe(128)
        const totals = totalsFor(state)
        expect(totals.weftRows.map(row => row.picks)).toEqual([64, 64])
        expect(totals.weftRows.map(row => row.formulaLengthM)).toEqual([100, 100])
        // Same yarn, 64 PPI over 50 inches: 75 × 64 × 50 × 100 / 9e6 kg/100m each.
        expect(totals.weftRows[0].baseKgPer100mUsed).toBeCloseTo(75 * 64 * 50 * 100 / 9_000_000, 12)
        expect(totals.weftRows[1].baseKgPer100mUsed).toBeCloseTo(75 * 64 * 50 * 100 / 9_000_000, 12)
    })

    it('rejects a missing total and invalid ratios', () => {
        expect(allocateWeftPicks(0, [1, 1])).toEqual({ ok: false, reason: 'total_picks' })
        expect(allocateWeftPicks(Number.NaN, [1, 1])).toEqual({ ok: false, reason: 'total_picks' })
        expect(allocateWeftPicks(64, [1, 0])).toEqual({ ok: false, reason: 'ratio' })
        expect(allocateWeftPicks(64, [1, -2])).toEqual({ ok: false, reason: 'ratio' })
        expect(allocateWeftPicks(64, [])).toEqual({ ok: false, reason: 'ratio' })
    })
})

describe('independent yarn systems', () => {
    it('costs every warp and weft system separately for a double-layer fabric', () => {
        const totals = totalsFor(doubleLayer())
        expect(totals.warpRows[0].baseKgPer100mUsed).toBeCloseTo(2.87, 12)
        expect(totals.warpRows[1].baseKgPer100mUsed).toBeCloseTo(2.87, 12)
        expect(totals.weftRows[0].baseKgPer100mUsed).toBeCloseTo(4 / 3, 12)
        expect(totals.weftRows[1].baseKgPer100mUsed).toBeCloseTo(8 / 3, 12)
        expect(totals.warpRows[0].costPerMeter).toBeCloseTo(5.166, 10)
        expect(totals.warpRows[1].costPerMeter).toBeCloseTo(5.74, 10)
        expect(totals.weftRows[0].costPerMeter).toBeCloseTo(34 / 15, 10)
        expect(totals.weftRows[1].costPerMeter).toBeCloseTo(4, 10)
    })

    it('Test D: a yarn price changes only that system’s cost, never its picks or consumption', () => {
        const before = totalsFor(doubleLayer())
        const repriced = doubleLayer()
        repriced.weftRows = repriced.weftRows.map(row => row.id === 'back-weft' ? { ...row, yarnRate: 300 } : row)
        const after = totalsFor(repriced)
        expect(after.weftRows.map(row => row.picks)).toEqual(before.weftRows.map(row => row.picks))
        expect(after.weftRows.map(row => row.kgPer100m)).toEqual(before.weftRows.map(row => row.kgPer100m))
        expect(after.warpRows.map(row => row.kgPer100m)).toEqual(before.warpRows.map(row => row.kgPer100m))
        expect(after.weftRows[0].costPerMeter).toBe(before.weftRows[0].costPerMeter)
        expect(after.weftRows[1].costPerMeter).toBeCloseTo(before.weftRows[1].costPerMeter * 2, 10)
    })

    it('Test E: doubling one weft’s PPI doubles that system’s consumption and raw yarn cost only', () => {
        const before = totalsFor(doubleLayer())
        const doubled = doubleLayer()
        doubled.weftRows = doubled.weftRows.map(row => row.id === 'face-weft' ? { ...row, picks: row.picks * 2 } : row)
        const after = totalsFor(doubled)
        expect(after.weftRows[0].kgPer100m).toBeCloseTo(before.weftRows[0].kgPer100m * 2, 12)
        expect(after.weftRows[0].baseCostPerMeter).toBeCloseTo(before.weftRows[0].baseCostPerMeter * 2, 12)
        expect(after.weftRows[1].kgPer100m).toBe(before.weftRows[1].kgPer100m)
        expect(after.weftRows[1].costPerMeter).toBe(before.weftRows[1].costPerMeter)
    })

    it('Test F: total raw yarn cost is the sum of every active system, none counted twice or left out', () => {
        const state = doubleLayer({ yarnShortagePct: 2, warpCrimpPct: 3 })
        state.weftRows = state.weftRows.map(row => ({ ...row, gstPct: 5 }))
        const totals = totalsFor(state)
        const systems = [...totals.warpRows, ...totals.weftRows]
        const sumOfSystems = systems.reduce((sum, row) => sum + row.costPerMeter, 0)
        expect(totals.warpCostPerM + totals.weftCostPerM).toBeCloseTo(sumOfSystems, 10)
        expect(totals.audit.yarnTotalCostPerMeter).toBeCloseTo(sumOfSystems, 10)
        expect(totals.audit.warp.layers).toHaveLength(2)
        expect(totals.audit.weft.layers).toHaveLength(2)
        expect(totals.warpCostPerM).toBeCloseTo(totals.warpRows[0].costPerMeter + totals.warpRows[1].costPerMeter, 10)
        expect(totals.weftCostPerM).toBeCloseTo(totals.weftRows[0].costPerMeter + totals.weftRows[1].costPerMeter, 10)
        // Hand total before allowances: 5.166 + 5.74 + 2.2667 × 1.05 + 4 × 1.05.
        expect(totals.yarnBaseWarpPerM + totals.yarnBaseWeftPerM).toBeCloseTo(5.166 + 5.74 + (34 / 15) * 1.05 + 4 * 1.05, 10)
    })

    it('applies each system’s own crimp and waste, falling back to the factory warp crimp', () => {
        const state = doubleLayer({ warpCrimpPct: 4, yarnShortagePct: 1 })
        state.warpRows = state.warpRows.map(row => row.id === 'back-warp' ? { ...row, crimpPct: 10 } : row)
        state.weftRows = state.weftRows.map(row => row.id === 'back-weft' ? { ...row, crimpPct: 2, shortagePct: 3 } : row)
        const totals = totalsFor(state)
        expect(totals.warpRows[0].totalAdjustmentPct).toBe(5)
        expect(totals.warpRows[1].totalAdjustmentPct).toBe(11)
        expect(totals.weftRows[0].totalAdjustmentPct).toBe(1)
        expect(totals.weftRows[1].totalAdjustmentPct).toBe(5)
        expect(totals.weftRows[1].finalKgPer100m).toBeCloseTo((8 / 3) * 1.05, 12)
    })

    it('charges weaving on the fabric’s total picks in both conventions', () => {
        const perSystem = doubleLayer({ perPickCostPaisa: 0.16 })
        const allocation = allocateWeftPicks(64, [1, 1])
        if (!allocation.ok) throw new Error('allocation failed')
        const totalRatio = doubleLayer({ perPickCostPaisa: 0.16 })
        totalRatio.weftRows = totalRatio.weftRows.map((row, index) => ({ ...row, pickRatio: 1, picks: allocation.picks[index] }))
        expect(totalsFor(perSystem).weaveCostPerM).toBeCloseTo(64 * 0.16, 12)
        expect(totalsFor(totalRatio).weaveCostPerM).toBeCloseTo(64 * 0.16, 12)
        expect(buildCostingResult(perSystem, totalsFor(perSystem)).productionCostPerM)
            .toBe(buildCostingResult(totalRatio, totalsFor(totalRatio)).productionCostPerM)
    })
})

describe('Test G: validation before a reliable estimate', () => {
    const issuesFor = (state: EstimateState) => {
        const validation = validateEstimatorSnapshot(state, { requireTapeLength: false })
        return validation.valid ? [] : validation.issues
    }

    it('blocks a multi-weft fabric whose pick convention was never recorded', () => {
        const state = doubleLayer()
        state.weftRows = state.weftRows.map(row => {
            const legacy = { ...row }
            delete legacy.pickRatio
            return legacy
        })
        expect(getWeftPickConvention(state.weftRows)).toBeNull()
        expect(issuesFor(state).map(issue => issue.field)).toContain('weftPickConvention')
    })

    it('blocks a mix of per-system and ratio rows as ambiguous', () => {
        const state = doubleLayer()
        state.weftRows = [{ ...state.weftRows[0], pickRatio: 1 }, { ...state.weftRows[1], pickRatio: null }]
        expect(issuesFor(state).map(issue => issue.field)).toContain('weftPickConvention')
    })

    it('never asks about the convention for a single weft', () => {
        const state = f1State({ weftRows: [weftRow()] })
        expect(getWeftPickConvention(state.weftRows)).toBe('per_system')
        expect(issuesFor(state).map(issue => issue.field)).not.toContain('weftPickConvention')
    })

    it('rejects a zero or negative ratio and picks that drifted from the ratio', () => {
        const zeroRatio = doubleLayer()
        zeroRatio.weftRows = zeroRatio.weftRows.map((row, index) => ({ ...row, pickRatio: index === 0 ? 0 : 1 }))
        expect(issuesFor(zeroRatio).map(issue => issue.field)).toContain('weftRows.0.pickRatio')

        const drifted = doubleLayer()
        drifted.weftRows = drifted.weftRows.map((row, index) => ({ ...row, pickRatio: index === 0 ? 2 : 1 }))
        expect(issuesFor(drifted).map(issue => issue.field)).toContain('weftTotalPicks')
    })

    it('accepts a consistent total-PPI ratio', () => {
        const allocation = allocateWeftPicks(64, [2, 1])
        if (!allocation.ok) throw new Error('allocation failed')
        const state = doubleLayer()
        state.weftRows = state.weftRows.map((row, index) => ({ ...row, pickRatio: [2, 1][index], picks: allocation.picks[index] }))
        expect(issuesFor(state)).toEqual([])
    })

    it('rejects non-positive denier and end counts', () => {
        const state = doubleLayer()
        state.warpRows = state.warpRows.map((row, index) => index === 0 ? { ...row, calcDenier: 0 } : { ...row, beamEnds: -5 })
        const fields = issuesFor(state).map(issue => issue.field)
        expect(fields).toContain('warpRows.0.calcDenier')
        expect(fields).toContain('warpRows.1.beamEnds')
    })

    it('rejects an out-of-range crimp', () => {
        const state = doubleLayer()
        state.weftRows = state.weftRows.map((row, index) => index === 1 ? { ...row, crimpPct: 80 } : row)
        expect(issuesFor(state).map(issue => issue.field)).toContain('weftRows.1.crimpPct')
    })
})
