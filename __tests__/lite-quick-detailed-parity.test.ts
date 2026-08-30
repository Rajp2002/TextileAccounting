import { describe, expect, it } from 'vitest'
import {
  calcFullTotals,
  buildCostingResult,
  calculateBreakEvenPricePerM,
  type EstimateState,
} from '../lib/estimator'
import {
  getEstimatorReadiness,
  validateEstimatorSnapshot,
} from '../lib/estimator-validation'
import {
  buildCostingInputFingerprint,
  summarizeCostingInputChanges,
} from '../lib/costing-save-trust'

function createSampleEstimatorState(): EstimateState {
  return {
    warpRows: [
      {
        id: 'warp-1',
        label: '75D Roto Semi Dull',
        calculationMode: 'formula',
        calcDenier: 75,
        cottonCountNe: 0,
        beamEnds: 4800,
        shortagePct: 3,
        yarnRate: 110,
        gstPct: 12,
        manualKgPer100m: 0,
      },
    ],
    weftRows: [
      {
        id: 'weft-1',
        label: '80D Bright',
        calculationMode: 'formula',
        calcDenier: 80,
        cottonCountNe: 0,
        picks: 64,
        effectiveCostingWidthCm: 147.32,
        reedSpace: 58,
        shortagePct: 4,
        yarnRate: 115,
        gstPct: 12,
        manualKgPer100m: 0,
      },
    ],
    tapeLengthM: 100,
    perPickCostPaisa: 0.28,
    warpingRatePerKg: 2.5,
    sizingRatePerKg: 4.0,
    windingRatePerKg: 1.2,
    processingRatePerM: 3.5,
    finishingRatePerM: 1.8,
    yarnShortagePct: 3,
    warpCrimpPct: 5,
    overheadItems: [
      { id: '1', label: 'Power', monthlyAmount: 45000, category: 'electricity', isPreset: false, isLocked: false, source: 'manual' },
      { id: '2', label: 'Rent', monthlyAmount: 30000, category: 'rent', isPreset: false, isLocked: false, source: 'manual' },
    ],
    monthlyOutputM: 50000,
    overheadOverridePerM: 2.5,
    overheadMode: 'direct',
    overheadPct: 0,
    isConfigured: true,
    loomRpmIsCustomised: false,
    loomPowerKwIsCustomised: false,
    loomCount: 12,
    avgOutputPerLoomPerDay: 150,
    monthlyWorkingDays: 26,
    loomType: 'water_jet',
    loomRpm: 650,
    loomPowerKw: 3.7,
    hoursPerShift: 12,
    sizingMode: 'in_house',
    commissionPct: 1.5,
    transportPerM: 0.8,
    profitPct: 8.0,
    orderQuantityM: 10000,
    enabledSections: {
      winding: true,
      processing: true,
      finishing: true,
      commission: true,
      transport: true,
    },
    outputSuggestion: undefined,
  }
}

