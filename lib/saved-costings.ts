import type { WarpRow, WeftRow } from '@/lib/estimator'

export type SavedCostingSort = 'recent' | 'oldest' | 'margin_desc' | 'cost_asc'
export type SavedCostingMarginFilter = 'all' | 'negative' | 'under_10' | '10_to_20' | 'over_20'

export type SavedCostingListItem = {
  id: string
  party_name: string
  quality_label: string | null
  quote_price_per_meter: number
  landed_cost_per_meter: number
  intended_margin_percent: number
  meters: number
  created_at: string
  updated_at: string
}

export type VersionedSavedCostingListItem = SavedCostingListItem & {
  costing_group_id?: string | null
  version_number?: number | null
}

export type LegacySavedCostingYarnFallbacks = {
  beamEnds?: unknown
  reedSpace?: unknown
  warpDenier?: unknown
  weftDenier?: unknown
  yarnRate?: unknown
  picks?: unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function finiteNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function nullableFiniteNumber(value: unknown, fallback: number | null): number | null {
  if (value === null) return null
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Saved costing snapshots created before the multi-yarn estimator used
 * `denier`/`ends` instead of `calcDenier`/`beamEnds`. Normalize those rows at
 * the read boundary so one legacy snapshot cannot crash the costing library.
 */
export function normalizeSavedWarpRows(
  rows: unknown,
  fallbackRow: WarpRow,
  legacy: LegacySavedCostingYarnFallbacks = {},
): WarpRow[] {
  const sourceRows = Array.isArray(rows) && rows.length > 0 ? rows : [{}]
  return sourceRows.map((value, index) => {
    const row = asRecord(value)
    return {
      id: typeof row.id === 'string' && row.id ? row.id : `legacy-warp-${index}`,
      label: typeof row.label === 'string' ? row.label : fallbackRow.label,
      calculationMode: row.calculationMode === 'manual' ? 'manual' : 'formula',
      manualKgPer100m: nullableFiniteNumber(row.manualKgPer100m, fallbackRow.manualKgPer100m ?? null),
      linearDensityUnit: row.linearDensityUnit === 'cotton_count_ne' ? 'cotton_count_ne' : 'denier',
      cottonCountNe: nullableFiniteNumber(row.cottonCountNe, fallbackRow.cottonCountNe ?? null),
      calcDenier: finiteNumber(row.calcDenier ?? row.denier ?? legacy.warpDenier, fallbackRow.calcDenier),
      beamEnds: finiteNumber(row.beamEnds ?? row.ends ?? legacy.beamEnds, fallbackRow.beamEnds),
      yarnRate: finiteNumber(row.yarnRate ?? legacy.yarnRate, fallbackRow.yarnRate),
      gstPct: finiteNumber(row.gstPct, fallbackRow.gstPct),
      shortagePct: nullableFiniteNumber(row.shortagePct, fallbackRow.shortagePct),
    }
  })
}

export function normalizeSavedWeftRows(
  rows: unknown,
  fallbackRow: WeftRow,
  legacy: LegacySavedCostingYarnFallbacks = {},
): WeftRow[] {
  const sourceRows = Array.isArray(rows) && rows.length > 0 ? rows : [{}]
  return sourceRows.map((value, index) => {
    const row = asRecord(value)
    return {
      id: typeof row.id === 'string' && row.id ? row.id : `legacy-weft-${index}`,
      label: typeof row.label === 'string' ? row.label : fallbackRow.label,
      calculationMode: row.calculationMode === 'manual' ? 'manual' : 'formula',
      manualKgPer100m: nullableFiniteNumber(row.manualKgPer100m, fallbackRow.manualKgPer100m ?? null),
      picks: finiteNumber(row.picks ?? legacy.picks, fallbackRow.picks),
      reedSpace: finiteNumber(row.reedSpace ?? legacy.reedSpace, fallbackRow.reedSpace),
      finishedWidthCm: nullableFiniteNumber(row.finishedWidthCm, fallbackRow.finishedWidthCm ?? null),
      effectiveCostingWidthCm: nullableFiniteNumber(row.effectiveCostingWidthCm, fallbackRow.effectiveCostingWidthCm ?? null),
      linearDensityUnit: row.linearDensityUnit === 'cotton_count_ne' ? 'cotton_count_ne' : 'denier',
      cottonCountNe: nullableFiniteNumber(row.cottonCountNe, fallbackRow.cottonCountNe ?? null),
      calcDenier: finiteNumber(row.calcDenier ?? row.denier ?? legacy.weftDenier, fallbackRow.calcDenier),
      yarnRate: finiteNumber(row.yarnRate ?? legacy.yarnRate, fallbackRow.yarnRate),
      gstPct: finiteNumber(row.gstPct, fallbackRow.gstPct),
      shortagePct: nullableFiniteNumber(row.shortagePct, fallbackRow.shortagePct),
    }
  })
}

function matchesMargin(value: number, filter: SavedCostingMarginFilter) {
  if (filter === 'negative') return value < 0
  if (filter === 'under_10') return value >= 0 && value < 10
  if (filter === '10_to_20') return value >= 10 && value <= 20
  if (filter === 'over_20') return value > 20
  return true
}

export function filterAndSortSavedCostings<T extends SavedCostingListItem>(
  costings: T[],
  options: {
    query: string
    sort: SavedCostingSort
    margin: SavedCostingMarginFilter
  },
) {
  const query = options.query.trim().toLocaleLowerCase('en-IN')
  return [...costings]
    .filter(costing => {
      const searchable = `${costing.quality_label ?? ''} ${costing.party_name}`.toLocaleLowerCase('en-IN')
      return (!query || searchable.includes(query))
        && matchesMargin(Number(costing.intended_margin_percent), options.margin)
    })
    .sort((left, right) => {
      if (options.sort === 'oldest') return Date.parse(left.updated_at) - Date.parse(right.updated_at)
      if (options.sort === 'margin_desc') return Number(right.intended_margin_percent) - Number(left.intended_margin_percent)
      if (options.sort === 'cost_asc') return Number(left.landed_cost_per_meter) - Number(right.landed_cost_per_meter)
      return Date.parse(right.updated_at) - Date.parse(left.updated_at)
    })
}

export function compareSavedCostings(left: SavedCostingListItem, right: SavedCostingListItem) {
  return {
    productionCostDelta: Number(right.landed_cost_per_meter) - Number(left.landed_cost_per_meter),
    sellingPriceDelta: Number(right.quote_price_per_meter) - Number(left.quote_price_per_meter),
    marginDelta: Number(right.intended_margin_percent) - Number(left.intended_margin_percent),
    quantityDelta: Number(right.meters) - Number(left.meters),
  }
}

export function getPreviousCostingVersion<T extends VersionedSavedCostingListItem>(
  current: T,
  costings: T[],
) {
  const groupId = current.costing_group_id
  const currentVersion = Number(current.version_number ?? 1)
  if (!groupId || currentVersion <= 1) return null

  return costings
    .filter(costing => costing.costing_group_id === groupId && Number(costing.version_number ?? 1) < currentVersion)
    .sort((left, right) => Number(right.version_number ?? 1) - Number(left.version_number ?? 1))[0] ?? null
}

export function getCostingVersionMovement(current: SavedCostingListItem, previous: SavedCostingListItem | null) {
  if (!previous) return null
  return Number(current.landed_cost_per_meter) - Number(previous.landed_cost_per_meter)
}
