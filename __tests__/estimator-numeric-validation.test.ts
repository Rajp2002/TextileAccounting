import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeDefaultEstimateState, type EstimateState } from '../lib/estimator'
import { validateEstimatorSnapshot } from '../lib/estimator-validation'

const estimatorClientSource = readFileSync(
  join(process.cwd(), 'app/(dashboard)/owner/estimator/EstimatorClient.tsx'),
  'utf8',
)

function makeValidEstimate(): EstimateState {
  const estimate = makeDefaultEstimateState()
  estimate.tapeLengthM = 1_000
  estimate.perPickCostPaisa = 0.16
  estimate.monthlyOutputM = 10_000
  estimate.orderQuantityM = 1_000
  estimate.warpRows[0] = {
    ...estimate.warpRows[0],
    calcDenier: 75,
    beamEnds: 3_000,
    yarnRate: 250,
  }
  estimate.weftRows[0] = {
    ...estimate.weftRows[0],
    picks: 60,
    reedSpace: 152.4,
    finishedWidthCm: 147.32,
    effectiveCostingWidthCm: 152.4,
    calcDenier: 75,
    yarnRate: 150,
  }
  return estimate
}

function issueFor(estimate: EstimateState, field: string) {
  const result = validateEstimatorSnapshot(estimate)
  expect(result.valid).toBe(false)
  if (result.valid) return undefined
  return result.issues.find(issue => issue.field === field)?.message
}

describe('Estimator numeric input safety', () => {
  it('keeps the valid production recipe accepted', () => {
    expect(validateEstimatorSnapshot(makeValidEstimate())).toEqual({ valid: true, issues: [] })
  })

  it('rejects negative warp and weft yarn rates', () => {
    const warpEstimate = makeValidEstimate()
    warpEstimate.warpRows[0].yarnRate = -250
    expect(issueFor(warpEstimate, 'warpRows.0.yarnRate')).toContain('greater than 0')

    const weftEstimate = makeValidEstimate()
    weftEstimate.weftRows[0].yarnRate = -150
    expect(issueFor(weftEstimate, 'weftRows.0.yarnRate')).toContain('greater than 0')
  })

  it('rejects a negative effective costing width in formula and manual modes', () => {
    const formulaEstimate = makeValidEstimate()
    formulaEstimate.weftRows[0].effectiveCostingWidthCm = -2.54
    expect(issueFor(formulaEstimate, 'weftRows.0.effectiveCostingWidthCm')).toContain('greater than 0')

    const manualEstimate = makeValidEstimate()
    manualEstimate.weftRows[0] = {
      ...manualEstimate.weftRows[0],
      calculationMode: 'manual',
      manualKgPer100m: 2.75,
      effectiveCostingWidthCm: -2.54,
    }
    expect(issueFor(manualEstimate, 'weftRows.0.effectiveCostingWidthCm')).toContain('at least 0')
  })

  it('rejects cleared, non-finite, and out-of-range required rates', () => {
    const cleared = makeValidEstimate()
    cleared.warpRows[0].yarnRate = null as unknown as number
    expect(issueFor(cleared, 'warpRows.0.yarnRate')).toContain('valid number')

    const nonFinite = makeValidEstimate()
    nonFinite.warpRows[0].yarnRate = Number.NaN
    expect(issueFor(nonFinite, 'warpRows.0.yarnRate')).toContain('valid number')

    const huge = makeValidEstimate()
    huge.warpRows[0].yarnRate = 999_999_999_999
    expect(issueFor(huge, 'warpRows.0.yarnRate')).toContain('outside the supported range')
  })

  it('enforces documented precision for rates, percentages, and manual yarn quantities', () => {
    const rate = makeValidEstimate()
    rate.warpRows[0].yarnRate = 250.123456789
    expect(issueFor(rate, 'warpRows.0.yarnRate')).toContain('2 decimal places')

    const percentage = makeValidEstimate()
    percentage.warpRows[0].gstPct = 5.123
    expect(issueFor(percentage, 'warpRows.0.gstPct')).toContain('2 decimal places')

    const manual = makeValidEstimate()
    manual.warpRows[0] = {
      ...manual.warpRows[0],
      calculationMode: 'manual',
      manualKgPer100m: 3.1234,
    }
    expect(issueFor(manual, 'warpRows.0.manualKgPer100m')).toContain('3 decimal places')
  })

  it.each([' 250 ', '1,000', 'letters'])(
    'does not coerce the tampered string %j into a costing number',
    value => {
      const estimate = makeValidEstimate()
      estimate.warpRows[0].yarnRate = value as unknown as number
      expect(issueFor(estimate, 'warpRows.0.yarnRate')).toContain('valid number')
    },
  )

  it('recovers immediately after the invalid value is corrected', () => {
    const estimate = makeValidEstimate()
    estimate.warpRows[0].yarnRate = -1
    expect(validateEstimatorSnapshot(estimate).valid).toBe(false)

    estimate.warpRows[0].yarnRate = 250.12
    expect(validateEstimatorSnapshot(estimate)).toEqual({ valid: true, issues: [] })
  })

  it('uses the shared validation result for field errors, safe totals, and save guards', () => {
    expect(estimatorClientSource).toContain('validateEstimatorSnapshot(state)')
    expect(estimatorClientSource).toContain('aria-invalid={Boolean(error)}')
    expect(estimatorClientSource).toContain('Cost result paused. Correct the highlighted inputs')
    expect(estimatorClientSource).toContain('Correct highlighted inputs before saving:')
    expect(estimatorClientSource).toContain('disabled={savingQuote || !estimatorValidation.valid')
    expect(estimatorClientSource).toContain("error={validationMessageFor(`warpRows.${i}.yarnRate`)}")
    expect(estimatorClientSource).toContain("error={validationMessageFor(`weftRows.${i}.effectiveCostingWidthCm`)}")
  })
})
