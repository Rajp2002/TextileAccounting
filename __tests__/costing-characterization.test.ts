import { describe, expect, it } from 'vitest'
import {
    COSTING_CALCULATION_VERSION,
    COSTING_ROUNDING_POLICY,
    buildCostingResult,
    calcFullTotals,
    parseCostingResultSnapshot,
    type EstimateState,
} from '@/lib/estimator'
import { F1, f1State, warpRow, weftRow } from './fixtures/costing-characterization'

// Refactor Package 1A (docs/maintenance/weavly-refactor/EVIDENCE.md E8).
// INVARIANT: behavior the code, its comments and the product owner agree on.
// CHARACTERIZATION: current behavior pinned so a refactor cannot change it
// silently. It is not a claim that the behavior is correct.
// Expected values come from the independent reference in
// docs/maintenance/weavly-refactor/evidence/p1a-independent-costing.py.

function result(state: EstimateState) {
    const totals = calcFullTotals(state)
    return { totals, result: buildCostingResult(state, totals) }
}

const noWasteNoCrimp = { yarnShortagePct: 0, warpCrimpPct: 0 }

describe('costing engine characterization (Package 1A)', () => {
    it('INVARIANT C-INV-01/04/09/10/13: F1 layers and staged rounding match independent values', () => {
        const { totals, result: snapshot } = result(f1State())

        expect(totals.warpRows[0].baseKgPer100mUsed).toBeCloseTo(F1.warpBaseKgPer100m, 12)
        expect(totals.warpRows[0].finalKgPer100m).toBeCloseTo(F1.warpFinalKgPer100m, 12)
        expect(totals.weftRows[0].baseKgPer100mUsed).toBeCloseTo(F1.weftBaseKgPer100m, 12)
        expect(totals.weftRows[0].finalKgPer100m).toBeCloseTo(F1.weftFinalKgPer100m, 12)
        expect(totals.warpCostPerM).toBeCloseTo(F1.warpCostPerM, 12)
        expect(totals.weftCostPerM).toBeCloseTo(F1.weftCostPerM, 12)
        expect(totals.weaveCostPerM).toBeCloseTo(F1.weaveCostPerM, 12)
        expect(totals.warpingAndSizingPerM).toBeCloseTo(F1.warpingAndSizingPerM, 12)
        expect(totals.windingPerM).toBeCloseTo(F1.windingPerM, 12)
        expect(totals.directCostPerM).toBeCloseTo(F1.directCostPerM, 12)
        expect(totals.overheadPerM).toBeCloseTo(F1.overheadPerM, 12)
        expect(totals.totalProductionCostPerM).toBeCloseTo(F1.productionCostRawPerM, 12)

        // Rounding happens once per stage at the result boundary: per-metre
        // values first, then totals from the rounded per-metre values.
        expect(snapshot).toMatchObject({ ...F1.result, quantityM: 5000, quoteIsValid: true })
        expect(snapshot.breakdown.productionCostPerM).toBe(F1.result.productionCostPerM)
    })

    it('INVARIANT C-INV-14: every new snapshot carries its calculation and rounding identities', () => {
        const { result: snapshot } = result(f1State())
        expect(snapshot.snapshotSchemaVersion).toBe(2)
        expect(snapshot.calculationVersion).toBe(COSTING_CALCULATION_VERSION)
        expect(snapshot.roundingPolicy).toBe(COSTING_ROUNDING_POLICY)
        expect(COSTING_CALCULATION_VERSION).toBe('estimator_v5_2026_10')
        expect(COSTING_ROUNDING_POLICY).toBe('INR_HALF_UP_2')
    })

    it('INVARIANT C-INV-13: half-up rounding applies to the decimal value, not the binary float', () => {
        // 1.005, 2.675 and 0.285 round down with Number#toFixed(2).
        for (const [override, expected] of [[1.005, 1.01], [2.675, 2.68], [10.125, 10.13], [0.285, 0.29]] as const) {
            const state = f1State({ warpRows: [], weftRows: [], perPickCostPaisa: 0, enabledSections: { winding: false, processing: false, finishing: false, commission: false, transport: false }, commissionPct: 0, transportPerM: 0, overheadMode: 'direct', overheadOverridePerM: override })
            expect(result(state).result.productionCostPerM).toBe(expected)
        }
    })

    it('INVARIANT C-INV-08: missing legacy modes charge warping only when its rate is set, never sizing', () => {
        const legacy = f1State() as Omit<EstimateState, 'warpingMode' | 'sizingMode'> & Partial<EstimateState>
        delete legacy.warpingMode
        delete legacy.sizingMode
        const { totals, result: snapshot } = result(legacy as EstimateState)
        expect(totals.warpingAndSizingPerM).toBeCloseTo(0.36162, 12)
        expect(snapshot.productionCostPerM).toBe(25.99)
    })

    it('INVARIANT C-INV-08: explicit in-house modes charge nothing even with rates entered', () => {
        const { totals } = result(f1State({ warpingMode: 'in_house', sizingMode: 'in_house' }))
        expect(totals.warpingAndSizingPerM).toBe(0)
    })

    it('INVARIANT C-INV-09: entered commission and transport apply even when their sections are off', () => {
        const state = f1State({ enabledSections: { winding: false, processing: false, finishing: false, commission: false, transport: false } })
        const { totals, result: snapshot } = result(state)
        expect(totals.windingPerM).toBe(0)
        expect(totals.processingPerM).toBe(0)
        expect(totals.finishingPerM).toBe(0)
        expect(snapshot).toMatchObject({
            productionCostPerM: 22.45,
            suggestedSellingPricePerM: 27,
            commissionPerM: 0.81,
            landedCostPerM: 23.76,
            breakEvenPricePerM: 23.66,
            profitPerM: 3.24,
            actualMarginPct: 12,
        })
    })

    it('CHARACTERIZATION C-INV-10 (see CS-2): a stored override wins even in monthly-expenses mode', () => {
        const { totals, result: snapshot } = result(f1State({ overheadMode: 'monthly_expenses', overheadOverridePerM: 5 }))
        expect(totals.overheadPerM).toBe(5)
        expect(snapshot.productionCostPerM).toBe(29.23)
        expect(snapshot.overheadMode).toBe('monthly_expenses')
    })

    it('INVARIANT C-INV-05: a row waste of 0 is intentional; null falls back to the default', () => {
        const explicitZero = result(f1State({ ...noWasteNoCrimp, yarnShortagePct: 10, weftRows: [weftRow({ shortagePct: 0 })] })).totals
        const fallback = result(f1State({ ...noWasteNoCrimp, yarnShortagePct: 10, weftRows: [weftRow({ shortagePct: null })] })).totals
        expect(explicitZero.weftRows[0].finalKgPer100m).toBeCloseTo(2.5, 12)
        expect(explicitZero.weftRows[0].wastePctSource).toBe('row_override')
        expect(fallback.weftRows[0].finalKgPer100m).toBeCloseTo(2.75, 12)
        expect(fallback.weftRows[0].wastePctSource).toBe('default')
    })

    it('INVARIANT C-INV-03: cotton count converts to denier as 5315 / Ne', () => {
        const { totals } = result(f1State({ ...noWasteNoCrimp, warpRows: [warpRow({ linearDensityUnit: 'cotton_count_ne', cottonCountNe: 40, calcDenier: 999, beamEnds: 2000 })] }))
        expect(totals.warpRows[0].calcDenier).toBeCloseTo(132.875, 12)
        expect(totals.warpRows[0].baseKgPer100mUsed).toBeCloseTo(2.952777777777778, 12)
    })

    it('INVARIANT C-INV-11: commission plus margin at or above 100% makes the quote invalid with no price', () => {
        const { result: snapshot } = result(f1State({ commissionPct: 40, profitPct: 60 }))
        expect(snapshot.quoteIsValid).toBe(false)
        expect(snapshot.suggestedSellingPricePerM).toBe(0)
        expect(snapshot.productionCostPerM).toBe(F1.result.productionCostPerM)
        // Break-even needs only commission, so it stays explainable: 26.72814 / 0.60.
        expect(snapshot.breakEvenPricePerM).toBe(44.55)
    })
})