describe('LST-02 & LST-04 & LST-05: Quick/Detailed Parity & Readiness Engine', () => {
  it('guarantees identical calculation output whether viewed in Quick or Detailed mode', () => {
    const state = createSampleEstimatorState()

    // 1. Calculate totals on the full state
    const totals = calcFullTotals(state)
    const result = buildCostingResult(state, totals)

    expect(totals.totalProductionCostPerM).toBeGreaterThan(0)
    expect(Math.abs(result.productionCostPerM - totals.totalProductionCostPerM)).toBeLessThan(0.01)
    expect(Math.abs(result.suggestedSellingPricePerM - (totals.orderQuote?.quotePricePerM ?? 0))).toBeLessThan(0.01)
    const expectedBreakEven = calculateBreakEvenPricePerM(result.productionCostPerM, result.transportPerM, result.commissionPct)
    expect(Math.abs(result.breakEvenPricePerM - expectedBreakEven)).toBeLessThan(0.01)
    expect(result.quoteIsValid).toBe(true)

    // 2. Simulate switching views: state is completely unmodified
    const quickState = { ...state }
    const detailedState = { ...state }

    const quickTotals = calcFullTotals(quickState)
    const detailedTotals = calcFullTotals(detailedState)

    expect(quickTotals.totalProductionCostPerM).toBe(detailedTotals.totalProductionCostPerM)
    expect(quickTotals.warpCostPerM).toBe(detailedTotals.warpCostPerM)
    expect(quickTotals.weaveCostPerM).toBe(detailedTotals.weaveCostPerM)
    expect(quickTotals.orderQuote?.quotePricePerM).toBe(detailedTotals.orderQuote?.quotePricePerM)
    expect(quickTotals.orderQuote?.landedCostPerM).toBe(detailedTotals.orderQuote?.landedCostPerM)
    expect(quickTotals.orderQuote?.grossProfitRupees).toBe(detailedTotals.orderQuote?.grossProfitRupees)
    expect(quickTotals.orderQuote?.totalOrderValue).toBe(detailedTotals.orderQuote?.totalOrderValue)
  })

  it('exposes detailed factory assumptions (winding, processing, finishing, transport) in the result breakdown', () => {
    const state = createSampleEstimatorState()
    const totals = calcFullTotals(state)
    const result = buildCostingResult(state, totals)

    // Breakdown includes all active non-zero components
    expect(result.breakdown.windingPerM).toBeGreaterThan(0)
    expect(result.breakdown.processingPerM).toBeGreaterThan(0)
    expect(result.breakdown.finishingPerM).toBeGreaterThan(0)
    expect(result.transportPerM).toBe(0.8)
    expect(result.commissionPct).toBe(1.5)
    expect(result.targetMarginPct).toBe(8.0)
  })

  it('transitions through unified readiness states correctly', () => {
    // 1. Incomplete state (missing yarn rate)
    const incompleteState = createSampleEstimatorState()
    incompleteState.warpRows[0].yarnRate = 0

    const incompleteValidation = validateEstimatorSnapshot(incompleteState, {
      requireTapeLength: false,
      requireCapacity: false,
    })
    const incompleteTotals = calcFullTotals(incompleteState)
    const incompleteResult = buildCostingResult(incompleteState, incompleteTotals)

    const incompleteReadiness = getEstimatorReadiness({
      validation: incompleteValidation,
      totals: incompleteTotals,
      result: incompleteResult,
    })

    expect(incompleteReadiness.canDisplayMoney).toBe(false)
    expect(incompleteReadiness.canPersist).toBe(false)
    expect(incompleteReadiness.status).toBe('blocked')
    expect(incompleteReadiness.issues.length).toBeGreaterThan(0)

    // 2. Complete valid state
    const validState = createSampleEstimatorState()
    const validValidation = validateEstimatorSnapshot(validState, {
      requireTapeLength: false,
      requireCapacity: false,
    })
    const validTotals = calcFullTotals(validState)
    const validResult = buildCostingResult(validState, validTotals)

    const validReadiness = getEstimatorReadiness({
      validation: validValidation,
      totals: validTotals,
      result: validResult,
    })

    expect(validReadiness.canDisplayMoney).toBe(true)
    expect(validReadiness.canPersist).toBe(true)
    expect(validReadiness.status).toBe('ready')
    expect(validReadiness.issues).toHaveLength(0)
  })

  it('preserves historical costing immutability when summarizing input changes', () => {
    const historical = createSampleEstimatorState()
    const modified = {
      ...historical,
      warpRows: [
        {
          ...historical.warpRows[0],
          yarnRate: 125, // Rate changed
        },
      ],
    }

    const changes = summarizeCostingInputChanges(historical, modified)
    expect(changes).toContain('rate')
    expect(changes).not.toContain('quantity')

    const fp1 = buildCostingInputFingerprint(historical)
    const fp2 = buildCostingInputFingerprint(modified)
    expect(fp1).not.toBe(fp2)
  })
})
