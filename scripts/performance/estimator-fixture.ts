import { makeDefaultEstimateState, type EstimateState } from '../../lib/estimator'

export function estimatorFixture(rows = 1): EstimateState {
    const state = makeDefaultEstimateState()
    return {
        ...state,
        warpRows: Array.from({ length: rows }, (_, i) => ({
            ...state.warpRows[0], id: `warp-${i}`, label: `Synthetic warp ${i}`,
            calcDenier: 75.25 + i, beamEnds: 3200, yarnRate: 110.125 + i, gstPct: 5,
        })),
        weftRows: Array.from({ length: rows }, (_, i) => ({
            ...state.weftRows[0], id: `weft-${i}`, label: `Synthetic weft ${i}`,
            calcDenier: 80.125 + i, picks: 64, reedSpace: 58, effectiveCostingWidthCm: 147.32,
            yarnRate: 115.375 + i, gstPct: 5,
            // More than one weft needs its pick convention recorded; each row is its own PPI.
            ...(rows > 1 ? { pickRatio: null } : {}),
        })),
        overheadItems: [{ id: 'rent', label: 'Synthetic rent', monthlyAmount: 30000, category: 'rent', isPreset: false, isLocked: false, source: 'manual' }],
        tapeLengthM: 100, perPickCostPaisa: 0.28, warpCrimpPct: 5,
        overheadMode: 'direct', overheadOverridePerM: 2.5, monthlyOutputM: 50000,
        loomType: 'water_jet', loomRpm: 700, loomPowerKw: 2.5,
        orderQuantityM: 1000, profitPct: 12, commissionPct: 2.25, transportPerM: 0.85,
        enabledSections: { ...state.enabledSections, commission: true, transport: true },
    }
}

export function estimatorReferenceCases(): Record<string, EstimateState> {
    const state = estimatorFixture()
    return {
        normal: state,
        noQuantity: { ...state, orderQuantityM: null },
        zeroQuantity: { ...state, orderQuantityM: 0 },
        zeroRates: { ...state, warpRows: state.warpRows.map(row => ({ ...row, yarnRate: 0 })), weftRows: state.weftRows.map(row => ({ ...row, yarnRate: 0 })) },
        missingOverhead: { ...state, overheadOverridePerM: null },
        zeroOverhead: { ...state, overheadOverridePerM: 0 },
        monthlyOverhead: { ...state, overheadMode: 'monthly_expenses', overheadOverridePerM: null },
        disabledCommercials: { ...state, enabledSections: { ...state.enabledSections, commission: false, transport: false } },
        invalidMargin: { ...state, profitPct: 99 },
        invalidCommission: { ...state, commissionPct: 100 },
        missingWidth: { ...state, weftRows: state.weftRows.map(row => ({ ...row, reedSpace: 0, effectiveCostingWidthCm: 0 })) },
        tinyQuantity: { ...state, orderQuantityM: 0.01, profitPct: 0.001, commissionPct: 0.001 },
        manualConsumption: { ...state, warpRows: state.warpRows.map(row => ({ ...row, calculationMode: 'manual', manualKgPer100m: 2.375 })) },
        cottonCount: { ...state, warpRows: state.warpRows.map(row => ({ ...row, linearDensityUnit: 'cotton_count_ne', cottonCountNe: 40 })) },
        changedRate: { ...state, warpRows: state.warpRows.map(row => ({ ...row, yarnRate: 250.005 })) },
        maximumRows: estimatorFixture(20),
    }
}
