import { describe, expect, it } from 'vitest'
import {
  buildCostingResult,
  calcFullTotals,
  makeDefaultEstimateState,
  type EstimateState,
} from '../lib/estimator'
import { validateEstimatorSnapshot } from '../lib/estimator-validation'
import { auditHistoricalCosting } from '../lib/costing-reconciliation'

function goldenEstimate(): EstimateState {
  const state = makeDefaultEstimateState()
  state.warpRows = [{
    ...state.warpRows[0],
    id: 'golden-warp',
    calcDenier: 50,
    beamEnds: 5200,
    yarnRate: 350,
    gstPct: 0,
    shortagePct: null,
  }]
  state.weftRows = [{
    ...state.weftRows[0],
    id: 'golden-weft',
    picks: 68,
    reedSpace: 112,
    calcDenier: 50,
    yarnRate: 350,
    gstPct: 0,
    shortagePct: null,
  }]
  state.tapeLengthM = 100
  state.perPickCostPaisa = 8 / 68
  state.warpingRatePerKg = 12
  state.warpingMode = 'outsourced'
  state.sizingRatePerKg = 0
  state.sizingMode = 'in_house'
  state.yarnShortagePct = 10
  state.warpCrimpPct = 5
  state.overheadItems = []
  state.overheadMode = 'direct'
  state.overheadOverridePerM = 5.75
  state.monthlyOutputM = 2600
  state.loomCount = 2
  state.avgOutputPerLoomPerDay = 50
  state.monthlyWorkingDays = 26
  state.commissionPct = 2
  state.transportPerM = 1.5
  state.profitPct = 12
  state.orderQuantityM = 1000
  state.enabledSections = {
    ...state.enabledSections,
    commission: true,
    transport: true,
  }
  return state
}

describe('Sprint 0 canonical costing truth', () => {
  it('produces one rounded golden result for estimator and commercial outputs', () => {
    const state = goldenEstimate()
    const result = buildCostingResult(state, calcFullTotals(state))

    expect(result.calculationVersion).toBe('estimator_v3_2026_08')
    expect(result.roundingPolicy).toBe('INR_HALF_UP_2')
    expect(result.productionCostPerM).toBe(32.19)
    expect(result.overheadPerM).toBe(5.75)
    expect(result.breakEvenPricePerM).toBe(34.38)
    expect(result.landedCostPerM).toBe(34.47)
    expect(result.suggestedSellingPricePerM).toBe(39.17)
    expect(result.profitPerM).toBe(4.7)
    expect(result.expectedProfitTotal).toBe(4700)
    expect(result.actualMarginPct).toBeCloseTo(12, 2)
    expect(result.totalOrderValue).toBe(39170)
    expect(result.totalLandedCost).toBe(34470)
  })

  it('includes entered transport and commission when their toggle is stale, while warning the owner', () => {
    const state = goldenEstimate()
    state.enabledSections = { ...state.enabledSections, commission: false, transport: false }
    const result = buildCostingResult(state, calcFullTotals(state))
    const warnings = validateEstimatorSnapshot(state).warnings ?? []

    expect(result.transportPerM).toBe(1.5)
    expect(result.commissionPct).toBe(2)
    expect(warnings.map(warning => warning.message)).toEqual(expect.arrayContaining([
      'Transport is set to ₹1.50/m, so it will be included even though the transport section is switched off.',
      'Commission is set to 2.00%, so it will be included even though the commission section is switched off.',
    ]))
  })

  it('uses monthly expenses only when monthly overhead mode is selected', () => {
    const state = goldenEstimate()
    state.overheadMode = 'monthly_expenses'
    state.overheadOverridePerM = 99
    state.overheadItems = [{
      id: 'rent',
      label: 'Rent',
      monthlyAmount: 1000,
      category: 'rent',
      source: 'manual',
      isPreset: true,
      isLocked: false,
    }]
    state.monthlyOutputM = 100
    const result = buildCostingResult(state, calcFullTotals(state))
    const warnings = validateEstimatorSnapshot(state).warnings ?? []

    expect(result.overheadPerM).toBe(10)
    expect(warnings.map(warning => warning.message)).toContain('Monthly overhead mode is selected, so the direct ₹/m overhead value will not be used.')
  })

  it('classifies verified, mismatched, and incomplete historical snapshots conservatively', () => {
    const state = goldenEstimate()
    const result = buildCostingResult(state, calcFullTotals(state))
    const baseRow = {
      id: 'golden-quote',
      org_id: 'org-a',
      calculation_version: result.calculationVersion,
      rounding_policy: result.roundingPolicy,
      production_cost_per_meter: result.productionCostPerM,
      overhead_per_meter: result.overheadPerM,
      commission_cost_per_meter: result.commissionPerM,
      break_even_price_per_meter: result.breakEvenPricePerM,
      expected_profit_per_meter: result.profitPerM,
      expected_profit_total: result.expectedProfitTotal,
      actual_margin_percent: result.actualMarginPct,
      costing_result_snapshot: result,
      landed_cost_per_meter: result.landedCostPerM,
      quote_price_per_meter: result.suggestedSellingPricePerM,
      intended_margin_percent: result.targetMarginPct,
      warp_rows: state.warpRows,
      weft_rows: state.weftRows,
      overhead_items: state.overheadItems,
      commission_pct: state.commissionPct,
      transport_per_m: state.transportPerM,
    }

    expect(auditHistoricalCosting(baseRow).status).toBe('verified')
    expect(auditHistoricalCosting({ ...baseRow, quote_price_per_meter: result.suggestedSellingPricePerM + 0.02 }).status).toBe('needs_review')
    expect(auditHistoricalCosting({
      ...baseRow,
      costing_result_snapshot: null,
      calculation_version: null,
      rounding_policy: null,
      overhead_items: null,
      commission_pct: null,
      transport_per_m: null,
    }).status).toBe('unreconstructable')
  })
})
