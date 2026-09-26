import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'
import { validateFactoryCostProfile } from '../lib/estimator-validation'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Sprint 3 estimator simplicity and textile workflow', () => {
  it('uses the same engine for direct and monthly-expense overhead methods', () => {
    const monthly = makeDefaultEstimateState()
    monthly.overheadMode = 'monthly_expenses'
    monthly.overheadItems = [{
      id: 'electricity', label: 'Electricity', monthlyAmount: 50_000,
      category: 'electricity', source: 'manual', isPreset: true, isLocked: false,
    }]
    monthly.monthlyOutputM = 10_000
    monthly.overheadOverridePerM = null

    const calculated = calcFullTotals(monthly)
    expect(calculated.overheadPerM).toBe(5)

    const direct = { ...monthly, overheadMode: 'direct' as const, overheadOverridePerM: 12.5 }
    expect(calcFullTotals(direct).overheadPerM).toBe(12.5)

    const switchedBack = { ...direct, overheadMode: 'monthly_expenses' as const, overheadOverridePerM: null }
    expect(calcFullTotals(switchedBack).overheadPerM).toBe(5)
  })

  it('validates the selected overhead method without requiring a percentage setting', () => {
    const monthly = {
      warping_rate_per_kg: 2,
      sizing_rate_per_kg: 1.5,
      winding_rate_per_kg: 0,
      overhead_mode: 'monthly_expenses' as const,
      monthly_output_m: 10_000,
      default_commission_pct: 2,
      default_transport_per_m: 0,
    }
    expect(validateFactoryCostProfile(monthly).valid).toBe(true)
    expect(validateFactoryCostProfile({ ...monthly, overhead_pct: Number.NaN }).valid).toBe(true)
    expect(validateFactoryCostProfile({ ...monthly, overhead_mode: 'monthly_expenses', monthly_output_m: 0 }).valid).toBe(false)
    expect(validateFactoryCostProfile({ ...monthly, overhead_mode: 'direct', overhead_override_per_m: 12.5, monthly_output_m: 0 }).valid).toBe(true)
    expect(validateFactoryCostProfile({ ...monthly, overhead_mode: 'direct', overhead_override_per_m: 0 }).valid).toBe(false)
  })

  it('keeps Base entry focused on quality and keeps customer only for quotation context/export', () => {
    const client = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const settings = read('components/settings/factory-cost-profile.tsx')
    const english = read('lib/i18n/locales/en.ts')

    expect(client).toContain('Quick Costing')
    expect(client).toContain('same calculation engine')
    expect(client).toContain('const showPartyField = canUseProduction && !isStandaloneCostingSession')
    expect(client).toContain('defaultCustomerName={showPartyField ? partyName : \'\'}')
    expect(client).not.toContain('totals.effectiveOverheadPct')
    expect(settings).not.toContain('label="Overhead %"')
    expect(english).toContain('add_blend: "Add warp yarn component"')
    expect(english).toContain('add_weft: "Add weft yarn component"')
  })

  it('persists the method and leaves legacy percentage columns compatibility-only', () => {
    const migration = read('supabase/migrations/20260731150000_sprint3_estimator_simplicity.sql')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')

    expect(migration).toContain('overhead_mode')
    expect(migration).toContain('ALTER COLUMN overhead_pct SET DEFAULT 0')
    expect(migration).toContain('Legacy compatibility column')
    expect(actions).toContain('overhead_mode: profileData.overhead_mode')
    expect(read('lib/estimator-quote-payload.ts')).toContain('overhead_pct: 0,')
  })
})
