import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCostingResult, calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import { en } from '../lib/i18n/locales/en'
import { hi } from '../lib/i18n/locales/hi'
import { gu } from '../lib/i18n/locales/gu'

describe('Lite winding scope', () => {
  it('charges total warp plus weft once and preserves the amount in the snapshot', () => {
    const state = makeDefaultEstimateState()
    state.warpRows[0] = { ...state.warpRows[0], calculationMode: 'manual', manualKgPer100m: 3 }
    state.weftRows[0] = { ...state.weftRows[0], calculationMode: 'manual', manualKgPer100m: 4 }
    state.warpCrimpPct = 0
    state.yarnShortagePct = 0
    state.windingRatePerKg = 4
    state.enabledSections.winding = true
    const enabled = calcFullTotals(state)
    expect(enabled.totalWarpKgPer100m).toBe(3)
    expect(enabled.totalAllYarnKgPer100m).toBe(7)
    expect(enabled.windingPerM).toBe(0.28)
    expect(buildCostingResult(state, enabled).breakdown.windingPerM).toBe(0.28)
    state.enabledSections.winding = false
    const disabled = calcFullTotals(state)
    expect(disabled.windingPerM).toBe(0)
    expect(enabled.audit.productionCostPerMeter - disabled.audit.productionCostPerMeter).toBeCloseTo(0.28)
  })

  it('labels the winding basis separately from the warp-only warping/sizing basis in all locales', () => {
    const client = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
    expect(client).toContain("t('estimator.post_processing.winding_scope').replace('{kg}', totals.totalAllYarnKgPer100m.toFixed(2))")
    expect(en.estimator.post_processing.winding_scope).toContain('warp + weft')
    for (const locale of [en, hi, gu]) {
      expect(locale.estimator.post_processing.winding_scope).toContain('{kg}')
      expect(locale.estimator.post_processing.winding_scope).toContain('100')
      expect(locale.estimator.warping_sizing.warp_consumption).toContain('100')
    }
  })
})
