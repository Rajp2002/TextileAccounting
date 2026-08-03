import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCostingResult, calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import {
  getEstimatorReadiness,
  validateEstimatorQuoteBoundary,
  validateEstimatorSnapshot,
} from '../lib/estimator-validation'

const root = process.cwd()

function makeCompleteDirectEstimate() {
  const estimate = makeDefaultEstimateState()
  estimate.tapeLengthM = 0
  estimate.perPickCostPaisa = 0.14
  estimate.overheadMode = 'direct'
  estimate.overheadOverridePerM = 3
  estimate.monthlyOutputM = 10_000
  estimate.loomCount = 24
  estimate.monthlyWorkingDays = 26
  estimate.avgOutputPerLoomPerDay = 50
  estimate.warpRows[0] = {
    ...estimate.warpRows[0],
    label: 'Main Warp',
    calcDenier: 75,
    beamEnds: 3_200,
    yarnRate: 110,
  }
  estimate.weftRows[0] = {
    ...estimate.weftRows[0],
    label: 'Main Weft',
    calcDenier: 75,
    picks: 68,
    effectiveCostingWidthCm: 110,
    yarnRate: 110,
  }
  return estimate
}

describe('Sprint 15 Base estimator trust gates', () => {
  it('requires positive capacity inputs at costing and quotation boundaries', () => {
    const estimate = makeCompleteDirectEstimate()

    for (const field of ['loomCount', 'monthlyWorkingDays', 'avgOutputPerLoomPerDay', 'monthlyOutputM'] as const) {
      const incomplete = { ...estimate, [field]: 0 }
      const validation = validateEstimatorSnapshot(incomplete, {
        requireTapeLength: false,
        requireCapacity: true,
      })

      expect(validation.valid, field).toBe(false)
      expect(validation.issues).toContainEqual(expect.objectContaining({ field }))
    }

    const boundary = validateEstimatorQuoteBoundary({
      estimate: { ...estimate, loomCount: 0 },
      totalProductionCostPerM: 12,
      quotePricePerM: 15,
      requireTapeLength: false,
    })
    expect(boundary.valid).toBe(false)
    expect(boundary.issues).toContainEqual(expect.objectContaining({ field: 'loomCount' }))
  })

  it('keeps reusable recipe validation separate from the first costing snapshot', () => {
    const recipeOnly = makeCompleteDirectEstimate()
    recipeOnly.monthlyOutputM = 0
    recipeOnly.loomCount = 0

    expect(validateEstimatorSnapshot(recipeOnly, { requireTapeLength: false }).valid).toBe(true)
    expect(validateEstimatorQuoteBoundary({
      estimate: recipeOnly,
      totalProductionCostPerM: 12,
      quotePricePerM: 15,
      requireTapeLength: false,
      requireCapacity: false,
    }).valid).toBe(true)
  })

  it('does not display or persist money for an incomplete capacity profile', () => {
    const estimate = { ...makeCompleteDirectEstimate(), loomCount: 0 }
    const totals = calcFullTotals(estimate)
    const result = buildCostingResult(estimate, totals)
    const readiness = getEstimatorReadiness({
      validation: validateEstimatorSnapshot(estimate, { requireTapeLength: false, requireCapacity: true }),
      result,
      totals,
      warningsAcknowledged: true,
    })

    expect(result.productionCostPerM).toBeGreaterThan(0)
    expect(readiness.status).toBe('blocked')
    expect(readiness.canDisplayMoney).toBe(false)
    expect(readiness.canPersist).toBe(false)
  })

  it('treats a row-level zero waste override as intentional zero', () => {
    const estimate = makeCompleteDirectEstimate()
    estimate.yarnShortagePct = 10
    estimate.weftRows[0].shortagePct = 0

    const totals = calcFullTotals(estimate)
    expect(totals.weftRows[0]?.shortagePctUsed).toBe(0)

    estimate.weftRows[0].shortagePct = null
    const defaultTotals = calcFullTotals(estimate)
    expect(defaultTotals.weftRows[0]?.shortagePctUsed).toBe(10)
  })

  it('keeps the UI language explicit about default, applied, and effective waste', () => {
    const source = fs.readFileSync(
      path.join(root, 'app/(dashboard)/owner/estimator/EstimatorClient.tsx'),
      'utf8',
    )

    expect(source).toContain('Default weft waste')
    expect(source).toContain('Applied to pricing:')
    expect(source).toContain('Effective weft wastage used in formula:')
    expect(source).toContain('Open capacity inputs')
  })
})
