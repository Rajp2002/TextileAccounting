import { describe, expect, it } from 'vitest'
import { makeDefaultEstimateState } from '../lib/estimator'
import { getYarnDensityWarning, validateEstimatorSnapshot } from '../lib/estimator-validation'
import { parseNonNegativeInput, parseNumericInput } from '../lib/numeric-input'
import { normalizeIndianPhone } from '../lib/phone'

describe('Sprint 2 calculation safety', () => {
  it('hard-blocks impossible denier values and preserves the common-range warning', () => {
    const estimate = makeDefaultEstimateState()
    estimate.tapeLengthM = 1_000
    estimate.perPickCostPaisa = 0.14
    estimate.monthlyOutputM = 10_000
    estimate.loomCount = 24
    estimate.warpRows[0] = { ...estimate.warpRows[0], calcDenier: 200_000, beamEnds: 3_200, yarnRate: 107 }
    estimate.weftRows[0] = { ...estimate.weftRows[0], calcDenier: 75, picks: 68, effectiveCostingWidthCm: 112, yarnRate: 107 }

    const invalid = validateEstimatorSnapshot(estimate, { requireTapeLength: false })
    expect(invalid.valid).toBe(false)
    expect(invalid.issues).toContainEqual(expect.objectContaining({ field: 'warpRows.0.calcDenier' }))

    estimate.warpRows[0].calcDenier = 1_500
    const warned = validateEstimatorSnapshot(estimate, { requireTapeLength: false })
    expect(warned.valid).toBe(true)
    expect(warned.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'warpRows.0.calcDenier' }),
    ]))
    expect(getYarnDensityWarning(1_500)).toContain('Unusually heavy')
  })

  it('rejects negative values and missing layer labels before costing is saved', () => {
    const estimate = makeDefaultEstimateState()
    estimate.warpRows[0] = { ...estimate.warpRows[0], label: '', yarnRate: -1, beamEnds: 3_200 }
    estimate.weftRows[0] = { ...estimate.weftRows[0], label: 'Main Weft', picks: 68, effectiveCostingWidthCm: 112, yarnRate: 107 }

    const result = validateEstimatorSnapshot(estimate, { requireTapeLength: false })
    expect(result.valid).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'warpRows.0.label' }),
      expect.objectContaining({ field: 'warpRows.0.yarnRate' }),
    ]))
  })

  it('keeps unusual but plausible width and output values as warnings', () => {
    const estimate = makeDefaultEstimateState()
    estimate.tapeLengthM = 1_000
    estimate.perPickCostPaisa = 0.14
    estimate.monthlyOutputM = 10_000
    estimate.loomCount = 24
    estimate.warpRows[0] = { ...estimate.warpRows[0], calcDenier: 75, beamEnds: 3_200, yarnRate: 107 }
    estimate.weftRows[0] = { ...estimate.weftRows[0], calcDenier: 75, picks: 68, effectiveCostingWidthCm: 62, yarnRate: 107 }
    estimate.avgOutputPerLoomPerDay = 600

    const result = validateEstimatorSnapshot(estimate, { requireTapeLength: false })
    expect(result.valid).toBe(true)
    expect(result.warnings?.map(warning => warning.field)).toEqual(expect.arrayContaining([
      'weftRows.0.effectiveCostingWidthCm',
      'avgOutputPerLoomPerDay',
    ]))
  })

  it('rejects invalid browser numeric input without allowing it into state', () => {
    expect(parseNonNegativeInput('-1')).toBeNull()
    expect(parseNonNegativeInput('Infinity')).toBeNull()
    expect(parseNumericInput('0', { min: 1 })).toBeNull()
    expect(parseNonNegativeInput('75')).toBe(75)
  })

  it('normalizes local and pasted +91 phone formats', () => {
    expect(normalizeIndianPhone('9876543210')).toBe('9876543210')
    expect(normalizeIndianPhone('+91 9876543210')).toBe('9876543210')
    expect(normalizeIndianPhone('91-9876543210')).toBe('9876543210')
  })
})
