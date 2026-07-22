import {
  ensureOverheadIntegrity,
  makeDefaultEstimateState,
  type FactorySections,
  type LoomType,
  type WarpRow,
  type WeftRow,
} from './estimator'

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

export type SavedQualityRecipe = {
  id: string
  name: string
  warp_rows?: unknown
  weft_rows?: unknown
  loom_type?: LoomType | null
  loom_rpm?: unknown
  loom_power_kw?: unknown
  sizing_mode?: 'in_house' | 'outsourced' | null
  hours_per_shift?: unknown
  tape_length_m?: unknown
  warp_crimp_pct?: unknown
  per_pick_cost_paise?: unknown
  yarn_shortage_pct?: unknown
  overhead_override_per_m?: unknown
  calculated_yarn_denier?: unknown
  yarn_denier?: unknown
  beam_ends?: unknown
  ppi?: unknown
  reed_space?: unknown
  weft_denier?: unknown
  default_yarn_rate?: unknown
}

export type SavedQualityFactoryProfile = Partial<{
  warping_rate_per_kg: unknown
  sizing_rate_per_kg: unknown
  winding_rate_per_kg: unknown
  default_processing_rate_per_m: unknown
  default_finishing_rate_per_m: unknown
  overhead_pct: unknown
  default_commission_pct: unknown
  default_transport_per_m: unknown
  enabled_sections: FactorySections
  overhead_items: unknown[]
  monthly_output_m: unknown
  overhead_override_per_m: unknown
  loom_count: unknown
  monthly_working_days: unknown
  avg_output_per_loom_per_day: unknown
  yarn_shortage_pct: unknown
  warp_crimp_pct: unknown
  is_configured: boolean
}>

export type SavedQualityFixedWorker = {
  id: number
  name: string
  role: string
  monthly_salary: number
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
    // Old snapshots may only contain finishedWidthCm. Treat it as a final
    // restore fallback, but do not carry that retired field into live state.
    const effectiveCostingWidthCm = finiteNumber(
      row.effectiveCostingWidthCm ?? row.reedSpace ?? row.finishedWidthCm ?? legacy.reedSpace,
      fallbackRow.effectiveCostingWidthCm ?? fallbackRow.reedSpace,
    )
    return {
      id: typeof row.id === 'string' && row.id ? row.id : `legacy-weft-${index}`,
      label: typeof row.label === 'string' ? row.label : fallbackRow.label,
      calculationMode: row.calculationMode === 'manual' ? 'manual' : 'formula',
      manualKgPer100m: nullableFiniteNumber(row.manualKgPer100m, fallbackRow.manualKgPer100m ?? null),
      picks: finiteNumber(row.picks ?? legacy.picks, fallbackRow.picks),
      reedSpace: effectiveCostingWidthCm,
      effectiveCostingWidthCm,
      linearDensityUnit: row.linearDensityUnit === 'cotton_count_ne' ? 'cotton_count_ne' : 'denier',
      cottonCountNe: nullableFiniteNumber(row.cottonCountNe, fallbackRow.cottonCountNe ?? null),
      calcDenier: finiteNumber(row.calcDenier ?? row.denier ?? legacy.weftDenier, fallbackRow.calcDenier),
      yarnRate: finiteNumber(row.yarnRate ?? legacy.yarnRate, fallbackRow.yarnRate),
      gstPct: finiteNumber(row.gstPct, fallbackRow.gstPct),
      shortagePct: nullableFiniteNumber(row.shortagePct, fallbackRow.shortagePct),
    }
  })
}

