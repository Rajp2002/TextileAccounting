import { describe, expect, it } from 'vitest'
import { buildCostingResult, calcFullTotals } from '@/lib/estimator'
import { makeFreeEstimate } from '@/lib/free-estimator-defaults'
import { getEstimatorReadiness, validateEstimatorSnapshot } from '@/lib/estimator-validation'
import { freePreflight } from '@/lib/free-transaction'

// Values from the reported Free-plan form. Blank row waste inherits 10%.
function completedInputs() {
  const state = makeFreeEstimate()
  Object.assign(state, {
    yarnShortagePct: 10, perPickCostPaisa: 0.1375,
    overheadOverridePerM: 12, profitPct: 10, orderQuantityM: 1000,
  })
  Object.assign(state.warpRows[0], { calcDenier: 75, beamEnds: 6400, yarnRate: 112 })
  Object.assign(state.weftRows[0], { picks: 60, reedSpace: 64 * 2.54, calcDenier: 110, yarnRate: 124 })
  return state
}
const validate = (state: ReturnType<typeof completedInputs>) => validateEstimatorSnapshot(state, { requireTapeLength: false })

describe('metered versus live costing readiness', () => {
  it('recognizes complete Free inputs before the first calculation, without inventing result errors', () => {
    const validation = validate(completedInputs())
    expect(validation.valid).toBe(true)
    // This empty snapshot is the placeholder that caused the reported error.
    const empty = makeFreeEstimate()
    const totals = calcFullTotals(empty)
    const readiness = getEstimatorReadiness({
      validation, totals, result: buildCostingResult(empty, totals), awaitingCalculation: true,
    })
    expect(readiness).toMatchObject({ status: 'calculation_required', issues: [], canDisplayMoney: false, canPersist: false })
    expect(freePreflight(validation, false).action).toBe('submit')
  })

  it('still identifies missing inputs without adding errors from an uncalculated result', () => {
    const state = completedInputs()
    state.warpRows[0].yarnRate = 0
    const validation = validate(state)
    const readiness = getEstimatorReadiness({ validation, awaitingCalculation: true })
    expect(readiness).toMatchObject({ status: 'blocked', issues: validation.issues, canDisplayMoney: false, canPersist: false })
    expect(readiness.issues.some(issue => issue.field.includes('yarnRate'))).toBe(true)
  })

  it('requires acknowledgement of unusual Free inputs without exposing a price', () => {
    const state = completedInputs()
    state.warpRows[0].yarnRate = 1500
    const validation = validate(state)
    expect(validation.valid).toBe(true)
    expect(validation.warnings?.length).toBeGreaterThan(0)
    expect(getEstimatorReadiness({ validation, awaitingCalculation: true, warningsAcknowledged: false }))
      .toMatchObject({ status: 'warning_ack_required', issues: [], canDisplayMoney: false, canPersist: false })
    expect(getEstimatorReadiness({ validation, awaitingCalculation: true, warningsAcknowledged: true }).status)
      .toBe('calculation_required')
  })

  it.each(['Free after Calculate & save', 'Lite live result', 'Base live result'])(
    '%s uses the same complete inputs, formula and result validation', () => {
      const state = completedInputs()
      const totals = calcFullTotals(state)
      const result = buildCostingResult(state, totals)
      expect(result).toMatchObject({ productionCostPerM: 33.22, overheadPerM: 12, targetMarginPct: 10, quantityM: 1000, suggestedSellingPricePerM: 36.91 })
      expect(totals.weftRows[0].shortagePctUsed).toBe(10)
      expect(getEstimatorReadiness({ validation: validate(state), totals, result }))
        .toMatchObject({ status: 'ready', issues: [], canDisplayMoney: true, canPersist: true })
    },
  )

  it('keeps a prior saved Free snapshot fixed while edited inputs await a new calculation', () => {
    const state = completedInputs()
    const totals = calcFullTotals(state)
    const result = buildCostingResult(state, totals)
    state.profitPct = 20
    const readiness = getEstimatorReadiness({ validation: validate(state), result, totals, awaitingCalculation: true })
    expect(readiness).toMatchObject({ status: 'calculation_required', canDisplayMoney: false, canPersist: false, issues: [] })
    expect(result.targetMarginPct).toBe(10)
    expect(buildCostingResult(state, calcFullTotals(state)).suggestedSellingPricePerM).toBeGreaterThan(result.suggestedSellingPricePerM)
  })

  it('never relaxes result validation for a paid or completed costing', () => {
    const state = completedInputs()
    const totals = calcFullTotals(state)
    const result = { ...buildCostingResult(state, totals), productionCostPerM: 0 }
    expect(getEstimatorReadiness({ validation: validate(state), totals, result }))
      .toMatchObject({ status: 'blocked', canDisplayMoney: false, canPersist: false })
    expect(getEstimatorReadiness({ validation: validate(state) }).status).toBe('blocked')
  })
})
