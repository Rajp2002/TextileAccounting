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
