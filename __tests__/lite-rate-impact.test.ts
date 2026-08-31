import { describe, expect, it } from 'vitest'
import { buildCostingResult, calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import { calculateRateImpact } from '../lib/estimator-rate-impact'
import { nextCostingJourney } from '../lib/costing-journey'
import { validateEstimatorSnapshot } from '../lib/estimator-validation'
import { isPlanAnalyticsProperties } from '../lib/plan-analytics'
import { translateStrictBasePlanText } from '../lib/i18n/runtime'

function recipe() {
  const state = makeDefaultEstimateState()
  state.warpRows = [{ ...state.warpRows[0], calcDenier: 75, beamEnds: 4800, yarnRate: 110 }]
  state.weftRows = [{ ...state.weftRows[0], calcDenier: 80, picks: 64, reedSpace: 147.32, yarnRate: 115 }]
  state.overheadMode = 'direct'
  state.overheadOverridePerM = 2.5
  state.profitPct = 8
  state.perPickCostPaisa = 0.28
  return state
}
describe('rate review comparison', () => {
  it('uses the costing engine while preserving every other input and the original snapshot', () => {
    const before = recipe()
    expect(validateEstimatorSnapshot(before, { requireTapeLength: false, requireCapacity: false }).issues).toEqual([])
    const original = structuredClone(before)
    const impact = calculateRateImpact(before, [125], [120])
    const expected = { ...before, warpRows: [{ ...before.warpRows[0], yarnRate: 125 }], weftRows: [{ ...before.weftRows[0], yarnRate: 120 }] }
    const result = buildCostingResult(expected, calcFullTotals(expected))
    expect(impact.changedCount).toBe(2)
    expect(impact.comparison?.production.after).toBe(result.productionCostPerM)
    expect(impact.comparison?.selling.after).toBe(result.suggestedSellingPricePerM)
    expect(before).toEqual(original)
  })
  it('shows unchanged rates without inventing an impact', () => {
    const impact = calculateRateImpact(recipe(), [110], [115])
    expect(impact.changedCount).toBe(0)
    expect(impact.comparison).not.toBeNull()
    expect(impact.comparison?.selling.before).toBe(impact.comparison?.selling.after)
  })
  it('does not show money for invalid or incomplete inputs', () => {
    expect(calculateRateImpact(recipe(), [NaN], [115]).comparison).toBeNull()
    const incomplete = recipe()
    incomplete.warpRows[0].beamEnds = 0
    expect(calculateRateImpact(incomplete, [125], [115]).comparison).toBeNull()
  })
  it('supports decreases and multiple yarn components independently', () => {
    const state = recipe()
    state.warpRows.push({ ...state.warpRows[0], id: 'warp-2', yarnRate: 180 })
    const impact = calculateRateImpact(state, [100, 180], [115])
    expect(impact.changedCount).toBe(1)
    expect(impact.comparison!.production.after).toBeLessThan(impact.comparison!.production.before)
  })
})
describe('journey attribution', () => {
  it('starts on an explicit source and advances for every new costing', () => {
    const first = nextCostingJourney(null, 'saved_quality')
    expect(first).toEqual({ source: 'saved_quality', sequence: 1 })
    const second = nextCostingJourney(first, 'saved_quality')
    expect(second.sequence).toBe(2)
    expect(nextCostingJourney(second, 'blank')).toEqual({ source: 'blank', sequence: 3 })
  })
  it('rejects business content and arbitrary text at the real telemetry boundary', () => {
    expect(isPlanAnalyticsProperties('valid_result_reached', { has_quantity: true, journey_source: 'saved_quality' })).toBe(true)
    expect(isPlanAnalyticsProperties('valid_result_reached', { quality_name: 'private' })).toBe(false)
    expect(isPlanAnalyticsProperties('valid_result_reached', { journey_source: 'private text' })).toBe(false)
    expect(isPlanAnalyticsProperties('blank_start', { price: 123 })).toBe(false)
    expect(isPlanAnalyticsProperties('export_completed', { mode: 'customer' })).toBe(true)
  })
})
describe('rate review localization', () => {
  it.each(['hi', 'gu'] as const)('covers new rate copy in %s', language => {
    for (const phrase of ['Rate change impact', 'Use saved rates', 'Saved rate', 'Proposed warp rate', 'Proposed weft rate', 'No yarn rate changes.', 'Complete the recipe and costing assumptions to see the price impact.']) {
      expect(translateStrictBasePlanText(phrase, language)).not.toBe(phrase)
    }
  })
})
