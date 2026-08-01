import {
  ensureOverheadIntegrity,
  makeDefaultEstimateState,
  normalizeCurrencySnapshot,
  parseCostingResultSnapshot,
  type FactorySections,
  type OverheadMode,
  type LoomType,
  type WarpRow,
  type WeftRow,
} from './estimator'

export type SavedCostingSort = 'recent' | 'oldest' | 'margin_desc' | 'cost_asc'
export type SavedCostingMarginFilter = 'all' | 'negative' | 'under_10' | '10_to_20' | 'over_20'

export type SavedCostingListItem = {
  id: string
  party_name: string | null
  quality_label: string | null
  quote_price_per_meter: number
  landed_cost_per_meter: number
  intended_margin_percent: number
  meters: number
  created_at: string
  updated_at: string
  calculation_version?: string | null
  rounding_policy?: string | null
  production_cost_per_meter?: number | null
  overhead_per_meter?: number | null
  commission_cost_per_meter?: number | null
  break_even_price_per_meter?: number | null
  expected_profit_per_meter?: number | null
  expected_profit_total?: number | null
  actual_margin_percent?: number | null
  costing_result_snapshot?: unknown
  reconciliation_status?: string | null
  reconciliation_note?: string | null
}

export type SavedCostingMetrics = {
  productionCostPerM: number | null
  breakEvenPricePerM: number | null
  landedCostPerM: number | null
  suggestedSellingPricePerM: number | null
  targetMarginPct: number | null
  actualMarginPct: number | null
  expectedProfitPerM: number | null
  expectedProfitTotal: number | null
  status: string
}

function finiteOrNull(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function legacyPositiveMetricOrNull(value: unknown): number | null {
  const parsed = finiteOrNull(value)
  // Older rows used zero as a placeholder when the canonical costing result
  // was not stored. A zero production or break-even price is not a trustworthy
  // historical result for a saved grey-fabric costing, so keep it unavailable
  // rather than showing a false ₹0.00/m value.
  return parsed != null && parsed > 0 ? parsed : null
}

/**
 * Read the immutable financial snapshot first. Legacy rows deliberately do
 * not fall back to recalculating today's recipe; missing derived values remain
 * visibly unavailable instead of being presented as verified history.
 */
export function getSavedCostingMetrics(costing: SavedCostingListItem): SavedCostingMetrics {
  const snapshot = parseCostingResultSnapshot(costing.costing_result_snapshot)
  if (snapshot) {
    return {
      productionCostPerM: snapshot.productionCostPerM,
      breakEvenPricePerM: snapshot.breakEvenPricePerM,
      landedCostPerM: snapshot.landedCostPerM,
      suggestedSellingPricePerM: snapshot.suggestedSellingPricePerM,
      targetMarginPct: snapshot.targetMarginPct,
      actualMarginPct: snapshot.actualMarginPct,
      expectedProfitPerM: snapshot.profitPerM,
      expectedProfitTotal: snapshot.expectedProfitTotal,
      status: costing.reconciliation_status ?? 'verified',
    }
  }

  const landedCostPerM = legacyPositiveMetricOrNull(costing.landed_cost_per_meter)
  const suggestedSellingPricePerM = finiteOrNull(costing.quote_price_per_meter)
  const quantityM = finiteOrNull(costing.meters)
  const expectedProfitPerM = landedCostPerM != null && suggestedSellingPricePerM != null
    ? normalizeCurrencySnapshot(suggestedSellingPricePerM - landedCostPerM)
    : null
  const expectedProfitTotal = expectedProfitPerM == null || quantityM == null || quantityM <= 0
    ? null
    : normalizeCurrencySnapshot(expectedProfitPerM * quantityM)
  const actualMarginPct = suggestedSellingPricePerM != null
    && suggestedSellingPricePerM > 0
    && expectedProfitPerM != null
    ? normalizeCurrencySnapshot((expectedProfitPerM / suggestedSellingPricePerM) * 100)
    : null
  return {
    productionCostPerM: legacyPositiveMetricOrNull(costing.production_cost_per_meter),
    breakEvenPricePerM: legacyPositiveMetricOrNull(costing.break_even_price_per_meter),
    landedCostPerM,
    suggestedSellingPricePerM,
    targetMarginPct: finiteOrNull(costing.intended_margin_percent),
    actualMarginPct: legacyPositiveMetricOrNull(costing.production_cost_per_meter) == null
      ? null
      : finiteOrNull(costing.actual_margin_percent) ?? actualMarginPct,
    expectedProfitPerM,
    expectedProfitTotal: finiteOrNull(costing.expected_profit_total) ?? expectedProfitTotal,
    status: costing.reconciliation_status ?? 'legacy',
  }
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
  overhead_mode: OverheadMode
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
    overheadPct: 0,
    commissionPct: finiteNumber(profile?.default_commission_pct, base.commissionPct),
    transportPerM: finiteNumber(profile?.default_transport_per_m, base.transportPerM),
    enabledSections: { ...base.enabledSections, ...(profile?.enabled_sections ?? {}) },
    monthlyOutputM: finiteNumber(profile?.monthly_output_m, base.monthlyOutputM),
    overheadOverridePerM: nullableFiniteNumber(profile?.overhead_override_per_m, base.overheadOverridePerM),
    overheadMode: (profile?.overhead_mode === 'direct'
      || (profile?.overhead_mode == null && profile?.overhead_override_per_m != null)
      ? 'direct'
      : 'monthly_expenses') as OverheadMode,
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
    overheadMode: recipe.overhead_override_per_m != null ? 'direct' : state.overheadMode,
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
      const searchable = `${costing.quality_label ?? ''} ${costing.party_name ?? ''}`.toLocaleLowerCase('en-IN')
      const actualMargin = getSavedCostingMetrics(costing).actualMarginPct
      return (!query || searchable.includes(query))
        && (options.margin === 'all' || (actualMargin != null && matchesMargin(actualMargin, options.margin)))
    })
    .sort((left, right) => {
      if (options.sort === 'oldest') return Date.parse(left.updated_at) - Date.parse(right.updated_at)
      if (options.sort === 'margin_desc') {
        const leftMargin = getSavedCostingMetrics(left).actualMarginPct
        const rightMargin = getSavedCostingMetrics(right).actualMarginPct
        return (rightMargin ?? Number.NEGATIVE_INFINITY) - (leftMargin ?? Number.NEGATIVE_INFINITY)
      }
      if (options.sort === 'cost_asc') {
        const leftCost = getSavedCostingMetrics(left).productionCostPerM ?? getSavedCostingMetrics(left).landedCostPerM
        const rightCost = getSavedCostingMetrics(right).productionCostPerM ?? getSavedCostingMetrics(right).landedCostPerM
        return (leftCost ?? Number.POSITIVE_INFINITY) - (rightCost ?? Number.POSITIVE_INFINITY)
      }
      return Date.parse(right.updated_at) - Date.parse(left.updated_at)
    })
}

