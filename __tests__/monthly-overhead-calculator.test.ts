import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { calcFullTotals, makeDefaultEstimateState, type OverheadItem } from '../lib/estimator'
import {
  deriveCostingOverheadPerMetre,
  ensureMonthlyOverheadPresetCoverage,
  getMonthlyOverheadTotal,
  getOverheadDifferencePerMetre,
} from '../lib/monthly-overhead'

const root = process.cwd()

function expense(label: string, monthlyAmount: number): OverheadItem {
  return {
    id: label,
    label,
    monthlyAmount,
    source: 'manual',
    category: 'custom',
    isPreset: true,
    isLocked: false,
  }
}

describe('monthly overhead derivation', () => {
  const expenses = [
    expense('Electricity / Utilities', 540_000),
    expense('Maintenance & Repairs', 120_000),
    expense('Fixed Salary Factory Staff', 260_000),
    expense('Rent / Facility Cost', 150_000),
    expense('Other', 80_000),
  ]

  it('derives the sprint example without rounding individual expenses', () => {
    expect(getMonthlyOverheadTotal(expenses)).toBe(1_150_000)
    expect(deriveCostingOverheadPerMetre(expenses, 90_000)).toBeCloseTo(12.7777777778, 8)
  })

  it('returns no recommendation for a missing or zero denominator', () => {
    expect(deriveCostingOverheadPerMetre(expenses, 0)).toBeNull()
    expect(deriveCostingOverheadPerMetre(expenses, Number.NaN)).toBeNull()
  })

  it('compares the recommendation with the current working rate', () => {
    const recommended = deriveCostingOverheadPerMetre(expenses, 90_000)
    expect(getOverheadDifferencePerMetre(recommended, 13.5)).toBeCloseTo(-0.7222222222, 8)
  })

  it('does not change the estimator until the recommendation is applied', () => {
    const recommended = deriveCostingOverheadPerMetre(expenses, 90_000)
    expect(recommended).not.toBeNull()

    const current = {
      ...makeDefaultEstimateState(),
      overheadMode: 'direct' as const,
      overheadOverridePerM: 13.5,
    }
    expect(calcFullTotals(current).overheadPerM).toBe(13.5)

    const applied = {
      ...current,
      overheadMode: 'monthly_expenses' as const,
      overheadItems: expenses,
      monthlyOutputM: 90_000,
      overheadOverridePerM: recommended,
    }
    expect(calcFullTotals(applied).overheadPerM).toBeCloseTo(12.7777777778, 8)
  })

  it('keeps calculator drafts separate from the dedicated apply mutation', () => {
    const component = readFileSync(join(root, 'components/settings/monthly-overhead-calculator.tsx'), 'utf8')
    const settings = readFileSync(join(root, 'components/settings/factory-cost-profile.tsx'), 'utf8')
    const actions = readFileSync(join(root, 'app/(dashboard)/owner/estimator/actions.ts'), 'utf8')

    expect(component).toContain('const [items, setItems]')
    expect(component).toContain("type CalculatorView = 'summary' | 'edit' | 'confirm'")
    expect(settings).toContain('applyMonthlyDerivedOverhead')
    expect(actions).toContain("overhead_mode: 'monthly_expenses'")
    expect(actions).toContain('overhead_override_per_m: derivedOverheadPerMetre')
    expect(actions).toContain(".eq('updated_at', data.expectedUpdatedAt)")
  })

  it('does not introduce monthly history or actual-production reporting', () => {
    const component = readFileSync(join(root, 'components/settings/monthly-overhead-calculator.tsx'), 'utf8')
    expect(component).not.toContain('Recent Months')
    expect(component).not.toContain('Actual Monthly Production')
    expect(component).not.toContain('month selector')
  })

  it('upgrades an older saved expense set without losing its amounts or custom rows', () => {
    const legacy = [
      { ...expense('Electricity', 540_000), category: 'electricity' as const },
      { ...expense('Water & Maintenance', 120_000), category: 'water' as const },
      { ...expense('Security', 45_000), isPreset: false },
    ]
    const upgraded = ensureMonthlyOverheadPresetCoverage(legacy)

    expect(upgraded.find(item => item.label === 'Electricity / Utilities')?.monthlyAmount).toBe(540_000)
    expect(upgraded.find(item => item.label === 'Maintenance & Repairs')?.monthlyAmount).toBe(120_000)
    expect(upgraded.find(item => item.label === 'Security')?.monthlyAmount).toBe(45_000)
    expect(upgraded.filter(item => item.isPreset)).toHaveLength(7)
  })

  it('summarizes saved monthly assumptions before reactivating them from manual mode', () => {
    const component = readFileSync(join(root, 'components/settings/monthly-overhead-calculator.tsx'), 'utf8')
    const settings = readFileSync(join(root, 'components/settings/factory-cost-profile.tsx'), 'utf8')

    expect(settings).toContain("initialView={overheadMode === 'direct' && hasSavedMonthlyConfiguration ? 'summary' : 'edit'}")
    expect(component).toContain("view === 'summary'")
    expect(component).toContain("tx('Total monthly expenses')")
    expect(component).toContain("tx('Standard monthly production')")
    expect(component).toContain("tx('Derived costing overhead')")
    expect(component).toContain("setView('edit')")
    expect(component).toContain("tx('Edit details')")
  })
})
