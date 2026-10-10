import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getEffectiveCommercialInputs, makeDefaultEstimateState } from '../lib/estimator'
import { restoreSavedQualityCostingAssumptions } from '../lib/saved-costings'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Base Saved Quality full-costing reuse', () => {
  it('restores overhead, commercial, quantity, capacity, and section state from the latest costing', () => {
    const baseline = makeDefaultEstimateState()
    baseline.commissionPct = 0
    baseline.transportPerM = 0
    baseline.orderQuantityM = null
    baseline.enabledSections = {
      winding: false,
      processing: false,
      finishing: false,
      commission: false,
      transport: false,
    }

    const restored = restoreSavedQualityCostingAssumptions(baseline, {
      warping_rate_per_kg: 4,
      sizing_rate_per_kg: 2.5,
      winding_rate_per_kg: 1.25,
      processing_rate_per_m: 3.5,
      finishing_rate_per_m: 1.75,
      overhead_items: [{ id: 'rent', label: 'Rent', monthlyAmount: 620_000 }],
      monthly_output_m: 54_000,
      overhead_override_per_m: null,
      commission_pct: 3.5,
      transport_per_m: 0.8,
      profit_margin_pct: 14,
      order_quantity_m: 5_000,
      enabled_sections: { processing: true, commission: true, transport: true },
      loom_count: 8,
      monthly_working_days: 26,
      avg_output_per_loom_per_day: 70,
    })

    expect(restored).toMatchObject({
      warpingRatePerKg: 4,
      sizingRatePerKg: 2.5,
      windingRatePerKg: 1.25,
      processingRatePerM: 3.5,
      finishingRatePerM: 1.75,
      monthlyOutputM: 54_000,
      overheadMode: 'monthly_expenses',
      overheadOverridePerM: null,
      commissionPct: 3.5,
      transportPerM: 0.8,
      profitPct: 14,
      orderQuantityM: 5_000,
      loomCount: 8,
      monthlyWorkingDays: 26,
      avgOutputPerLoomPerDay: 70,
      enabledSections: {
        winding: false,
        processing: true,
        finishing: false,
        commission: true,
        transport: true,
      },
    })
    expect(restored.overheadItems[0]).toMatchObject({ label: 'Rent', monthlyAmount: 620_000 })
    expect(getEffectiveCommercialInputs(restored)).toMatchObject({
      commissionPct: 3.5,
      transportPerM: 0.8,
      commissionToggleMismatch: false,
      transportToggleMismatch: false,
    })
  })

  it('restores an explicitly blank quantity instead of leaking the previous estimate quantity', () => {
    const baseline = makeDefaultEstimateState()
    baseline.orderQuantityM = 8_000

    const restored = restoreSavedQualityCostingAssumptions(baseline, {
      order_quantity_m: null,
      overhead_override_per_m: 4,
      overhead_mode: 'direct',
    })

    expect(restored.orderQuantityM).toBeNull()
    expect(restored.overheadMode).toBe('direct')
    expect(restored.overheadOverridePerM).toBe(4)
  })

  it('wires Base template loading and the save review to the explicit contract', () => {
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

    expect(actions).toContain(".eq('record_kind', 'costing')")
    expect(actions).toContain('latest_costing_reuse')
    expect(estimator).toContain('restoreSavedQualityCostingAssumptions')
    expect(estimator).toContain('Using today’s yarn rates with the other costs from the latest saved costing.')
    expect(estimator).toContain('data-testid="costing-save-review"')
    expect(estimator).toContain('This costing will save:')
    expect(estimator).toContain('Sections on:')
  })
})
