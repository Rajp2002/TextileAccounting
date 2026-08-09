import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCostingResult, calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import {
  getEstimatorReadiness,
  requiresFactoryCapacity,
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

  it('does not require hidden factory capacity for a direct-rate Base costing', () => {
    const estimate = makeCompleteDirectEstimate()
    estimate.loomCount = 0
    estimate.monthlyOutputM = 0
    estimate.avgOutputPerLoomPerDay = 0

    expect(requiresFactoryCapacity(estimate)).toBe(false)
    expect(requiresFactoryCapacity(estimate, true)).toBe(true)

    const validation = validateEstimatorSnapshot(estimate, {
      requireTapeLength: false,
      requireCapacity: requiresFactoryCapacity(estimate),
    })
    expect(validation.valid).toBe(true)

    const totals = calcFullTotals(estimate)
    const result = buildCostingResult(estimate, totals)
    expect(result.overheadSource).toBe('direct_rate')
    expect(result.overheadPerM).toBe(3)
    expect(result.productionCostPerM).toBeGreaterThan(0)

    estimate.overheadMode = 'monthly_expenses'
    estimate.overheadOverridePerM = null
    expect(requiresFactoryCapacity(estimate)).toBe(true)

    const client = fs.readFileSync(
      path.join(root, 'app/(dashboard)/owner/estimator/EstimatorClient.tsx'),
      'utf8',
    )
    const actions = fs.readFileSync(
      path.join(root, 'app/(dashboard)/owner/estimator/actions.ts'),
      'utf8',
    )
    expect(client).toContain('requireCapacity: requireCapacityForCurrentCosting')
    expect(actions).toContain("requiresFactoryCapacity(estimate, newRecordKind === 'quotation')")
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

  it('explains the capacity warning and whether monthly output drives overhead', () => {
    const directEstimate = makeCompleteDirectEstimate()
    directEstimate.monthlyOutputM = 40_000
    const directWarnings = validateEstimatorSnapshot(directEstimate, {
      requireTapeLength: false,
      requireCapacity: false,
    }).warnings ?? []
    const directCapacityWarning = directWarnings.find(warning => warning.field === 'monthlyOutputM')

    expect(directCapacityWarning?.message).toContain('Monthly output is above the rated loom capacity.')
    expect(directCapacityWarning?.message).toContain('Actual output is 40,000 m versus 31,200 m rated capacity')
    expect(directCapacityWarning?.message).toContain('24 looms × 26 working days × 50 m/loom/day')
    expect(directCapacityWarning?.message).toContain('Direct overhead uses the saved ₹/m rate')

    const monthlyEstimate = { ...directEstimate, overheadMode: 'monthly_expenses' as const, overheadOverridePerM: null }
    const monthlyWarnings = validateEstimatorSnapshot(monthlyEstimate, {
      requireTapeLength: false,
      requireCapacity: false,
    }).warnings ?? []
    expect(monthlyWarnings.find(warning => warning.field === 'monthlyOutputM')?.message)
      .toContain('Monthly output is the denominator for monthly-expense overhead')
  })
})
