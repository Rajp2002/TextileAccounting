import {
  ensureOverheadIntegrity,
  makeDefaultEstimateState,
  normalizeCurrencySnapshot,
  parseCostingResultSnapshot,
  type CostingResultSnapshot,
  type EstimatorYarnLayerAudit,
  type FactorySections,
  type OverheadMode,
  type LoomType,
  type WarpRow,
  type WeftRow,
} from './estimator'

export type SavedCostingSort = 'recent' | 'oldest' | 'margin_desc' | 'cost_asc'
export type SavedCostingMarginFilter = 'all' | 'negative' | 'under_10' | '10_to_20' | 'over_20'

export function isSavedCostingArchived(
  record: { is_archived?: boolean | null },
  template?: { is_active?: boolean | null } | null,
) {
  return Boolean(record.is_archived) || template?.is_active === false
}

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
  quotation_reference?: string | null
  record_kind?: string | null
  status?: string | null
  is_archived?: boolean
  is_favorite?: boolean
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
  /** Immutable technical recipe captured with the costing. */
  warp_rows?: unknown
  weft_rows?: unknown
  snapshot_data?: unknown
  yarn_shortage_pct?: unknown
  warp_crimp_pct?: unknown
  overhead_mode?: string | null
  overhead_override_per_m?: unknown
  reconciliation_status?: string | null
  reconciliation_note?: string | null
}

type ComparisonOrderingItem = Pick<SavedCostingListItem, 'id' | 'created_at'> & {
  version_number?: number | null
}

/**
 * Put two immutable snapshots into a stable Old → New order before the
 * comparison engine is called. The engine intentionally keeps its left/right
 * contract; the UI owns the meaning of those columns.
 */