export function compareSavedCostings(left: SavedCostingListItem, right: SavedCostingListItem) {
  const leftMetrics = getSavedCostingMetrics(left)
  const rightMetrics = getSavedCostingMetrics(right)
  const numericOrNull = (value: unknown) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const delta = (leftValue: unknown, rightValue: unknown) => {
    const leftNumber = numericOrNull(leftValue)
    const rightNumber = numericOrNull(rightValue)
    return leftNumber == null || rightNumber == null ? null : rightNumber - leftNumber
  }
  return {
    productionCostDelta: delta(leftMetrics.productionCostPerM, rightMetrics.productionCostPerM),
    breakEvenDelta: delta(leftMetrics.breakEvenPricePerM, rightMetrics.breakEvenPricePerM),
    landedCostDelta: delta(leftMetrics.landedCostPerM, rightMetrics.landedCostPerM),
    sellingPriceDelta: delta(leftMetrics.suggestedSellingPricePerM, rightMetrics.suggestedSellingPricePerM),
    marginDelta: delta(leftMetrics.actualMarginPct, rightMetrics.actualMarginPct),
    expectedProfitDelta: delta(leftMetrics.expectedProfitTotal, rightMetrics.expectedProfitTotal),
    quantityDelta: delta(left.meters, right.meters),
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
  const currentMetrics = getSavedCostingMetrics(current)
  const previousMetrics = getSavedCostingMetrics(previous)
  return currentMetrics.productionCostPerM != null && previousMetrics.productionCostPerM != null
    ? currentMetrics.productionCostPerM - previousMetrics.productionCostPerM
    : null
}
