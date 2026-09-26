import { makeDefaultEstimateState, type EstimateState, type OverheadItem, type WarpRow, type WeftRow } from '@/lib/estimator'

/**
 * Fixtures for the costing characterization suite (refactor Package 1A).
 *
 * Every expected value below was derived independently of lib/estimator.ts:
 * by hand from the documented formulas and cross-checked with
 * docs/maintenance/weavly-refactor/evidence/p1a-independent-costing.py
 * (Python decimal, ROUND_HALF_UP). Never regenerate them by running the app.
 */

export function warpRow(overrides: Partial<WarpRow> = {}): WarpRow {
    return {
        id: 'warp-1',
        label: 'Main warp',
        calculationMode: 'formula',
        manualKgPer100m: null,
        linearDensityUnit: 'denier',
        cottonCountNe: null,
        calcDenier: 75,
        beamEnds: 3444,
        yarnRate: 180,
        gstPct: 5,
        shortagePct: null,
        ...overrides,
    }
}

export function weftRow(overrides: Partial<WeftRow> = {}): WeftRow {
    return {
        id: 'weft-1',
        label: 'Main weft',
        calculationMode: 'formula',
        manualKgPer100m: null,
        linearDensityUnit: 'denier',
        cottonCountNe: null,
        picks: 60,
        reedSpace: 0,
        effectiveCostingWidthCm: 127, // exactly 50 inches
        calcDenier: 75,
        yarnRate: 170,
        gstPct: 5,
        shortagePct: null,
        ...overrides,
    }
}

function overheadItem(id: string, label: string, monthlyAmount: number): OverheadItem {
    return { id, label, monthlyAmount, category: 'custom', isPreset: false, isLocked: false, source: 'manual' }
}

/**
 * F1: one formula warp and one formula weft with every optional layer on.
 * Crimp 3%, default waste 2%, weave 16 paise/pick, warping 12 + sizing 8 ₹/kg
 * (both outsourced), winding 5 ₹/kg, processing 2.00, finishing 1.50,
 * monthly overhead 2,00,000 over 1,00,000 m, commission 3%, transport 0.50,
 * margin 12%, quantity 5,000 m.
 */
export function f1State(overrides: Partial<EstimateState> = {}): EstimateState {
    return {
        ...makeDefaultEstimateState(),
        warpRows: [warpRow()],
        weftRows: [weftRow()],
        perPickCostPaisa: 0.16,
        warpingRatePerKg: 12,
        sizingRatePerKg: 8,
        windingRatePerKg: 5,
        processingRatePerM: 2,
        finishingRatePerM: 1.5,
        yarnShortagePct: 2,
        warpCrimpPct: 3,
        overheadItems: [overheadItem('oh-rent', 'Rent', 150000), overheadItem('oh-power', 'Electricity', 50000)],
        monthlyOutputM: 100000,
        overheadOverridePerM: null,
        overheadMode: 'monthly_expenses',
        loomCount: 80,
        avgOutputPerLoomPerDay: 50,
        monthlyWorkingDays: 26,
        warpingMode: 'outsourced',
        sizingMode: 'outsourced',
        commissionPct: 3,
        transportPerM: 0.5,
        profitPct: 12,
        orderQuantityM: 5000,
        enabledSections: { winding: true, processing: true, finishing: true, commission: true, transport: true },
        isConfigured: true,
        ...overrides,
    }
}

/** Independent values for F1 (see the Python reference). */
export const F1 = {
    warpBaseKgPer100m: 2.87,
    warpFinalKgPer100m: 3.0135,
    weftBaseKgPer100m: 2.5,
    weftFinalKgPer100m: 2.55,
    warpCostPerM: 5.695515,
    weftCostPerM: 4.55175,
    weaveCostPerM: 9.6,
    warpingAndSizingPerM: 0.6027,
    windingPerM: 0.278175,
    directCostPerM: 24.22814,
    overheadPerM: 2,
    productionCostRawPerM: 26.22814,
    result: {
        productionCostPerM: 26.23,
        suggestedSellingPricePerM: 31.44,
        commissionPerM: 0.94,
        landedCostPerM: 27.67,
        breakEvenPricePerM: 27.55,
        profitPerM: 3.77,
        actualMarginPct: 11.99,
        totalOrderValue: 157200,
        totalLandedCost: 138350,
        expectedProfitTotal: 18850,
    },
} as const
