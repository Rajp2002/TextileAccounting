import Decimal from 'decimal.js'
import { nanoid } from 'nanoid'

import { DEFAULT_OVERHEAD_ITEMS, type OverheadItem } from './estimator'

function matchesPreset(item: OverheadItem, preset: Omit<OverheadItem, 'id'>) {
  if (!item.isPreset) return false
  if (preset.label === 'Maintenance & Repairs') {
    return item.category === 'spares_repairs' || item.category === 'water'
  }
  if (preset.label === 'Indirect Labour / Indirect Materials') {
    return /indirect|consumable/i.test(item.label)
  }
  if (preset.label === 'Other') {
    return /^other(?: expenses?)?$/i.test(item.label.trim())
  }
  return item.category === preset.category
}

/**
 * Bring configurations saved before the calculator sprint up to the current
 * category set without altering custom rows or losing entered amounts.
 */
export function ensureMonthlyOverheadPresetCoverage(items: OverheadItem[]): OverheadItem[] {
  const remaining = items.map(item => ({ ...item }))
  const presets = DEFAULT_OVERHEAD_ITEMS.map(preset => {
    const matchIndex = remaining.findIndex(item => matchesPreset(item, preset))
    if (matchIndex < 0) return { id: nanoid(), ...preset }
    const [match] = remaining.splice(matchIndex, 1)
    return {
      ...match,
      label: preset.label,
      category: preset.category,
      isPreset: true,
      isLocked: match.isLocked ?? false,
    }
  })
  return [...presets, ...remaining]
}

export function getMonthlyOverheadTotal(items: Pick<OverheadItem, 'monthlyAmount'>[]): number {
  return items.reduce((total, item) => {
    const amount = Number(item.monthlyAmount)
    return Number.isFinite(amount) && amount >= 0 ? total.plus(amount) : total
  }, new Decimal(0)).toNumber()
}

export function deriveCostingOverheadPerMetre(
  items: Pick<OverheadItem, 'monthlyAmount'>[],
  standardMonthlyProductionMetres: number,
): number | null {
  const production = Number(standardMonthlyProductionMetres)
  if (!Number.isFinite(production) || production <= 0) return null

  return new Decimal(getMonthlyOverheadTotal(items)).div(production).toNumber()
}

export function getOverheadDifferencePerMetre(recommended: number | null, current: number): number | null {
  if (recommended == null || !Number.isFinite(current)) return null
  return new Decimal(recommended).minus(current).toNumber()
}
