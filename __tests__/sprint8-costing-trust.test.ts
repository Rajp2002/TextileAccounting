import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCostingResult,
  calcFullTotals,
  makeDefaultEstimateState,
  parseCostingResultSnapshot,
} from '../lib/estimator'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

function trustEstimate() {
  const state = makeDefaultEstimateState()
  state.warpRows[0] = {
    ...state.warpRows[0],
    calcDenier: 75,
    beamEnds: 3200,
    yarnRate: 107,
    gstPct: 5,
  }
  state.weftRows[0] = {
    ...state.weftRows[0],
    picks: 68,
    reedSpace: 110,
    calcDenier: 75,
    yarnRate: 107,
    gstPct: 5,
  }
  state.tapeLengthM = 1000
  state.perPickCostPaisa = 0.16
  state.warpingRatePerKg = 2
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
  state.overheadMode = 'direct'
  state.overheadOverridePerM = 12.5
  state.commissionPct = 2
  state.transportPerM = 1.5
  state.profitPct = 10
  state.orderQuantityM = 100
  state.enabledSections = { ...state.enabledSections, commission: true, transport: true }
  return state
}

describe('Sprint 8 costing trust foundation', () => {
  it('makes direct/monthly overhead source, reference, and price impact explicit', () => {
    const direct = trustEstimate()
    const directResult = buildCostingResult(direct, calcFullTotals(direct))

    expect(directResult.overheadMode).toBe('direct')
    expect(directResult.overheadSource).toBe('direct_rate')
    expect(directResult.overheadPerM).toBe(12.5)
    expect(directResult.overheadReferencePerM).toBe(10)
    expect(directResult.overheadPriceImpactPerM).toBe(2.5)
    expect(directResult.assumptions?.overhead).toMatchObject({
      source: 'direct_rate',
      activeRatePerM: 12.5,
      referenceRatePerM: 10,
      priceImpactPerM: 2.5,
    })

    const monthly = { ...direct, overheadMode: 'monthly_expenses' as const, overheadOverridePerM: null }
    const monthlyResult = buildCostingResult(monthly, calcFullTotals(monthly))
    expect(monthlyResult.overheadSource).toBe('monthly_expenses')
    expect(monthlyResult.overheadPerM).toBe(10)
    expect(monthlyResult.overheadReferencePerM).toBeNull()
    expect(monthlyResult.overheadPriceImpactPerM).toBe(0)
  })

  it('keeps quantity explicit without letting it change the per-metre price', () => {
    const withQuantity = trustEstimate()
    const withoutQuantity = { ...withQuantity, orderQuantityM: null }
    const withQuantityResult = buildCostingResult(withQuantity, calcFullTotals(withQuantity))
    const withoutQuantityResult = buildCostingResult(withoutQuantity, calcFullTotals(withoutQuantity))

    expect(withQuantityResult.suggestedSellingPricePerM).toBe(withoutQuantityResult.suggestedSellingPricePerM)
    expect(withQuantityResult.quantityM).toBe(100)
    expect(withoutQuantityResult.quantityM).toBeNull()
    expect(withQuantityResult.assumptions?.quantity.priceImpactPerM).toBe(0)
    expect(withoutQuantityResult.assumptions?.quantity.source).toBe('not_set')
  })

  it('round-trips the explicit assumptions through the canonical snapshot parser', () => {
    const state = trustEstimate()
    const result = buildCostingResult(state, calcFullTotals(state))
    const parsed = parseCostingResultSnapshot(result)

    expect(parsed?.quoteIsValid).toBe(true)
    expect(parsed?.assumptions?.commission.activeRate).toBe(2)
    expect(parsed?.assumptions?.transport.activeRate).toBe(1.5)
    expect(parsed?.assumptions?.margin.activeRate).toBe(10)
    expect(parsed?.assumptions?.quantity.activeRate).toBe(100)
  })

  it('keeps the UI paths on the same result and refuses silent direct-rate defaults', () => {
    const client = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const wizard = read('app/(dashboard)/owner/estimator/FactoryCostWizard.tsx')

    expect(client).toContain('function CostingAssumptionsSummary')
    expect(client).toContain('data-testid="costing-assumptions-summary"')
    expect(client).toContain('costingResult={costingResult}')
    // Phase 3H: the quality-basics card no longer takes party props.
    expect(client).not.toContain('setPartyName={')
    expect(client).toContain('Enter the rate used in this costing; it is never inferred.')
    expect(client).not.toContain('const suggestedRate')
    expect(wizard).not.toContain('?? 13.5')
  })
})