describe('multi-row yarn conventions (CS-1)', () => {
    const plain = { ...noWasteNoCrimp, enabledSections: { winding: false, processing: false, finishing: false, commission: false, transport: false } }

    it('INVARIANT (owner decision 2026-09-26): warp rows add; splitting ends across rows changes nothing', () => {
        const oneRow = result(f1State({ ...plain, warpRows: [warpRow({ beamEnds: 3444 })] })).totals
        const twoRows = result(f1State({ ...plain, warpRows: [warpRow({ id: 'w1', beamEnds: 1722 }), warpRow({ id: 'w2', beamEnds: 1722 })] })).totals
        expect(oneRow.totalWarpKgPer100m).toBeCloseTo(2.87, 12)
        expect(twoRows.totalWarpKgPer100m).toBeCloseTo(2.87, 12)
    })

    it('INVARIANT (owner decision 2026-09-26, CS-1): each weft row holds its own picks over the full 100 m run', () => {
        const oneRow = result(f1State({ ...plain, weftRows: [weftRow({ picks: 60 })] })).totals
        const twoAt60 = result(f1State({ ...plain, weftRows: [weftRow({ id: 'a', picks: 60 }), weftRow({ id: 'b', picks: 60 })] })).totals
        const twoAt30 = result(f1State({ ...plain, weftRows: [weftRow({ id: 'a', picks: 30 }), weftRow({ id: 'b', picks: 30 })] })).totals
        expect(twoAt60.weftRows.map(row => row.formulaLengthM)).toEqual([100, 100])
        expect(oneRow.weftRows[0].baseKgPer100mUsed).toBeCloseTo(2.5, 12)
        expect(twoAt60.weftRows.reduce((sum, row) => sum + row.baseKgPer100mUsed, 0)).toBeCloseTo(5, 12)
        // 30 + 30 picks of the same yarn weigh the same as one 60-pick system.
        expect(twoAt30.weftRows.reduce((sum, row) => sum + row.baseKgPer100mUsed, 0)).toBeCloseTo(2.5, 12)
    })

    it('CHARACTERIZATION (open question): weave cost and worker rate add PPI across weft rows', () => {
        const twoAt60 = result(f1State({ ...plain, weftRows: [weftRow({ id: 'a', picks: 60 }), weftRow({ id: 'b', picks: 60 })] })).totals
        const twoAt30 = result(f1State({ ...plain, weftRows: [weftRow({ id: 'a', picks: 30 }), weftRow({ id: 'b', picks: 30 })] })).totals
        expect(twoAt60.weaveCostPerM).toBeCloseTo(19.2, 12)
        expect(twoAt30.weaveCostPerM).toBeCloseTo(9.6, 12)
    })

    it('INVARIANT: a manual weft row does not change the formula rows beside it', () => {
        const { totals } = result(f1State({
            ...plain,
            weftRows: [weftRow({ id: 'formula', picks: 60 }), weftRow({ id: 'manual', calculationMode: 'manual', manualKgPer100m: 1 })],
        }))
        expect(totals.weftRows[0].formulaLengthM).toBe(100)
        expect(totals.weftRows[0].baseKgPer100mUsed).toBeCloseTo(2.5, 12)
        expect(totals.weftRows[1].baseKgPer100mUsed).toBe(1)
    })
})

describe('saved snapshot compatibility (C-INV-15)', () => {
    it('CHARACTERIZATION: a persisted snapshot reads back through JSON with the same financial values', () => {
        const { result: snapshot } = result(f1State())
        const parsed = parseCostingResultSnapshot(JSON.parse(JSON.stringify(snapshot)))
        expect(parsed).not.toBeNull()
        expect(parsed).toMatchObject({ ...F1.result, calculationVersion: COSTING_CALCULATION_VERSION, snapshotSchemaVersion: 2 })
    })

    it('INVARIANT: a snapshot whose totals disagree with its per-metre values is rejected', () => {
        const { result: snapshot } = result(f1State())
        const tampered = JSON.parse(JSON.stringify(snapshot))
        tampered.totalOrderValue = snapshot.totalOrderValue! + 1000
        expect(parseCostingResultSnapshot(tampered)).toBeNull()
    })
})
