import { describe, expect, it } from 'vitest'
import { buildCostingResult, calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import { getEstimatorReadiness, getYarnDensityWarning, validateCostingResultBoundary, validateEstimatorSnapshot, validateFactoryCostProfile } from '../lib/estimator-validation'
import { parseNonNegativeInput, parseNumericInput } from '../lib/numeric-input'
import { isValidIndianPhone, normalizeIndianPhone } from '../lib/phone'
import { CreateOrgSchema, PasswordSchema } from '../lib/schemas'

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
    expect(normalizeIndianPhone('123456789012')).toBe('')
    expect(normalizeIndianPhone('9876543210abc')).toBe('')
    expect(isValidIndianPhone('+91 (98765) 43210')).toBe(true)
    expect(isValidIndianPhone('09876543210')).toBe(false)
  })

  it('enforces password and confirmation rules at the shared auth boundary', () => {
    expect(PasswordSchema.safeParse('Password1').success).toBe(false)
    expect(PasswordSchema.safeParse('Password1!').success).toBe(true)

    const owner = CreateOrgSchema.safeParse({
      ownerName: 'Rajesh Patel',
      email: 'rajesh@example.com',
      password: 'Password1!',
      confirmPassword: 'Password2!',
      factoryName: 'Patel Weaving',
      phone: '9876543210',
    })
    expect(owner.success).toBe(false)

  })

  it('does not treat an invalid result as displayable money', () => {
    const estimate = makeDefaultEstimateState()
    const validation = validateEstimatorSnapshot(estimate, { requireTapeLength: false })
    const readiness = getEstimatorReadiness({
      validation,
      result: null,
      warningsAcknowledged: true,
    })

    expect(readiness.status).toBe('blocked')
    expect(readiness.canDisplayMoney).toBe(false)
    expect(readiness.canPersist).toBe(false)
  })

  it('blocks invalid factory overhead amounts before the profile can be saved', () => {
    const result = validateFactoryCostProfile({
      warping_rate_per_kg: 0,
      sizing_rate_per_kg: 0,
      winding_rate_per_kg: 0,
      overhead_mode: 'monthly_expenses',
      default_commission_pct: 2,
      default_transport_per_m: 0,
      monthly_output_m: 50_000,
      overhead_items: [{
        id: 'rent',
        category: 'rent',
        label: 'Rent',
        monthlyAmount: -1,
        isPreset: true,
        isLocked: false,
        source: 'manual',
      }],
    })

    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({ field: 'overhead_items.0.monthlyAmount' }))
  })

  it('rejects a tampered total even when the individual money fields are finite', () => {
    const estimate = makeDefaultEstimateState()
    estimate.tapeLengthM = 1_000
    estimate.perPickCostPaisa = 0.14
    estimate.monthlyOutputM = 10_000
    estimate.overheadMode = 'direct'
    estimate.overheadOverridePerM = 3
    estimate.orderQuantityM = 5_000
    estimate.profitPct = 10
    estimate.commissionPct = 2
    estimate.transportPerM = 2
    estimate.warpRows[0] = { ...estimate.warpRows[0], label: 'Main Warp', calcDenier: 75, beamEnds: 3_200, yarnRate: 110 }
    estimate.weftRows[0] = { ...estimate.weftRows[0], label: 'Main Weft', calcDenier: 75, picks: 68, effectiveCostingWidthCm: 110, yarnRate: 110 }
    const totals = calcFullTotals(estimate)
    const result = buildCostingResult(estimate, totals)

    expect(validateCostingResultBoundary(result, totals).valid).toBe(true)
    const tampered = { ...result, totalOrderValue: (result.totalOrderValue ?? 0) + 1 }
    const invalid = validateCostingResultBoundary(tampered, totals)
    expect(invalid.valid).toBe(false)
    expect(invalid.issues).toContainEqual(expect.objectContaining({ field: 'totalOrderValue' }))
  })
})
