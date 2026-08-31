import { buildCostingResult, calcFullTotals, type EstimateState } from './estimator'
import { validateEstimatorSnapshot } from './estimator-validation'

/** Compare only yarn rates. The caller supplies the same applied-recipe baseline
 * used by the editor, including its saved costing assumptions. Never mutates it. */
export function calculateRateImpact(baseline: EstimateState, warpRates: number[], weftRates: number[]) {
  const proposed: EstimateState = {
    ...baseline,
    warpRows: baseline.warpRows.map((row, i) => ({ ...row, yarnRate: warpRates[i] ?? row.yarnRate })),
    weftRows: baseline.weftRows.map((row, i) => ({ ...row, yarnRate: weftRates[i] ?? row.yarnRate })),
  }
  const changedCount = baseline.warpRows.filter((row, i) => row.yarnRate !== proposed.warpRows[i].yarnRate).length
    + baseline.weftRows.filter((row, i) => row.yarnRate !== proposed.weftRows[i].yarnRate).length
  try {
    const validationOptions = { requireTapeLength: false, requireCapacity: false }
    if (!validateEstimatorSnapshot(baseline, validationOptions).valid || !validateEstimatorSnapshot(proposed, validationOptions).valid) {
      return { changedCount, comparison: null }
    }
    const before = buildCostingResult(baseline, calcFullTotals(baseline))
    const after = buildCostingResult(proposed, calcFullTotals(proposed))
    if (!before.quoteIsValid || !after.quoteIsValid) return { changedCount, comparison: null }
    return { changedCount, comparison: {
      production: { before: before.productionCostPerM, after: after.productionCostPerM },
      selling: { before: before.suggestedSellingPricePerM, after: after.suggestedSellingPricePerM },
    } }
  } catch {
    return { changedCount, comparison: null }
  }
}
