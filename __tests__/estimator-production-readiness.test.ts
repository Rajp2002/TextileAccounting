import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  calcFullTotals,
  cottonCountNeToDenier,
  denierToCottonCountNe,
  makeDefaultEstimateState,
} from '../lib/estimator'
import {
  getYarnDensityWarning,
  validateEstimatorSnapshot,
} from '../lib/estimator-validation'
import { resolveEffectiveSubscription } from '../lib/subscription-access'

const estimatorClientSource = readFileSync(
  join(process.cwd(), 'app/(dashboard)/owner/estimator/EstimatorClient.tsx'),
  'utf8',
)
const estimatorActionsSource = readFileSync(
  join(process.cwd(), 'app/(dashboard)/owner/estimator/actions.ts'),
  'utf8',
)
const globalStylesSource = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('Estimator production-readiness regressions', () => {
  it('never asks for tape length in the estimator (the production-plan beam planner is retired)', () => {
    // Phase 3H removed the beam planner and tape-length field, which rendered
    // only when canUseProduction was true (never on Free, Lite or Base).
    expect(estimatorClientSource).not.toContain("label={t('estimator.warp.tape_len')}")
    expect(estimatorClientSource).not.toContain('fieldKey="tapeLengthM"')
    expect(estimatorClientSource).toContain('requireTapeLength: false')
  })

  it('allows base-plan costing without tape length while production still requires it', () => {
    const estimate = makeDefaultEstimateState()
    estimate.tapeLengthM = 0
    estimate.monthlyOutputM = 10_000
    estimate.perPickCostPaisa = 0.14
    estimate.warpRows[0] = {
      ...estimate.warpRows[0],
      calculationMode: 'manual',
      manualKgPer100m: 3.25,
      yarnRate: 120,
    }
    estimate.weftRows[0] = {
      ...estimate.weftRows[0],
      calculationMode: 'manual',
      manualKgPer100m: 2.75,
      picks: 60,
      yarnRate: 120,
    }

    expect(validateEstimatorSnapshot(estimate, { requireTapeLength: false })).toEqual({ valid: true, issues: [] })
    expect(validateEstimatorSnapshot(estimate).valid).toBe(false)
    expect(calcFullTotals(estimate).totalProductionCostPerM).toBeGreaterThan(0)
  })

  it('allows a Base saved quality recipe without the production-only tape length', () => {
    expect(estimatorActionsSource).toMatch(
      /validateEstimatorSnapshot\(snapshot, \{\s*requireTapeLength: false,?\s*\}\)/,
    )
  })

  it('calculates beam capacity by dividing consumed tape by the crimp factor', () => {
    const estimate = makeDefaultEstimateState()
    estimate.tapeLengthM = 1_000
    estimate.warpCrimpPct = 5

    expect(calcFullTotals(estimate).estimatedBeamCapacityM).toBeCloseTo(952.380952, 6)
  })

  it('accepts genuinely manual yarn rows without hidden formula inputs', () => {
    const estimate = makeDefaultEstimateState()
    estimate.tapeLengthM = 1_000
    estimate.monthlyOutputM = 10_000
    estimate.perPickCostPaisa = 0.14
    estimate.warpRows = [{
      ...estimate.warpRows[0],
      calculationMode: 'manual',
      calcDenier: 0,
      beamEnds: 0,
      manualKgPer100m: 3.25,
      yarnRate: 120,
    }]
    estimate.weftRows = [{
      ...estimate.weftRows[0],
      calculationMode: 'manual',
      calcDenier: 0,
      picks: 60,
      reedSpace: 0,
      effectiveCostingWidthCm: 0,
      manualKgPer100m: 2.75,
      yarnRate: 120,
    }]

    expect(validateEstimatorSnapshot(estimate)).toEqual({ valid: true, issues: [] })
  })

  it('rejects zero denier in formula mode and nudges unusually low positive denier', () => {
    const estimate = makeDefaultEstimateState()
    estimate.weftRows[0] = {
      ...estimate.weftRows[0],
      calculationMode: 'formula',
      calcDenier: 0,
      picks: 60,
      effectiveCostingWidthCm: 150,
      yarnRate: 120,
    }

    const validation = validateEstimatorSnapshot(estimate)
    expect(validation.valid).toBe(false)
    if (!validation.valid) {
      expect(validation.issues).toContainEqual({
        field: 'weftRows.0.calcDenier',
        message: 'Weft layer 1 (Weft 1) denier must be greater than 0.',
      })
    }

    expect(getYarnDensityWarning(0)).toBeUndefined()
    expect(getYarnDensityWarning(19.9)).toContain('Unusually low')
    expect(getYarnDensityWarning(20)).toBeUndefined()
  })

  it('does not present an invalid draft as a final cost breakdown', () => {
    expect(estimatorClientSource).toContain('Costing incomplete')
    expect(estimatorClientSource).toContain('Draft values are not treated as a final result')
    expect(estimatorClientSource).toContain('warning={densityWarning}')
  })

  it('converts English cotton count to denier using the documented 5315/Ne basis', () => {
    // Independent reference: 40 Ne = 40 × 840 yd/lb, which is 132.875 denier.
    expect(cottonCountNeToDenier(40)).toBeCloseTo(132.875, 9)
    expect(denierToCottonCountNe(132.875)).toBeCloseTo(40, 9)
  })

  it('uses cotton count rather than a stale client denier when costing formula rows', () => {
    const estimate = makeDefaultEstimateState()
    estimate.tapeLengthM = 1_000
    estimate.monthlyOutputM = 10_000
    estimate.perPickCostPaisa = 0.16
    estimate.warpRows = [{
      ...estimate.warpRows[0],
      linearDensityUnit: 'cotton_count_ne',
      cottonCountNe: 40,
      calcDenier: 1, // deliberately stale/tampered; server math must ignore it
      beamEnds: 3_000,
      yarnRate: 200,
    }]
    estimate.weftRows = [{
      ...estimate.weftRows[0],
      linearDensityUnit: 'denier',
      calcDenier: 75,
      picks: 60,
      reedSpace: 152.4,
      effectiveCostingWidthCm: 152.4,
      yarnRate: 110,
    }]

    const validation = validateEstimatorSnapshot(estimate)
    const result = calcFullTotals(estimate)

    expect(validation).toEqual({ valid: true, issues: [] })
    expect(result.warpRows[0].calcDenier).toBeCloseTo(132.875, 9)
    expect(result.warpRows[0].formulaKgPer100m).toBeCloseTo(4.4291666667, 9)
  })

  it('rejects missing or impossible cotton counts at the shared server boundary', () => {
    const estimate = makeDefaultEstimateState()
    estimate.warpRows[0] = {
      ...estimate.warpRows[0],
      linearDensityUnit: 'cotton_count_ne',
      cottonCountNe: 0,
      beamEnds: 3_000,
      yarnRate: 200,
    }

    const validation = validateEstimatorSnapshot(estimate)
    expect(validation.valid).toBe(false)
    if (!validation.valid) {
      expect(validation.issues.some(issue => issue.field === 'warpRows.0.cottonCountNe')).toBe(true)
    }
  })

  it('does not let a newer failed payment row mask an older active entitlement', () => {
    const now = Date.parse('2026-07-10T05:00:00Z')
    const result = resolveEffectiveSubscription([
      {
        status: 'cancelled',
        plan_tier: 'premium',
        current_end: null,
        created_at: '2026-07-10T04:00:00Z',
      },
      {
        status: 'active',
        plan_tier: 'base',
        current_end: '2027-07-10T00:00:00Z',
        created_at: '2026-07-09T04:00:00Z',
      },
    ], now)

    expect(result.tier).toBe('base')
    expect(result.subscription?.status).toBe('active')
  })

  it('selects Base when a retired plan row is also current', () => {
    const result = resolveEffectiveSubscription([
      { status: 'active', plan_tier: 'base', current_end: null, created_at: '2026-07-10T04:00:00Z' },
      { status: 'authenticated', plan_tier: 'premium', current_end: null, created_at: '2026-07-09T04:00:00Z' },
    ])

    expect(result.tier).toBe('base')
  })

  it('announces save-as-new quality failures next to the name field', () => {
    expect(estimatorClientSource).toContain('const [templateSaveError, setTemplateSaveError]')
    expect(estimatorClientSource).toContain('aria-invalid={Boolean(templateSaveError)}')
    expect(estimatorClientSource).toContain('aria-describedby={templateSaveError ? \'save-quality-name-error\' : undefined}')
    expect(estimatorClientSource).toContain('id="save-quality-name-error" role="alert"')
    expect(estimatorClientSource).toContain('setTemplateSaveError(message)')
  })

  it('keeps applied-quality actions inside narrow mobile viewports', () => {
    expect(estimatorClientSource).toContain('col-span-2 flex min-w-0 flex-wrap items-center gap-1')
    expect(estimatorClientSource).toContain('h-12 min-w-0 rounded-[10px] border border-[var(--color-hairline)]')
  })

  it('prevents iOS Safari focus zoom on estimator text controls', () => {
    expect(estimatorClientSource).toContain('estimator-mobile-form space-y-5')
    expect(globalStylesSource).toContain('@media (max-width: 767.98px)')
    expect(globalStylesSource).toContain('.estimator-mobile-form input:not([type])')
    expect(globalStylesSource).toContain('.estimator-mobile-form select')
    expect(globalStylesSource).toContain('font-size: 1rem;')
  })
})