export function orderSavedCostingsForComparison<T extends ComparisonOrderingItem>(costings: T[]): T[] {
  return [...costings].sort((left, right) => (
    Date.parse(left.created_at) - Date.parse(right.created_at)
    || Number(left.version_number ?? 1) - Number(right.version_number ?? 1)
    || left.id.localeCompare(right.id)
  ))
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
  warping_mode?: 'in_house' | 'outsourced' | null
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

/**
 * The latest costing inputs used when a Base Saved Quality is reopened.
 *
 * Saved qualities keep the live recipe and current yarn-rate rows in
 * estimator_templates. The linked costing snapshot is the durable source for
 * the other inputs that make a repeat costing comparable: overhead basis,
 * commercial terms, quantity, and optional-section enablement.
 */
export type SavedQualityCostingReuse = Partial<{
  updated_at: string | null
  warping_rate_per_kg: unknown
  sizing_rate_per_kg: unknown
  winding_rate_per_kg: unknown
  processing_rate_per_m: unknown
  finishing_rate_per_m: unknown
  overhead_items: unknown[] | null
  monthly_output_m: unknown
  overhead_override_per_m: unknown
  overhead_mode: OverheadMode | null
  commission_pct: unknown
  transport_per_m: unknown
  profit_margin_pct: unknown
  order_quantity_m: unknown
  enabled_sections: unknown
  loom_count: unknown
  monthly_working_days: unknown
  avg_output_per_loom_per_day: unknown
}>

export type SavedQualityFixedWorker = {
  id: number
  name: string
  role: string
  monthly_salary: number
}

function finiteOrFallback(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function nullableFiniteOrFallback(value: unknown, fallback: number | null): number | null {
  if (value === null) return null
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeSavedSections(value: unknown, fallback: FactorySections): FactorySections {
  const raw = asRecord(value)
  return {
    winding: typeof raw.winding === 'boolean' ? raw.winding : fallback.winding,
    processing: typeof raw.processing === 'boolean' ? raw.processing : fallback.processing,
    finishing: typeof raw.finishing === 'boolean' ? raw.finishing : fallback.finishing,
    commission: typeof raw.commission === 'boolean' ? raw.commission : fallback.commission,
    transport: typeof raw.transport === 'boolean' ? raw.transport : fallback.transport,
  }
}

/**
 * Restore the non-recipe inputs of a saved costing onto the current factory
 * baseline. The caller applies the Saved Quality's current recipe afterward,
 * so a Rate Book change remains visible while the commercial/overhead context
 * stays comparable to the saved costing.
 */
export function restoreSavedQualityCostingAssumptions(
  state: ReturnType<typeof makeDefaultEstimateState>,
  reuse: SavedQualityCostingReuse | null | undefined,
) {
  if (!reuse) return state

  const directOverheadValue = nullableFiniteOrFallback(
    reuse.overhead_override_per_m,
    state.overheadOverridePerM,
  )
  const overheadMode = reuse.overhead_mode === 'direct' || reuse.overhead_mode === 'monthly_expenses'
    ? reuse.overhead_mode
    : reuse.overhead_override_per_m !== undefined
      ? directOverheadValue !== null ? 'direct' : 'monthly_expenses'
      : state.overheadMode

  return {
    ...state,
    warpingRatePerKg: finiteOrFallback(reuse.warping_rate_per_kg, state.warpingRatePerKg),
    sizingRatePerKg: finiteOrFallback(reuse.sizing_rate_per_kg, state.sizingRatePerKg),
    windingRatePerKg: finiteOrFallback(reuse.winding_rate_per_kg, state.windingRatePerKg),
    processingRatePerM: finiteOrFallback(reuse.processing_rate_per_m, state.processingRatePerM),
    finishingRatePerM: finiteOrFallback(reuse.finishing_rate_per_m, state.finishingRatePerM),
    overheadItems: Array.isArray(reuse.overhead_items)
      ? ensureOverheadIntegrity(reuse.overhead_items)
      : state.overheadItems,
    monthlyOutputM: finiteOrFallback(reuse.monthly_output_m, state.monthlyOutputM),
    overheadOverridePerM: directOverheadValue,
    overheadMode,
    commissionPct: finiteOrFallback(reuse.commission_pct, state.commissionPct),
    transportPerM: finiteOrFallback(reuse.transport_per_m, state.transportPerM),
    profitPct: finiteOrFallback(reuse.profit_margin_pct, state.profitPct),
    orderQuantityM: reuse.order_quantity_m === undefined
      ? state.orderQuantityM
      : nullableFiniteOrFallback(reuse.order_quantity_m, state.orderQuantityM),
    enabledSections: normalizeSavedSections(reuse.enabled_sections, state.enabledSections),
    loomCount: finiteOrFallback(reuse.loom_count, state.loomCount),
    monthlyWorkingDays: finiteOrFallback(reuse.monthly_working_days, state.monthlyWorkingDays),
    avgOutputPerLoomPerDay: finiteOrFallback(reuse.avg_output_per_loom_per_day, state.avgOutputPerLoomPerDay),
  }
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
    warpingMode: recipe.warping_mode ?? 'in_house',
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
    favorites?: boolean
  },
) {
  const query = options.query.trim().toLocaleLowerCase('en-IN')
  return [...costings]
    .filter(costing => {
      const searchable = `${costing.quality_label ?? ''} ${costing.party_name ?? ''} ${costing.quotation_reference ?? ''} ${costing.record_kind ?? ''} ${costing.status ?? ''}`.toLocaleLowerCase('en-IN')
      const actualMargin = getSavedCostingMetrics(costing).actualMarginPct
      return (!query || searchable.includes(query))
        && (!options.favorites || costing.is_favorite === true)
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

export type SavedCostingIdentity = {
  groupId: string
  versionNumber: number
  label: string
}

/**
 * Give every saved costing a stable, owner-visible identity.  The group is the
 * lineage; the version is the immutable snapshot within that lineage.  Legacy
 * rows without a group remain addressable by their own id instead of being
 * silently merged with another quality.
 */
export function getSavedCostingIdentity(costing: VersionedSavedCostingListItem): SavedCostingIdentity {
  const groupId = costing.costing_group_id || costing.id
  const versionNumber = Math.max(1, Number(costing.version_number ?? 1) || 1)
  const shortGroupId = groupId.length > 12 ? groupId.slice(0, 8) : groupId
  const quality = costing.quality_label?.trim() || 'Untitled costing'
  return {
    groupId,
    versionNumber,
    label: `${quality} · group ${shortGroupId} · v${versionNumber}`,
  }
}

export type SavedCostingDelta = {
  left: number | null
  right: number | null
  delta: number | null
}

export type SavedCostingOverheadApplicability = {
  left: boolean
  right: boolean
}

export type SavedCostingLayerComparison = {
  changed: boolean
  left: Array<{
    name: string
    ratePerKg: number | null
    baseKgPer100m: number | null
    finalKgPer100m: number | null
    wastePct: number | null
    crimpPct: number | null
    effectiveCostingWidthInches: number | null
    baseCostPerM: number | null
    costPerM: number | null
  }>
  right: Array<{
    name: string
    ratePerKg: number | null
    baseKgPer100m: number | null
    finalKgPer100m: number | null
    wastePct: number | null
    crimpPct: number | null
    effectiveCostingWidthInches: number | null
    baseCostPerM: number | null
    costPerM: number | null
  }>
  costPerM: SavedCostingDelta
  baseCostPerM: SavedCostingDelta
  baseKgPer100m: SavedCostingDelta
  ratePerKg: SavedCostingDelta
  wastePct: SavedCostingDelta
  widthInches: SavedCostingDelta
}

export type SavedCostingCanonicalComparison = {
  comparable: boolean
  canonical: {
    leftAvailable: boolean
    rightAvailable: boolean
    sameSnapshotSchema: boolean
    sameCalculationVersion: boolean
    sameRoundingPolicy: boolean
    leftSnapshotSchemaVersion: number | null
    rightSnapshotSchemaVersion: number | null
    leftCalculationVersion: string | null
    rightCalculationVersion: string | null
    source: 'canonical_result' | 'saved_inputs' | 'unavailable'
    message: string | null
  }
  yarn: {
    changed: boolean
    warp: SavedCostingLayerComparison
    weft: SavedCostingLayerComparison
  }
  waste: {
    changed: boolean
    yarnShortagePct: SavedCostingDelta
    warpCrimpPct: SavedCostingDelta
    yarnAdjustmentCostPerM: SavedCostingDelta
  }
  overhead: {
    changed: boolean
    costDrivingChanged: boolean
    referenceChanged: boolean
    modeChanged: boolean
    mode: { left: string | null; right: string | null }
    perM: SavedCostingDelta
    monthlyExpenseTotal: SavedCostingDelta
    monthlyOutputM: SavedCostingDelta
    monthlyExpenseTotalUsedForCosting: SavedCostingOverheadApplicability
    monthlyOutputUsedForCosting: SavedCostingOverheadApplicability
  }
  commercial: {
    changed: boolean
    commissionPct: SavedCostingDelta
    transportPerM: SavedCostingDelta
  }
  margin: {
    changed: boolean
    targetPct: SavedCostingDelta
    actualPct: SavedCostingDelta
  }
  price: {
    changed: boolean
    productionCostPerM: SavedCostingDelta
    breakEvenPricePerM: SavedCostingDelta
    landedCostPerM: SavedCostingDelta
    sellingPricePerM: SavedCostingDelta
    expectedProfitPerM: SavedCostingDelta
  }
}

type SavedCostingAuditLayer = {
  name?: unknown
  label?: unknown
  yarnRate?: unknown
  ratePerKg?: unknown
  baseKgPer100mUsed?: unknown
  finalKgPer100m?: unknown
  wastePct?: unknown
  shortagePct?: unknown
  crimpPct?: unknown
  effectiveCostingWidthInches?: unknown
  effectiveCostingWidthCm?: unknown
  reedSpace?: unknown
  costPerMeter?: unknown
  baseCostPerMeter?: unknown
}

function numericOrNull(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function delta(left: unknown, right: unknown): SavedCostingDelta {
  const leftValue = numericOrNull(left)
  const rightValue = numericOrNull(right)
  return {
    left: leftValue,
    right: rightValue,
    delta: leftValue == null || rightValue == null ? null : normalizeCurrencySnapshot(rightValue - leftValue),
  }
}

function deltaChanged(value: SavedCostingDelta) {
  return value.delta != null && Math.abs(value.delta) > 0.0001
}

function readSavedRows(costing: SavedCostingListItem, key: 'warpRows' | 'weftRows') {
  const direct = key === 'warpRows' ? costing.warp_rows : costing.weft_rows
  if (Array.isArray(direct)) return direct as SavedCostingAuditLayer[]
  const snapshot = asRecord(costing.snapshot_data)
  return Array.isArray(snapshot[key]) ? snapshot[key] as SavedCostingAuditLayer[] : []
}

function layerSummaryFromAudit(layers: EstimatorYarnLayerAudit[] | undefined) {
  return (layers ?? []).map(layer => ({
    name: layer.name || 'Unnamed yarn',
    ratePerKg: numericOrNull(layer.ratePerKg),
    baseKgPer100m: numericOrNull(layer.baseKgPer100mUsed),
    finalKgPer100m: numericOrNull(layer.finalKgPer100m),
    wastePct: numericOrNull(layer.wastePct),
    crimpPct: numericOrNull(layer.crimpPct),
    effectiveCostingWidthInches: numericOrNull(layer.effectiveCostingWidthInches),
    baseCostPerM: numericOrNull(layer.baseCostPerMeter),
    costPerM: numericOrNull(layer.costPerMeter),
  }))
}

function layerSummaryFromSavedRows(rows: SavedCostingAuditLayer[]) {
  return rows.map(row => ({
    name: typeof (row.name ?? row.label) === 'string' && String(row.name ?? row.label).trim()
      ? String(row.name ?? row.label).trim()
      : 'Unnamed yarn',
    ratePerKg: numericOrNull(row.ratePerKg ?? row.yarnRate),
    baseKgPer100m: numericOrNull(row.baseKgPer100mUsed),
    finalKgPer100m: numericOrNull(row.finalKgPer100m),
    wastePct: numericOrNull(row.wastePct ?? row.shortagePct),
    crimpPct: numericOrNull(row.crimpPct),
    effectiveCostingWidthInches: numericOrNull(
      row.effectiveCostingWidthInches
        ?? (numericOrNull(row.effectiveCostingWidthCm) == null
          ? null
          : Number(row.effectiveCostingWidthCm) / 2.54)
        ?? (numericOrNull(row.reedSpace) == null
          ? null
          : Number(row.reedSpace) / 2.54),
    ),
    baseCostPerM: numericOrNull(row.baseCostPerMeter),
    costPerM: numericOrNull(row.costPerMeter),
  }))
}

function layerSignature(layers: SavedCostingLayerComparison['left']) {
  return JSON.stringify(layers.map(layer => ({
    name: layer.name.toLocaleLowerCase('en-IN'),
    ratePerKg: layer.ratePerKg,
    baseKgPer100m: layer.baseKgPer100m,
    finalKgPer100m: layer.finalKgPer100m,
    wastePct: layer.wastePct,
    crimpPct: layer.crimpPct,
    effectiveCostingWidthInches: layer.effectiveCostingWidthInches,
    baseCostPerM: layer.baseCostPerM,
    costPerM: layer.costPerM,
  })))
}

function buildLayerComparison(
  leftLayers: SavedCostingLayerComparison['left'],
  rightLayers: SavedCostingLayerComparison['right'],
  leftCost: unknown,
  rightCost: unknown,
): SavedCostingLayerComparison {
  const costPerM = delta(leftCost, rightCost)
  const sumBaseCost = (layers: SavedCostingLayerComparison['left'], fallback: unknown) => (
    layers.length > 0 && layers.every(layer => layer.baseCostPerM != null)
      ? layers.reduce((sum, layer) => sum + (layer.baseCostPerM ?? 0), 0)
      : fallback
  )
  const baseCostPerM = delta(sumBaseCost(leftLayers, leftCost), sumBaseCost(rightLayers, rightCost))
  const sumBaseKg = (layers: SavedCostingLayerComparison['left']) => (
    layers.length > 0 && layers.every(layer => layer.baseKgPer100m != null)
      ? layers.reduce((sum, layer) => sum + (layer.baseKgPer100m ?? 0), 0)
      : null
  )
  const baseKgPer100m = delta(sumBaseKg(leftLayers), sumBaseKg(rightLayers))
  const leftRate = leftLayers.length === 1 ? leftLayers[0].ratePerKg : null
  const rightRate = rightLayers.length === 1 ? rightLayers[0].ratePerKg : null
  const ratePerKg = delta(leftRate, rightRate)
  const leftWaste = leftLayers.length === 1 ? leftLayers[0].wastePct : null
  const rightWaste = rightLayers.length === 1 ? rightLayers[0].wastePct : null
  const wastePct = delta(leftWaste, rightWaste)
  const leftWidth = leftLayers.length === 1 ? leftLayers[0].effectiveCostingWidthInches : null
  const rightWidth = rightLayers.length === 1 ? rightLayers[0].effectiveCostingWidthInches : null
  const widthInches = delta(leftWidth, rightWidth)
  return {
    changed: layerSignature(leftLayers) !== layerSignature(rightLayers)
      || deltaChanged(costPerM)
      || deltaChanged(baseCostPerM)
      || deltaChanged(baseKgPer100m)
      || deltaChanged(wastePct)
      || deltaChanged(widthInches),
    left: leftLayers,
    right: rightLayers,
    costPerM,
    baseCostPerM,
    baseKgPer100m,
    ratePerKg,
    wastePct,
    widthInches,
  }
}

function getAuditForComparison(result: CostingResultSnapshot | null, costing: SavedCostingListItem, key: 'warp' | 'weft') {
  const auditLayers = result?.audit?.[key]?.layers
  if (auditLayers?.length) return layerSummaryFromAudit(auditLayers)
  return layerSummaryFromSavedRows(readSavedRows(costing, key === 'warp' ? 'warpRows' : 'weftRows'))
}

/**
 * Compare only persisted costing evidence.  The function never calls the
 * estimator engine, reads factory defaults, or looks at the current Rate Book.
 * That is the important boundary that keeps a historical comparison stable.
 */
export function compareSavedCostingSnapshots(
  left: SavedCostingListItem,
  right: SavedCostingListItem,
): SavedCostingCanonicalComparison {
  const leftResult = parseCostingResultSnapshot(left.costing_result_snapshot)
  const rightResult = parseCostingResultSnapshot(right.costing_result_snapshot)
  const leftAvailable = Boolean(leftResult)
  const rightAvailable = Boolean(rightResult)
  const sameSnapshotSchema = leftAvailable && rightAvailable
    ? (leftResult?.snapshotSchemaVersion ?? 1) === (rightResult?.snapshotSchemaVersion ?? 1)
    : false
  const sameCalculationVersion = leftAvailable && rightAvailable
    ? leftResult?.calculationVersion === rightResult?.calculationVersion
    : false
  const sameRoundingPolicy = leftAvailable && rightAvailable
    ? leftResult?.roundingPolicy === rightResult?.roundingPolicy
    : false
  const comparable = leftAvailable && rightAvailable && sameSnapshotSchema && sameCalculationVersion && sameRoundingPolicy
  const bothHaveAudit = Boolean(leftResult?.audit && rightResult?.audit)
  const source = !comparable
    ? 'unavailable'
    : bothHaveAudit
      ? 'canonical_result'
      : 'saved_inputs'
  const message = !leftAvailable || !rightAvailable
    ? 'Both costings need a verified canonical result before they can be compared.'
    : !sameSnapshotSchema || !sameCalculationVersion || !sameRoundingPolicy
      ? 'These costings use different canonical calculation or rounding versions. Save a new version before comparing them.'
      : null

  const leftWarp = getAuditForComparison(leftResult, left, 'warp')
  const rightWarp = getAuditForComparison(rightResult, right, 'warp')
  const leftWeft = getAuditForComparison(leftResult, left, 'weft')
  const rightWeft = getAuditForComparison(rightResult, right, 'weft')
  const yarn = {
    warp: buildLayerComparison(leftWarp, rightWarp, leftResult?.breakdown.warpCostPerM, rightResult?.breakdown.warpCostPerM),
    weft: buildLayerComparison(leftWeft, rightWeft, leftResult?.breakdown.weftCostPerM, rightResult?.breakdown.weftCostPerM),
  }

  const leftSnapshot = asRecord(left.snapshot_data)
  const rightSnapshot = asRecord(right.snapshot_data)
  const leftShortage = left.yarn_shortage_pct ?? leftSnapshot.yarnShortagePct
  const rightShortage = right.yarn_shortage_pct ?? rightSnapshot.yarnShortagePct
  const leftCrimp = left.warp_crimp_pct ?? leftSnapshot.warpCrimpPct
  const rightCrimp = right.warp_crimp_pct ?? rightSnapshot.warpCrimpPct
  const waste = {
    yarnShortagePct: delta(leftShortage, rightShortage),
    warpCrimpPct: delta(leftCrimp, rightCrimp),
    yarnAdjustmentCostPerM: delta(leftResult?.audit?.yarnAdjustmentCostPerMeter, rightResult?.audit?.yarnAdjustmentCostPerMeter),
  }

  const leftOverhead = leftResult?.assumptions?.overhead
  const rightOverhead = rightResult?.assumptions?.overhead
  const overheadModeLeft = leftResult?.overheadMode ?? leftOverhead?.mode ?? null
  const overheadModeRight = rightResult?.overheadMode ?? rightOverhead?.mode ?? null
  const monthlyExpenseTotalUsedForCosting = {
    left: overheadModeLeft === 'monthly_expenses',
    right: overheadModeRight === 'monthly_expenses',
  }
  const monthlyOutputUsedForCosting = {
    left: overheadModeLeft === 'monthly_expenses',
    right: overheadModeRight === 'monthly_expenses',
  }
  const overhead = {
    mode: { left: overheadModeLeft, right: overheadModeRight },
    modeChanged: overheadModeLeft !== overheadModeRight,
    perM: delta(leftResult?.overheadPerM, rightResult?.overheadPerM),
    monthlyExpenseTotal: delta(leftOverhead?.monthlyExpenseTotal, rightOverhead?.monthlyExpenseTotal),
    monthlyOutputM: delta(leftOverhead?.monthlyOutputM, rightOverhead?.monthlyOutputM),
    monthlyExpenseTotalUsedForCosting,
    monthlyOutputUsedForCosting,
  }

  const monthlyExpenseChanged = deltaChanged(overhead.monthlyExpenseTotal)
  const monthlyOutputChanged = deltaChanged(overhead.monthlyOutputM)
  const anyMonthlyExpenseUsedForCosting = monthlyExpenseTotalUsedForCosting.left
    || monthlyExpenseTotalUsedForCosting.right
  const anyMonthlyOutputUsedForCosting = monthlyOutputUsedForCosting.left
    || monthlyOutputUsedForCosting.right
  const costDrivingChanged = overhead.modeChanged
    || deltaChanged(overhead.perM)
    || (anyMonthlyExpenseUsedForCosting && monthlyExpenseChanged)
    || (anyMonthlyOutputUsedForCosting && monthlyOutputChanged)
  const referenceChanged = (!anyMonthlyExpenseUsedForCosting && monthlyExpenseChanged)
    || (!anyMonthlyOutputUsedForCosting && monthlyOutputChanged)

  const commercial = {
    commissionPct: delta(leftResult?.commissionPct, rightResult?.commissionPct),
    transportPerM: delta(leftResult?.transportPerM, rightResult?.transportPerM),
  }

  const margin = {
    targetPct: delta(leftResult?.targetMarginPct, rightResult?.targetMarginPct),
    actualPct: delta(leftResult?.actualMarginPct, rightResult?.actualMarginPct),
  }
  const price = {
    productionCostPerM: delta(leftResult?.productionCostPerM, rightResult?.productionCostPerM),
    breakEvenPricePerM: delta(leftResult?.breakEvenPricePerM, rightResult?.breakEvenPricePerM),
    landedCostPerM: delta(leftResult?.landedCostPerM, rightResult?.landedCostPerM),
    sellingPricePerM: delta(leftResult?.suggestedSellingPricePerM, rightResult?.suggestedSellingPricePerM),
    expectedProfitPerM: delta(leftResult?.profitPerM, rightResult?.profitPerM),
  }

  return {
    comparable,
    canonical: {
      leftAvailable,
      rightAvailable,
      sameSnapshotSchema,
      sameCalculationVersion,
      sameRoundingPolicy,
      leftSnapshotSchemaVersion: leftResult?.snapshotSchemaVersion ?? null,
      rightSnapshotSchemaVersion: rightResult?.snapshotSchemaVersion ?? null,
      leftCalculationVersion: leftResult?.calculationVersion ?? null,
      rightCalculationVersion: rightResult?.calculationVersion ?? null,
      source,
      message,
    },
    yarn: {
      ...yarn,
      changed: yarn.warp.changed || yarn.weft.changed,
    },
    waste: {
      ...waste,
      changed: deltaChanged(waste.yarnShortagePct)
        || deltaChanged(waste.warpCrimpPct)
        || deltaChanged(waste.yarnAdjustmentCostPerM),
    },
    overhead: {
      ...overhead,
      costDrivingChanged,
      referenceChanged,
      changed: overhead.modeChanged
        || deltaChanged(overhead.perM)
        || monthlyExpenseChanged
        || monthlyOutputChanged,
    },
    commercial: {
      ...commercial,
      changed: deltaChanged(commercial.commissionPct) || deltaChanged(commercial.transportPerM),
    },
    margin: {
      ...margin,
      changed: deltaChanged(margin.targetPct) || deltaChanged(margin.actualPct),
    },
    price: {
      ...price,
      changed: Object.values(price).some(deltaChanged),
    },
  }
}