/** Build the same live recipe state shown when a saved quality is applied in Cost Estimate. */
export function buildSavedQualityRecipeState(
  recipe: SavedQualityRecipe,
  profile?: SavedQualityFactoryProfile,
  fixedWorkers: SavedQualityFixedWorker[] = [],
) {
  const base = makeDefaultEstimateState()
  let state = {
    ...base,
    warpingRatePerKg: finiteNumber(profile?.warping_rate_per_kg, base.warpingRatePerKg),
    sizingRatePerKg: finiteNumber(profile?.sizing_rate_per_kg, base.sizingRatePerKg),
    windingRatePerKg: finiteNumber(profile?.winding_rate_per_kg, base.windingRatePerKg),
    processingRatePerM: finiteNumber(profile?.default_processing_rate_per_m, base.processingRatePerM),
    finishingRatePerM: finiteNumber(profile?.default_finishing_rate_per_m, base.finishingRatePerM),
    overheadPct: finiteNumber(profile?.overhead_pct, base.overheadPct),
    commissionPct: finiteNumber(profile?.default_commission_pct, base.commissionPct),
    transportPerM: finiteNumber(profile?.default_transport_per_m, base.transportPerM),
    enabledSections: { ...base.enabledSections, ...(profile?.enabled_sections ?? {}) },
    monthlyOutputM: finiteNumber(profile?.monthly_output_m, base.monthlyOutputM),
    overheadOverridePerM: nullableFiniteNumber(profile?.overhead_override_per_m, base.overheadOverridePerM),
    loomCount: finiteNumber(profile?.loom_count, base.loomCount),
    monthlyWorkingDays: finiteNumber(profile?.monthly_working_days, base.monthlyWorkingDays),
    avgOutputPerLoomPerDay: finiteNumber(profile?.avg_output_per_loom_per_day, base.avgOutputPerLoomPerDay),
    yarnShortagePct: finiteNumber(profile?.yarn_shortage_pct, base.yarnShortagePct),
    warpCrimpPct: finiteNumber(profile?.warp_crimp_pct, base.warpCrimpPct),
    isConfigured: profile?.is_configured ?? base.isConfigured,
  }

  if (Array.isArray(profile?.overhead_items) && profile.overhead_items.length > 0) {
    state = { ...state, overheadItems: ensureOverheadIntegrity(profile.overhead_items) }
  } else if (fixedWorkers.length > 0) {
    state = {
      ...state,
      overheadItems: [
        ...state.overheadItems,
        ...ensureOverheadIntegrity(fixedWorkers.map(worker => ({
          id: `fw-${worker.id}`,
          label: `${worker.name} (${worker.role})`,
          monthlyAmount: Number(worker.monthly_salary),
          source: 'fixed_worker_derived',
          workerId: worker.id,
          category: 'custom',
          isPreset: false,
          isLocked: false,
        }))),
      ],
    }
  }

  const fallbackRate = recipe.default_yarn_rate
  const warpRows = normalizeSavedWarpRows(recipe.warp_rows, state.warpRows[0], {
    beamEnds: recipe.beam_ends,
    warpDenier: recipe.calculated_yarn_denier ?? recipe.yarn_denier,
    yarnRate: fallbackRate,
  })
  const weftRows = normalizeSavedWeftRows(recipe.weft_rows, state.weftRows[0], {
    picks: recipe.ppi,
    reedSpace: recipe.reed_space,
    weftDenier: recipe.weft_denier,
    yarnRate: fallbackRate,
  })

  return {
    ...state,
    warpRows,
    weftRows,
    tapeLengthM: finiteNumber(recipe.tape_length_m, state.tapeLengthM),
    warpCrimpPct: finiteNumber(recipe.warp_crimp_pct, state.warpCrimpPct),
    perPickCostPaisa: finiteNumber(recipe.per_pick_cost_paise, state.perPickCostPaisa),
    yarnShortagePct: finiteNumber(recipe.yarn_shortage_pct, state.yarnShortagePct),
    overheadOverridePerM: nullableFiniteNumber(recipe.overhead_override_per_m, state.overheadOverridePerM),
    loomType: recipe.loom_type ?? null,
    loomRpm: nullableFiniteNumber(recipe.loom_rpm, null),
    loomPowerKw: nullableFiniteNumber(recipe.loom_power_kw, null),
    loomRpmIsCustomised: false,
    loomPowerKwIsCustomised: false,
    sizingMode: recipe.sizing_mode ?? 'in_house',
    hoursPerShift: nullableFiniteNumber(recipe.hours_per_shift, state.hoursPerShift),
  }
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
