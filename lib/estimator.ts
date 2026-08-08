/**
 * lib/estimator.ts — Weavly Estimator V3 (Clean Break)
 *
 * Complete rewrite. All V1 code (calculateLandedCost, runStressTests,
 * DEFAULT_ESTIMATOR_INPUTS) has been removed. calcFullTotals is the
 * only math engine in this file.
 *
 * COST STACK (per metre of finished fabric):
 *   Layer 1: Warp yarn     = Σ (beamEnds × calcDenier × (1 + warpCrimpPct/100 + waste%) × rate × GST)
 *             ↑ warpCrimpPct accounts for warp take-up only: 6% crimp → 1.06m warp yarn per 1m cloth
 *   Layer 2: Weft yarn     = Σ (picks × reedSpace × calcDenier × rate × GST × shortage)
 *   Layer 3: Weave cost    = picks(PPI) × perPickCostPaisa
 *   Layer 4: Warping+Sizing= totalWarpKg × (warpingRate + sizingRate) / 100
 *   Layer 5: Winding       = totalAllYarnKg × windingRate / 100  [optional]
 *   Layer 6: Processing    = processingRatePerM  [optional, flat ₹/m]
 *   Layer 7: Finishing     = finishingRatePerM   [optional, flat ₹/m]
 *            directCost    = Layers 1–7
 *   Layer 8: Overhead      = explicit direct ₹/m rate OR
 *              Σ(overheadItems[i].monthlyAmount) / monthlyOutputM
 *              (the selected method is preserved in the costing snapshot)
 *   ─────────────────────────────────────────────────────
 *   totalProductionCostPerM = directCost + overhead
 *
 * ORDER QUOTE (commission and margin are percentages of selling price):
 *   quotePricePerM = (productionCostPerM + transportPerM)
 *                    ÷ (1 - commissionPct/100 - profitMarginPct/100)
 *   landedCostPerM = productionCostPerM + transportPerM
 *                    + (quotePricePerM × commissionPct/100)
 */

import { nanoid } from 'nanoid'
import Decimal from 'decimal.js'

// ─────────────────────────────────────────────────────────────────────────────
// LOOM TYPE REGISTRY — Single source of truth for all loom class defaults
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical defaults per loom type.
 * rpm / powerKw / efficiencyPct are the starting values auto-filled when the
 * owner selects a loom type. All three remain editable per-estimate.
 *
 * Reference values (Surat industry averages, verified):
 *   Water Jet   — 600–750 RPM synthetic-only (used 700 as midpoint)
 *   Air Jet     — up to 1,200 RPM high-speed (used 900 conservative)
 *   Rapier      — 300–600 RPM versatile (used 450)
 *   Jacquard E  — 200–300 RPM electronic head (used 250)
 *   Jacquard M  — 100–150 RPM older mechanical (used 130)
 *   Projectile  — 200–350 RPM heavy yarns (used 280)
 *   Dobby       — 400–600 RPM limited pattern (used 500)
 */
export const LOOM_TYPE_DEFAULTS = {
  water_jet:           { label: 'Water Jet',             rpm: 700, powerKw: 2.5, efficiencyPct: 85 },
  rapier:              { label: 'Rapier',                rpm: 450, powerKw: 4.0, efficiencyPct: 82 },
  air_jet:             { label: 'Air Jet',               rpm: 900, powerKw: 6.5, efficiencyPct: 85 },
  jacquard_electronic: { label: 'Jacquard (Electronic)', rpm: 250, powerKw: 3.5, efficiencyPct: 78 },
  jacquard_mechanical: { label: 'Jacquard (Mechanical)', rpm: 130, powerKw: 2.5, efficiencyPct: 75 },
  projectile:          { label: 'Projectile',            rpm: 280, powerKw: 3.5, efficiencyPct: 82 },
  dobby:               { label: 'Dobby',                 rpm: 500, powerKw: 3.0, efficiencyPct: 83 },
  other:               { label: 'Other / Manual',        rpm: null, powerKw: null, efficiencyPct: null },
} as const

export type LoomType = keyof typeof LOOM_TYPE_DEFAULTS
export type YarnCalculationMode = 'formula' | 'manual'
export type YarnLinearDensityUnit = 'denier' | 'cotton_count_ne'
export type WidthUnit = 'cm' | 'inch'
export type CostingWasteSource = 'default' | 'row_override' | 'unknown'

/**
 * English cotton count (Ne) is an indirect system: higher counts are finer.
 * The Government of India textile-training conversion is D = 5315 / Ne.
 * Keep this conversion centralized so client previews, server persistence, and
 * audit snapshots all use the same effective linear density.
 */
const COTTON_COUNT_DENIER_FACTOR = new Decimal(5315)

export function cottonCountNeToDenier(countNe: number): number {
  const count = new Decimal(Number(countNe) || 0)
  return count.gt(0) ? COTTON_COUNT_DENIER_FACTOR.div(count).toNumber() : 0
}

export function denierToCottonCountNe(denier: number): number {
  const density = new Decimal(Number(denier) || 0)
  return density.gt(0) ? COTTON_COUNT_DENIER_FACTOR.div(density).toNumber() : 0
}

// Configure Decimal for financial calculations — matches lib/finance.ts
// 20-digit precision is hardened for textile manufacturing land-cost analysis
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

/**
 * Version and rounding identifiers are persisted with every new financial
 * snapshot.  A saved costing must remain explainable after the calculator
 * evolves, so these are deliberately explicit rather than inferred from the
 * row creation date.
 */
export const COSTING_CALCULATION_VERSION = 'estimator_v3_2026_08'
export const COSTING_ROUNDING_POLICY = 'INR_HALF_UP_2'

export type CostingReconciliationStatus =
  | 'verified'
  | 'legacy'
  | 'needs_review'
  | 'unreconstructable'
  | 'unreviewed'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** One component of a blended warp (e.g. "3444 ends of 75D main + 84 ends of selvedge") */
export interface WarpRow {
  id: string
  label?: string        // optional display label e.g. "Main", "Selvedge"
  calculationMode?: YarnCalculationMode // formula by default; manual bypasses formula kg
  manualKgPer100m?: number | null // base kg/100m before waste/crimp when mode is manual
  linearDensityUnit?: YarnLinearDensityUnit // legacy rows default to denier
  cottonCountNe?: number | null // English cotton count when unit is cotton_count_ne
  calcDenier: number    // effective total denier; for plied yarn, include every ply
  beamEnds: number      // ends for THIS row only — discrete per component
  yarnRate: number      // ₹/kg market rate for this yarn
  gstPct: number        // GST % on this specific yarn (different materials = different brackets)
  shortagePct: number | null // shortage/wastage % for this component (null = global fallback, 0 = intentional zero)
}

/** One weft component (fabrics can have multi-pick weft blends) */
export interface WeftRow {
  id: string
  label?: string
  calculationMode?: YarnCalculationMode
  manualKgPer100m?: number | null
  picks: number         // picks per inch (PPI) — industry standard in Surat
  reedSpace: number     // legacy effective costing width in cm; use effectiveCostingWidthCm when present
  effectiveCostingWidthCm?: number | null // loom/costing width in cm; used for weft formula
  linearDensityUnit?: YarnLinearDensityUnit
  cottonCountNe?: number | null
  calcDenier: number    // effective weft yarn denier
  yarnRate: number      // ₹/kg
  gstPct: number
  shortagePct: number | null
}

export function getEffectiveYarnDenier(
  row: Pick<WarpRow | WeftRow, 'linearDensityUnit' | 'cottonCountNe' | 'calcDenier'>
): number {
  return row.linearDensityUnit === 'cotton_count_ne'
    ? cottonCountNeToDenier(Number(row.cottonCountNe ?? 0))
    : Number(row.calcDenier ?? 0)
}

export function normalizeCurrencySnapshot(value: unknown, scale = 2): number {
  try {
    const decimal = new Decimal(value as Decimal.Value)
    if (!decimal.isFinite()) return 0
    return decimal.toDecimalPlaces(scale, Decimal.ROUND_HALF_UP).toNumber()
  } catch {
    return 0
  }
}

export function calcWorkerRateSnapshot(
  weftRows: Pick<WeftRow, 'picks'>[],
  perPickCostPaisa: number
): number {
  const totalPicks = weftRows.reduce(
    (sum, row) => sum.plus(Number(row.picks ?? 0)),
    new Decimal(0)
  )
  return normalizeCurrencySnapshot(totalPicks.times(perPickCostPaisa).toString())
}

/**
 * Convert a direct weaving charge per metre into the internal ₹/pick value.
 * The estimator stores the per-pick value in rupees for backward compatibility,
 * while the UI exposes the equivalent value in paise when that mode is chosen.
 */
export function calcPerPickCostFromWeavingRate(weavingRatePerM: number, totalPicks: number): number {
  const rate = Number(weavingRatePerM)
  const picks = Number(totalPicks)
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(picks) || picks <= 0) return 0
  return Math.round((rate / picks) * 10000) / 10000
}

/** Which optional cost sections apply to this factory/estimate */
export interface FactorySections {
  winding:    boolean   // yarn arrives on hanks, needs rewinding onto cones
  processing: boolean   // dyeing / printing
  finishing:  boolean   // calendering, heat-setting
  commission: boolean   // broker/agent involvement
  transport:  boolean   // factory delivers rather than buyer collecting
}

export type OverheadCategory =
  | 'rent'
  | 'electricity'
  | 'spares_repairs'
  | 'oil_lubricants'
  | 'drawing_denting'
  | 'bank_interest'
  | 'depreciation'
  | 'water'
  | 'security'
  | 'admin'
  | 'custom'

/** How the factory recovers fixed overhead in a costing. */
export type OverheadMode = 'direct' | 'monthly_expenses'

/** Helper metadata for specialized overhead categories */
export interface ElectricityMeta {
  type: 'electricity'
  mode: 'manual' | 'per_loom'
  unitsPerLoomPerMonth?: number
  ratePerUnit?: number
}

export interface DepreciationMeta {
  type: 'depreciation'
  loomCount?: number
  avgCostPerLoom: number
  usefulLifeYears: number
}

export type OverheadItemMeta = ElectricityMeta | DepreciationMeta

/**
 * A single overhead line item — represents one monthly fixed cost.
 * category: enables specialized resolvers (electricity, depreciation)
 * isPreset: true for standard Surat factory cost items
 * isLocked: true when the monthlyAmount is auto-computed from meta
 */
export interface OverheadItem {
  id:           string
  category:     OverheadCategory
  label:        string        // e.g. "Rent", "Electricity", "Raju (Master)"
  monthlyAmount: number       // ₹ per month
  isPreset:     boolean
  isLocked:     boolean
  meta?:        OverheadItemMeta
  source:       'manual' | 'fixed_worker_derived'
  workerId?:    number        // fixed_workers.id — present only for derived items
}

type OverheadItemInput = Partial<OverheadItem> & {
  meta?: OverheadItemMeta
}

/** Complete client-side estimate state (what the estimator page manages) */
export interface EstimateState {
  warpRows:            WarpRow[]
  weftRows:            WeftRow[]
  tapeLengthM:         number          // metres per beam tape (for beam capacity preview)
  perPickCostPaisa:    number          // legacy name; internal ₹/pick (0.16 = 16 paise)
  warpingRatePerKg:    number          // ₹/kg charged by warping unit
  sizingRatePerKg:     number          // ₹/kg charged by sizing unit (only used when sizingMode === 'outsourced')
  windingRatePerKg:    number          // ₹/kg charged for rewinding (0 if not applicable)
  processingRatePerM:  number          // flat ₹/m for dyeing/printing
  finishingRatePerM:   number          // flat ₹/m for calendering/heat-setting
  // ── Yarn shortage — applied to combined warp+weft total ──────────────────
  yarnShortagePct:     number          // single shortage % applied after summing all yarn costs
  warpCrimpPct:        number          // warp take-up % for accurate beam capacity calculation
  // ── Overhead V2: itemized breakdown ─────────────────────────────────────
  overheadItems:       OverheadItem[]  // list of monthly fixed cost line items
  monthlyOutputM:      number          // estimated metres produced per month (denominator)
  overheadOverridePerM: number | null  // direct ₹/m rate when overheadMode is direct
  overheadMode:         OverheadMode    // persisted factory method
  // ── Factory Capacity Configuration ──────────────────────────────────────
  loomCount:           number          // total active looms in factory
  avgOutputPerLoomPerDay: number       // e.g. 50m for waterjets, 25m for rapier
  monthlyWorkingDays:  number          // default 26
  outputSuggestion?: {
    avg30Days: number
    avg90Days: number
    lastUpdated: string
  }
  // ── Loom Type (Estimator-side costing input — independent of machine assignment) ─
  loomType:              LoomType | null  // null = not yet selected
  loomRpm:               number | null   // auto-filled from loom type; editable
  loomPowerKw:           number | null   // auto-filled from loom type; editable
  loomRpmIsCustomised:   boolean         // true when owner has manually overridden the default RPM
  loomPowerKwIsCustomised: boolean       // true when owner has manually overridden the default kW
  hoursPerShift:         number | null   // factory shift hours — drives daily output preview (default 12)
  // ── Sizing Mode ─────────────────────────────────────────────────────────
  sizingMode:            'in_house' | 'outsourced'  // explicit toggle; in_house = 0 cost
  // ── kept for backward-compat serialisation (computed, never user-edited) ─
  // Existing snapshots may still contain this legacy value. It is not a
  // user-facing setting and is no longer read as a costing input.
  overheadPct:         number
  // ────────────────────────────────────────────────────────────────────────
  commissionPct:       number          // selling commission %
  transportPerM:       number          // transport cost ₹/m
  profitPct:           number          // desired profit margin %
  orderQuantityM:      number | null   // null = order module not yet activated
  enabledSections:     FactorySections
  isConfigured:        boolean
}

/** Warp row after formula has been applied */
export interface WarpRowResult extends WarpRow {
  mode: YarnCalculationMode
  formulaKgPer100m: number
  baseKgPer100mUsed: number
  crimpPct: number
  wastePct: number
  defaultWastePct: number
  wastePctSource: CostingWasteSource
  totalAdjustmentPct: number
  finalKgPer100m: number
  ratePerKg: number
  costPerMeter: number
  kgPer100m:        number   // final yarn kg per 100m of fabric after adjustment
  costPer100m:      number   // ₹ per 100m (GST + adjustment inclusive)
  shortagePctUsed:  number   // effective waste % applied (row-level or global fallback)
  shortageCostPer100m: number // rupee contribution of waste/crimp adjustment for this row
}

/** Weft row after formula has been applied */
export interface WeftRowResult extends WeftRow {
  mode: YarnCalculationMode
  formulaKgPer100m: number
  baseKgPer100mUsed: number
  crimpPct: number
  wastePct: number
  defaultWastePct: number
  wastePctSource: CostingWasteSource
  totalAdjustmentPct: number
  finalKgPer100m: number
  ratePerKg: number
  costPerMeter: number
  effectiveCostingWidthInches: number
  kgPer100m:        number
  costPer100m:      number
  shortagePctUsed:  number
  shortageCostPer100m: number
}

export interface EstimatorYarnLayerAudit {
  id: string
  name: string
  mode: YarnCalculationMode
  formulaDescription: string
  calcDenier: number
  beamEnds: number | null
  picks: number | null
  effectiveCostingWidthInches: number | null
  formulaKgPer100m: number
  manualKgPer100m: number | null
  baseKgPer100mUsed: number
  crimpPct: number
  wastePct: number
  defaultWastePct: number
  wastePctSource: CostingWasteSource
  totalAdjustmentPct: number
  finalKgPer100m: number
  ratePerKg: number
  gstPct: number
  costPerMeter: number
}

export interface EstimatorCostAudit {
  warp: {
    layers: EstimatorYarnLayerAudit[]
    totalCostPerMeter: number
  }
  weft: {
    layers: EstimatorYarnLayerAudit[]
    totalCostPerMeter: number
  }
  yarnBaseCostPerMeter: number
  yarnAdjustmentCostPerMeter: number
  yarnTotalCostPerMeter: number
  weaveCostPerMeter: number
  warpingAndSizingCostPerMeter: number
  overheadCostPerMeter: number
  postProcessingCostPerMeter: number
  logisticsCostPerMeter: number
  directCostPerMeter: number
  productionCostPerMeter: number
}

/** Output of calcOrderQuote when order quantity is known */
export interface OrderQuote {
  landedCostPerM:     number   // production cost + commission % + transport
  quotePricePerM:     number   // what the owner tells the buyer
  totalOrderValue:    number   // quotePricePerM × orderQuantityM
  grossProfitRupees:  number   // totalOrderValue − landed cost × qty
  actualMarginPct:    number   // gross profit as % of total order value
  isValid?:           boolean  // dynamic boundary validation
  errorMessage?:      string   // dynamic boundary validation error message
}

/** Complete derived totals from calcFullTotals */
export interface EstimatorV3Totals {
  warpRows:                WarpRowResult[]
  weftRows:                WeftRowResult[]
  warpCostPerM:            number   // includes per-row shortage
  weftCostPerM:            number   // includes per-row shortage
  yarnBaseWarpPerM:        number   // raw warp cost before shortage (GST included)
  yarnBaseWeftPerM:        number   // raw weft cost before shortage (GST included)
  yarnShortageCostPerM:    number   // Σ of per-row shortage contributions across all rows
  weaveCostPerM:           number
  warpingAndSizingPerM:    number
  windingPerM:             number
  processingPerM:          number
  finishingPerM:           number
  directCostPerM:          number
  overheadPerM:            number
  overheadTotalMonthly:    number   // sum of all overhead item monthly amounts
  resolvedItems:           OverheadItem[] // overhead items after resolving meta formulas
  // ── Capacity Dynamics ───────────────────────────────────────────────────
  overheadPerMAtCapacity:  number   // overhead if factory ran at 100% capacity
  ratedCapacityM:          number   // max metres factory CAN produce (looms × output × days)
  capacityUtilisationPct:  number   // monthlyOutputM / ratedCapacityM × 100
  costOfIdleCapacityMonthly: number // RUPEE loss due to underutilisation
  // ────────────────────────────────────────────────────────────────────────
  totalProductionCostPerM: number
  totalWarpKgPer100m:      number   // used for warping formula + display
  totalAllYarnKgPer100m:   number   // used for winding formula + quality weight display
  estimatedBeamCapacityM:  number   // how many metres one full beam produces
  orderQuote:              OrderQuote | null
  audit:                   EstimatorCostAudit
}

/**
 * The one financial result contract consumed by the estimator, saved costing
 * library, comparison view, PDFs, and persistence boundary.
 *
 * The calculation engine keeps full Decimal precision internally.  These are
 * the final INR values after the single approved rounding policy is applied.
 */
export interface CostingResultSnapshot {
  /** Version of the persisted canonical result shape, not the formula version. */
  snapshotSchemaVersion?: number
  calculationVersion: string
  roundingPolicy: string
  quantityM: number | null
  quoteIsValid: boolean
  quoteErrorMessage: string | null
  productionCostPerM: number
  overheadPerM: number
  overheadMode: OverheadMode
  overheadSource: CostingOverheadSource
  overheadReferencePerM: number | null
  overheadPriceImpactPerM: number
  overheadQuotePriceImpactPerM: number
  transportPerM: number
  commissionPct: number
  commissionPerM: number
  landedCostPerM: number
  breakEvenPricePerM: number
  suggestedSellingPricePerM: number
  targetMarginPct: number
  actualMarginPct: number
  profitPerM: number
  totalOrderValue: number | null
  totalLandedCost: number | null
  expectedProfitTotal: number | null
  breakdown: {
    warpCostPerM: number
    weftCostPerM: number
    weaveCostPerM: number
    warpingAndSizingPerM: number
    windingPerM: number
    processingPerM: number
    finishingPerM: number
    directCostPerM: number
    overheadPerM: number
    productionCostPerM: number
  }
  assumptions: CostingAssumptionsSnapshot | null
  /**
   * Immutable technical detail captured with the result.  Older rows do not
   * have this field, so readers must treat it as optional rather than
   * recalculating historical costings with today's defaults.
   */
  audit?: EstimatorCostAudit
}

export type CostingOverheadSource = 'direct_rate' | 'monthly_expenses'
export type CostingAssumptionSource = 'direct_rate' | 'monthly_expenses' | 'manual_input' | 'not_set'
export type CostingAssumptionUnit = 'percent' | 'INR_per_meter' | 'meters'

/**
 * One price-changing input as it was used by the canonical result. Rates are
 * intentionally paired with a unit so a persisted snapshot can be explained
 * without reopening the estimator or relying on today's factory defaults.
 */
export interface CostingAssumptionLine {
  source: CostingAssumptionSource
  unit: CostingAssumptionUnit
  activeRate: number | null
  referenceRate: number | null
  priceImpactPerM: number
  priceImpactTotal: number | null
}

export interface CostingOverheadAssumptions {
  mode: OverheadMode
  source: CostingOverheadSource
  activeRatePerM: number
  referenceRatePerM: number | null
  priceImpactPerM: number
  quotePriceImpactPerM: number
  priceImpactTotal: number | null
  monthlyExpenseTotal: number
  monthlyOutputM: number
}

export interface CostingAssumptionsSnapshot {
  overhead: CostingOverheadAssumptions
  commission: CostingAssumptionLine
  transport: CostingAssumptionLine
  margin: CostingAssumptionLine
  quantity: CostingAssumptionLine
}

function finiteNumberOrZero(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getEffectiveOverheadMode(
  estimate: Pick<EstimateState, 'overheadMode' | 'overheadOverridePerM'>,
): OverheadMode {
  return estimate.overheadMode === 'direct'
    || (estimate.overheadMode == null && estimate.overheadOverridePerM != null)
    ? 'direct'
    : 'monthly_expenses'
}

/**
 * A non-zero entered commercial amount is an explicit customer-facing
 * assumption.  A stale section toggle must not silently remove it from the
 * price calculation.  The mismatch flags let the UI warn without changing
 * the owner's entered amount.
 */
export function getEffectiveCommercialInputs(estimate: Pick<EstimateState, 'enabledSections' | 'commissionPct' | 'transportPerM'>) {
  const commissionPct = finiteNumberOrZero(estimate.commissionPct)
  const transportPerM = finiteNumberOrZero(estimate.transportPerM)
  return {
    commissionPct: estimate.enabledSections.commission || commissionPct > 0 ? commissionPct : 0,
    transportPerM: estimate.enabledSections.transport || transportPerM > 0 ? transportPerM : 0,
    commissionToggleMismatch: commissionPct > 0 && !estimate.enabledSections.commission,
    transportToggleMismatch: transportPerM > 0 && !estimate.enabledSections.transport,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMULA FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Warp yarn weight per 100m of finished fabric.
 *
 * Formula: (beamEnds × calcDenier × 100) / 9_000_000
 *   - Denier = grams per 9000 metres of one thread
 *   - One end contributes calcDenier/9000 g per metre
 *   - N ends → (N × calcDenier / 9000) g/m → × 100 for per-100m, ÷ 1000 for kg
 *
 * @param beamEnds  - number of warp ends for this component
 * @param calcDenier - effective denier (after doubling/folding)
 * @returns kg per 100m
 */
export function calcWarpYarnKg(beamEnds: number, calcDenier: number): number {
  return new Decimal(beamEnds)
    .times(calcDenier)
    .times(100)
    .div(9_000_000)
    .toNumber()
}

/**
 * Weft yarn weight per 100m of finished fabric.
 *
 * Formula: (picks × (clothWidth / 2.54) × calcDenier × 100) / 9_000_000
 *   - picks     = picks per INCH (PPI) — standard Surat unit
 *   - clothWidth = FINISHED cloth output width in cm (NOT loom/reed width)
 *
 * IMPORTANT: Use the actual output cloth width, not the loom reed width.
 * The loom reed may be 96–120cm wide but the cloth output is typically
 * 60–80cm due to warp/weft crimp. Using reed width over-estimates weft
 * consumption by ~20–35%.
 *
 *   Per 1m fabric length: picks × (clothWidth / 2.54) inches of weft thread
 *   × 100 (per-100m) ÷ 9000 (denier→g/m) ÷ 1000 (g→kg)
 *
 * @param picks      - picks per inch (PPI)
 * @param clothWidth - finished cloth output width in cm
 * @param calcDenier - effective weft yarn denier
 * @returns kg per 100m
 */
export function calcWeftYarnKg(picks: number, clothWidth: number, calcDenier: number): number {
  // clothWidth is in cm. Convert to inches: clothWidth / 2.54
  const clothWidthInches = new Decimal(clothWidth).div(2.54)
  return new Decimal(picks)
    .times(clothWidthInches)
    .times(calcDenier)
    .times(100)
    .div(9_000_000)
    .toNumber()
}

export function cmToInches(cm: number): number {
  return new Decimal(cm || 0).div(2.54).toNumber()
}

export function inchesToCm(inches: number): number {
  return new Decimal(inches || 0).times(2.54).toNumber()
}

export function getEffectiveCostingWidthCm(row: Pick<WeftRow, 'reedSpace' | 'effectiveCostingWidthCm'>): number {
  const explicit = Number(row.effectiveCostingWidthCm)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  const legacy = Number(row.reedSpace)
  return Number.isFinite(legacy) ? legacy : 0
}

export type WidthWarningCode =
  | 'suspicious_narrow_width'
  | 'cm_value_looks_like_inches'

export interface WidthWarning {
  code: WidthWarningCode
  message: string
}

export function getWidthWarnings(params: {
  effectiveCostingWidthCm?: number | null
  inputUnit?: WidthUnit
  rawInputValue?: number
}): WidthWarning[] {
  const warnings: WidthWarning[] = []
  const effectiveCm = Number(params.effectiveCostingWidthCm ?? 0)
  const effectiveInches = cmToInches(effectiveCm)
  const rawInput = Number(params.rawInputValue ?? 0)

  if (effectiveCm > 0 && effectiveInches < 30) {
    warnings.push({
      code: 'suspicious_narrow_width',
      message: `${effectiveCm.toFixed(effectiveCm % 1 === 0 ? 0 : 1)} cm is only ${effectiveInches.toFixed(1)} inches. Did you mean ${effectiveCm.toFixed(effectiveCm % 1 === 0 ? 0 : 1)} inches?`,
    })
  }

  if (
    params.inputUnit === 'cm' &&
    rawInput >= 45 &&
    rawInput <= 90 &&
    !warnings.some(warning => warning.code === 'suspicious_narrow_width')
  ) {
    warnings.push({
      code: 'cm_value_looks_like_inches',
      message: `${rawInput.toFixed(rawInput % 1 === 0 ? 0 : 1)} cm looks like an inch width. Confirm the unit before costing.`,
    })
  }

  return warnings
}

/**
 * Yarn landed cost per 100m for a single row.
 * GST is applied per-row because different materials attract different tax brackets.
 * Shortage is applied as an additional consumption factor.
 *
 * Formula: kgPer100m × (yarnRate × (1 + gstPct/100)) × (1 + shortagePct/100)
 *
 * @param kgPer100m   - raw yarn weight per 100m
 * @param yarnRate    - ₹/kg market rate
 * @param gstPct      - GST percentage (e.g. 5 for 5%)
 * @param shortagePct - shortage/wastage percentage (e.g. 5 for 5%)
 * @returns ₹ per 100m
 */
export function calcYarnCost(
  kgPer100m: number,
  yarnRate: number,
  gstPct: number,
  shortagePct: number
): number {
  const rateWithGst = new Decimal(yarnRate).times(new Decimal(1).plus(new Decimal(gstPct).div(100)))
  return new Decimal(kgPer100m)
    .times(rateWithGst)
    .times(new Decimal(1).plus(new Decimal(shortagePct).div(100)))
    .toNumber()
}

/**
 * Weave cost per metre of finished fabric.
 *
 * The confirmed Surat formula — NO reed space multiplication.
 * The per-pick rate inherently accounts for the standard machine width.
 *
 * Formula: picks (PPI) × internal rupees-per-pick value
 *   e.g. 68 picks × ₹0.16 (16 paise) = ₹10.88 / m
 *
 * @param picks            - picks per inch (PPI)
 * @param perPickCostPaisa - legacy name; loom charge stored internally in ₹/pick
 * @returns ₹ per metre
 */
export function calcWeaveCostPerMeter(picks: number, perPickCostPaisa: number): number {
  return new Decimal(picks).times(perPickCostPaisa).toNumber()
}

/**
 * Warping + Sizing cost per metre.
 * Both are charged by the warping unit on the same warp weight.
 * totalWarpKgPer100m is already computed from the warp rows — no new inputs needed.
 *
 * Formula: (totalWarpKgPer100m × (warpingRate + sizingRate)) / 100
 *
 * @param totalWarpKgPer100m - sum of kgPer100m across all warp rows
 * @param warpingRatePerKg   - ₹/kg charged by warping unit
 * @param sizingRatePerKg    - ₹/kg charged by sizing unit
 * @returns ₹ per metre
 */
export function calcWarpingCostPerMeter(
  totalWarpKgPer100m: number,
  warpingRatePerKg: number,
  sizingRatePerKg: number
): number {
  return new Decimal(totalWarpKgPer100m)
    .times(new Decimal(warpingRatePerKg).plus(sizingRatePerKg))
    .div(100)
    .toNumber()
}

/**
 * Winding cost per metre (optional — only when yarn arrives on hanks).
 * Charged on total yarn weight (warp + weft).
 *
 * Formula: (totalAllYarnKgPer100m × windingRatePerKg) / 100
 *
 * @param totalAllYarnKgPer100m - total yarn (warp + weft) kg per 100m
 * @param windingRatePerKg      - ₹/kg winding charge
 * @returns ₹ per metre
 */
export function calcWindingCostPerMeter(
  totalAllYarnKgPer100m: number,
  windingRatePerKg: number
): number {
  return new Decimal(totalAllYarnKgPer100m)
    .times(windingRatePerKg)
    .div(100)
    .toNumber()
}

/**
 * Overhead cost per metre — V2 formula.
 *
 * Divides total monthly fixed factory costs by monthly output metres.
 * This is more accurate than a percentage because it reflects real fixed costs
 * independent of yarn prices (which fluctuate).
 *
 * Formula: Σ(items[i].monthlyAmount) / monthlyOutputM
 *
 * @param overheadItems   - array of monthly overhead line items
 * @param monthlyOutputM  - estimated metres produced per month
 * @returns { overheadPerM, totalMonthly }
 */
/**
 * Defensively ensures an array of overhead items satisfies the full OverheadItem type.
 * Populates missing fields (category, isPreset, isLocked) with safe defaults.
 * Essential for loading legacy data from DB or templates.
 */
export function ensureOverheadIntegrity(items: unknown[]): OverheadItem[] {
  if (!Array.isArray(items)) return []
  return items.map(rawItem => {
    const item = (typeof rawItem === 'object' && rawItem !== null ? rawItem : {}) as OverheadItemInput
    return {
      id:            item.id || nanoid(),
      label:         item.label || 'Unnamed Item',
      monthlyAmount: Number(item.monthlyAmount || 0),
      category:      item.category || 'custom',
      isPreset:      item.isPreset ?? false,
      isLocked:      item.isLocked ?? false,
      source:        item.source || 'manual',
      workerId:      item.workerId || undefined,
      meta:          item.meta || undefined
    }
  })
}



export function calcOverheadCostPerMeter(
  overheadItems: OverheadItem[],
  monthlyOutputM: number,
  loomCount: number
): { overheadPerM: number; totalMonthly: number; resolvedItems: OverheadItem[] } {
  const resolvedItems = ensureOverheadIntegrity(overheadItems).map(item => ({
    ...item,
    monthlyAmount: resolveOverheadItemAmount(item, loomCount)
  }))
  const totalMonthly = resolvedItems.reduce((sum, item) => sum.plus(item.monthlyAmount || 0), new Decimal(0))
  const overheadPerM = monthlyOutputM > 0 ? totalMonthly.div(monthlyOutputM) : new Decimal(0)
  return { 
    overheadPerM: overheadPerM.toNumber(), 
    totalMonthly: totalMonthly.toNumber(), 
    resolvedItems 
  }
}

function calculateSuggestedSellingPricePerM(params: {
  totalProductionCostPerM: number
  commissionPct: number
  transportPerM: number
  profitMarginPct: number
}): number {
  const P = new Decimal(params.totalProductionCostPerM)
  const T = new Decimal(params.transportPerM)
  const C = new Decimal(params.commissionPct).div(100)
  const M = new Decimal(params.profitMarginPct).div(100)
  const denominator = new Decimal(1).minus(C).minus(M)
  return denominator.gt(0) ? P.plus(T).div(denominator).toNumber() : 0
}

/**
 * Order-level quote calculations.
 * Only called when the owner has entered an order quantity.
 *
 * quotePricePerM  = (production + transport) ÷ (1 - commission% - margin%)
 * landedCostPerM  = production + transport + (quote price × commission%)
 * grossProfit     = (quotePrice − landedCost) × qty
 * actualMarginPct = grossProfit / totalOrderValue × 100
 */
export function calcOrderQuote(params: {
  totalProductionCostPerM: number
  orderQuantityM:          number
  commissionPct:           number
  transportPerM:           number
  profitMarginPct:         number
}): OrderQuote {
  const { totalProductionCostPerM, orderQuantityM, commissionPct, transportPerM, profitMarginPct } = params

  const P = new Decimal(totalProductionCostPerM)
  const T = new Decimal(transportPerM)
  const C = new Decimal(commissionPct).div(100)
  const M = new Decimal(profitMarginPct).div(100)

  const denominator = new Decimal(1).minus(C).minus(M)

  if (denominator.lte(0)) {
    return {
      isValid: false,
      errorMessage: 'Commission % + Margin % must be below 100%.',
      landedCostPerM: 0,
      quotePricePerM: 0,
      totalOrderValue: 0,
      grossProfitRupees: 0,
      actualMarginPct: 0
    }
  }

  const quotePricePerM   = new Decimal(calculateSuggestedSellingPricePerM({
    totalProductionCostPerM,
    commissionPct,
    transportPerM,
    profitMarginPct,
  }))
  const commissionPerM   = quotePricePerM.times(C)
  const landedCostPerM   = P.plus(T).plus(commissionPerM)
  const profitPerM       = quotePricePerM.minus(landedCostPerM)
  const totalOrderValue  = quotePricePerM.times(orderQuantityM)
  const totalCost        = landedCostPerM.times(orderQuantityM)
  const grossProfitRupees = totalOrderValue.minus(totalCost)
  // Margin is a per-metre commercial invariant. Deriving it from aggregate
  // order totals produces 0/0 when Base has no order quantity, which made the
  // UI and exported cost sheet contradict the configured target margin.
  const actualMarginPct  = quotePricePerM.gt(0)
    ? profitPerM.div(quotePricePerM).times(100)
    : new Decimal(0)

  return { 
    isValid: true,
    landedCostPerM: landedCostPerM.toNumber(), 
    quotePricePerM: quotePricePerM.toNumber(), 
    totalOrderValue: totalOrderValue.toNumber(), 
    grossProfitRupees: grossProfitRupees.toNumber(), 
    actualMarginPct: actualMarginPct.toNumber() 
  }
}

/**
 * Break-even selling price per metre.  This is the minimum selling price that
 * leaves zero profit after transport and commission.  It is intentionally
 * separate from landed cost: landed cost depends on the chosen quote price,
 * while break-even solves for the quote price at zero margin.
 */
export function calculateBreakEvenPricePerM(
  productionCostPerM: number,
  transportPerM: number,
  commissionPct: number,
): number {
  const production = new Decimal(finiteNumberOrZero(productionCostPerM))
  const transport = new Decimal(finiteNumberOrZero(transportPerM))
  const commission = new Decimal(finiteNumberOrZero(commissionPct)).div(100)
  const denominator = new Decimal(1).minus(commission)
  if (denominator.lte(0)) return 0
  return production.plus(transport).div(denominator).toNumber()
}

/**
 * Build the final, rounded financial result shared by every output surface.
 * `calcFullTotals` remains the detailed high-precision textile engine; this
 * function is the only boundary at which financial values are normalized for
 * persistence and display.
 */
export function buildCostingResult(
  estimate: EstimateState,
  totals: EstimatorV3Totals,
): CostingResultSnapshot {
  const commercialInputs = getEffectiveCommercialInputs(estimate)
  const overheadMode = getEffectiveOverheadMode(estimate)
  const hasFiniteProductionCost = Number.isFinite(totals.totalProductionCostPerM)
  const hasFiniteOrderQuote = Boolean(
    totals.orderQuote
    && Number.isFinite(totals.orderQuote.quotePricePerM)
    && Number.isFinite(totals.orderQuote.landedCostPerM),
  )
  const productionCostPerM = normalizeCurrencySnapshot(
    hasFiniteProductionCost ? totals.totalProductionCostPerM : 0,
  )
  const overheadPerM = normalizeCurrencySnapshot(totals.overheadPerM)
  const transportPerM = normalizeCurrencySnapshot(commercialInputs.transportPerM)
  // Never combine a stale quote object with an invalid production total. A
  // partially corrupted draft must collapse to a safe, explainable zero
  // result instead of exporting a price derived from different inputs.
  const rawSuggestedSellingPricePerM = hasFiniteProductionCost && hasFiniteOrderQuote
    ? totals.orderQuote?.quotePricePerM ?? 0
    : 0
  const suggestedSellingPricePerM = normalizeCurrencySnapshot(rawSuggestedSellingPricePerM)
  const commissionPerM = normalizeCurrencySnapshot(
    new Decimal(rawSuggestedSellingPricePerM)
      .times(commercialInputs.commissionPct)
      .div(100)
      .toNumber(),
  )
  const rawLandedCostPerM = hasFiniteProductionCost && hasFiniteOrderQuote
    ? totals.orderQuote?.landedCostPerM ?? 0
    : new Decimal(productionCostPerM)
      .plus(commercialInputs.transportPerM)
      .plus(commissionPerM)
      .toNumber()
  const landedCostPerM = normalizeCurrencySnapshot(rawLandedCostPerM)
  const breakEvenPricePerM = normalizeCurrencySnapshot(calculateBreakEvenPricePerM(
    totals.totalProductionCostPerM,
    commercialInputs.transportPerM,
    commercialInputs.commissionPct,
  ))
  const profitPerM = normalizeCurrencySnapshot(suggestedSellingPricePerM - landedCostPerM)
  const quantityValue = Number(estimate.orderQuantityM)
  const quantityM = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : null
  const totalOrderValue = quantityM == null
    ? null
    : normalizeCurrencySnapshot(suggestedSellingPricePerM * quantityM)
  const totalLandedCost = quantityM == null
    ? null
    : normalizeCurrencySnapshot(landedCostPerM * quantityM)
  const expectedProfitTotal = totalOrderValue == null || totalLandedCost == null
    ? null
    : normalizeCurrencySnapshot(totalOrderValue - totalLandedCost)
  const actualMarginPct = normalizeCurrencySnapshot(
    suggestedSellingPricePerM > 0
      ? new Decimal(profitPerM).div(suggestedSellingPricePerM).times(100).toNumber()
      : 0,
  )
  const quoteIsValid = Boolean(totals.orderQuote?.isValid) && hasFiniteOrderQuote
  const monthlyExpenseReferencePerM = estimate.monthlyOutputM > 0
    ? normalizeCurrencySnapshot(new Decimal(totals.overheadTotalMonthly).div(estimate.monthlyOutputM).toNumber())
    : null
  const directRateReferencePerM = estimate.overheadOverridePerM == null
    ? null
    : normalizeCurrencySnapshot(estimate.overheadOverridePerM)
  const overheadReferencePerM = overheadMode === 'direct'
    ? monthlyExpenseReferencePerM
    : directRateReferencePerM
  const overheadPriceImpactPerM = overheadReferencePerM == null
    ? 0
    : normalizeCurrencySnapshot(overheadPerM - overheadReferencePerM)
  const referenceQuotePricePerM = overheadReferencePerM == null || !hasFiniteProductionCost
    ? null
    : calculateSuggestedSellingPricePerM({
      totalProductionCostPerM: totals.directCostPerM + overheadReferencePerM,
      commissionPct: commercialInputs.commissionPct,
      transportPerM: commercialInputs.transportPerM,
      profitMarginPct: estimate.profitPct,
    })
  const overheadQuotePriceImpactPerM = quoteIsValid && referenceQuotePricePerM != null
    ? normalizeCurrencySnapshot(suggestedSellingPricePerM - referenceQuotePricePerM)
    : 0

  const buildAssumptionLine = (params: {
    source: CostingAssumptionSource
    unit: CostingAssumptionUnit
    activeRate: number | null
    referenceRate: number | null
    priceImpactPerM: number
  }): CostingAssumptionLine => ({
    ...params,
    priceImpactTotal: quantityM == null
      ? null
      : normalizeCurrencySnapshot(params.priceImpactPerM * quantityM),
  })
  const overheadAssumptions: CostingOverheadAssumptions = {
    mode: overheadMode,
    source: overheadMode === 'direct' ? 'direct_rate' : 'monthly_expenses',
    activeRatePerM: overheadPerM,
    referenceRatePerM: overheadReferencePerM,
    priceImpactPerM: overheadPriceImpactPerM,
    quotePriceImpactPerM: overheadQuotePriceImpactPerM,
    priceImpactTotal: quantityM == null
      ? null
      : normalizeCurrencySnapshot(overheadPriceImpactPerM * quantityM),
    monthlyExpenseTotal: normalizeCurrencySnapshot(totals.overheadTotalMonthly),
    monthlyOutputM: finiteNumberOrZero(estimate.monthlyOutputM),
  }

  return {
    snapshotSchemaVersion: 2,
    calculationVersion: COSTING_CALCULATION_VERSION,
    roundingPolicy: COSTING_ROUNDING_POLICY,
    quantityM,
    quoteIsValid,
    quoteErrorMessage: totals.orderQuote?.errorMessage ?? null,
    productionCostPerM,
    overheadPerM,
    overheadMode,
    overheadSource: overheadAssumptions.source,
    overheadReferencePerM,
    overheadPriceImpactPerM,
    overheadQuotePriceImpactPerM,
    transportPerM,
    commissionPct: finiteNumberOrZero(commercialInputs.commissionPct),
    commissionPerM,
    landedCostPerM,
    breakEvenPricePerM,
    suggestedSellingPricePerM,
    targetMarginPct: finiteNumberOrZero(estimate.profitPct),
    actualMarginPct,
    profitPerM,
    totalOrderValue,
    totalLandedCost,
    expectedProfitTotal,
    breakdown: {
      warpCostPerM: normalizeCurrencySnapshot(totals.warpCostPerM),
      weftCostPerM: normalizeCurrencySnapshot(totals.weftCostPerM),
      weaveCostPerM: normalizeCurrencySnapshot(totals.weaveCostPerM),
      warpingAndSizingPerM: normalizeCurrencySnapshot(totals.warpingAndSizingPerM),
      windingPerM: normalizeCurrencySnapshot(totals.windingPerM),
      processingPerM: normalizeCurrencySnapshot(totals.processingPerM),
      finishingPerM: normalizeCurrencySnapshot(totals.finishingPerM),
      directCostPerM: normalizeCurrencySnapshot(totals.directCostPerM),
      overheadPerM,
      productionCostPerM,
    },
    assumptions: {
      overhead: overheadAssumptions,
      commission: buildAssumptionLine({
        source: 'manual_input',
        unit: 'percent',
        activeRate: finiteNumberOrZero(commercialInputs.commissionPct),
        referenceRate: 0,
        priceImpactPerM: commissionPerM,
      }),
      transport: buildAssumptionLine({
        source: 'manual_input',
        unit: 'INR_per_meter',
        activeRate: transportPerM,
        referenceRate: 0,
        priceImpactPerM: transportPerM,
      }),
      margin: buildAssumptionLine({
        source: 'manual_input',
        unit: 'percent',
        activeRate: finiteNumberOrZero(estimate.profitPct),
        referenceRate: 0,
        priceImpactPerM: normalizeCurrencySnapshot(suggestedSellingPricePerM - breakEvenPricePerM),
      }),
      quantity: {
        source: quantityM == null ? 'not_set' : 'manual_input',
        unit: 'meters',
        activeRate: quantityM,
        referenceRate: null,
        // Quantity changes order totals, never the per-metre price. Keeping
        // this explicit prevents an order quantity from becoming a hidden
        // price input in either standalone or Full Suite costing.
        priceImpactPerM: 0,
        priceImpactTotal: null,
      },
    },
    audit: totals.audit,
  }
}

function parseCostingAuditLayer(value: unknown, fallbackId: string): EstimatorYarnLayerAudit | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const readRequiredNumber = (key: string) => {
    const parsed = Number(raw[key])
    return Number.isFinite(parsed) ? parsed : null
  }
  const readNullableNumber = (key: string) => {
    if (raw[key] === null || raw[key] === undefined) return null
    const parsed = Number(raw[key])
    return Number.isFinite(parsed) ? parsed : null
  }
  const requiredNumbers = [
    'calcDenier',
    'formulaKgPer100m',
    'baseKgPer100mUsed',
    'crimpPct',
    'wastePct',
    'totalAdjustmentPct',
    'finalKgPer100m',
    'ratePerKg',
    'gstPct',
    'costPerMeter',
  ]
  const parsedRequired = Object.fromEntries(requiredNumbers.map(key => [key, readRequiredNumber(key)]))
  if (Object.values(parsedRequired).some(value => value === null)) return null

  const mode = raw.mode === 'manual' ? 'manual' : raw.mode === 'formula' ? 'formula' : null
  if (!mode) return null

  const id = typeof raw.id === 'string' && raw.id ? raw.id : fallbackId
  const name = typeof raw.name === 'string' ? raw.name : ''
  const formulaDescription = typeof raw.formulaDescription === 'string' ? raw.formulaDescription : ''
  const beamEnds = readNullableNumber('beamEnds')
  const picks = readNullableNumber('picks')
  const effectiveCostingWidthInches = readNullableNumber('effectiveCostingWidthInches')
  const manualKgPer100m = readNullableNumber('manualKgPer100m')
  // Older snapshots did not persist waste provenance. Their applied waste is
  // still truthful, so retain it as the best available default and make the
  // source explicit as unknown instead of inventing an override.
  const defaultWastePct = readNullableNumber('defaultWastePct') ?? parsedRequired.wastePct!
  const wastePctSource: CostingWasteSource = raw.wastePctSource === 'row_override'
    ? 'row_override'
    : raw.wastePctSource === 'default'
      ? 'default'
      : 'unknown'

  return {
    id,
    name,
    mode,
    formulaDescription,
    calcDenier: parsedRequired.calcDenier!,
    beamEnds,
    picks,
    effectiveCostingWidthInches,
    formulaKgPer100m: parsedRequired.formulaKgPer100m!,
    manualKgPer100m,
    baseKgPer100mUsed: parsedRequired.baseKgPer100mUsed!,
    crimpPct: parsedRequired.crimpPct!,
    wastePct: parsedRequired.wastePct!,
    defaultWastePct,
    wastePctSource,
    totalAdjustmentPct: parsedRequired.totalAdjustmentPct!,
    finalKgPer100m: parsedRequired.finalKgPer100m!,
    ratePerKg: parsedRequired.ratePerKg!,
    gstPct: parsedRequired.gstPct!,
    costPerMeter: parsedRequired.costPerMeter!,
  }
}

function parseCostingAudit(value: unknown): EstimatorCostAudit | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const parseLayerGroup = (key: 'warp' | 'weft') => {
    const group = raw[key]
    if (group === null || typeof group !== 'object' || Array.isArray(group)) return null
    const groupRecord = group as Record<string, unknown>
    if (!Array.isArray(groupRecord.layers)) return null
    const layers = groupRecord.layers
      .map((layer, index) => parseCostingAuditLayer(layer, `${key}-${index}`))
    if (layers.some(layer => layer === null)) return null
    const totalCostPerMeter = Number(groupRecord.totalCostPerMeter)
    if (!Number.isFinite(totalCostPerMeter)) return null
    return { layers: layers as EstimatorYarnLayerAudit[], totalCostPerMeter }
  }
  const warp = parseLayerGroup('warp')
  const weft = parseLayerGroup('weft')
  if (!warp || !weft) return null

  const readNumber = (key: string) => {
    const parsed = Number(raw[key])
    return Number.isFinite(parsed) ? parsed : null
  }
  const numericKeys = [
    'yarnBaseCostPerMeter',
    'yarnAdjustmentCostPerMeter',
    'yarnTotalCostPerMeter',
    'weaveCostPerMeter',
    'warpingAndSizingCostPerMeter',
    'overheadCostPerMeter',
    'postProcessingCostPerMeter',
    'logisticsCostPerMeter',
    'directCostPerMeter',
    'productionCostPerMeter',
  ]
  const parsed = Object.fromEntries(numericKeys.map(key => [key, readNumber(key)]))
  if (Object.values(parsed).some(value => value === null)) return null

  return {
    warp,
    weft,
    yarnBaseCostPerMeter: parsed.yarnBaseCostPerMeter!,
    yarnAdjustmentCostPerMeter: parsed.yarnAdjustmentCostPerMeter!,
    yarnTotalCostPerMeter: parsed.yarnTotalCostPerMeter!,
    weaveCostPerMeter: parsed.weaveCostPerMeter!,
    warpingAndSizingCostPerMeter: parsed.warpingAndSizingCostPerMeter!,
    overheadCostPerMeter: parsed.overheadCostPerMeter!,
    postProcessingCostPerMeter: parsed.postProcessingCostPerMeter!,
    logisticsCostPerMeter: parsed.logisticsCostPerMeter!,
    directCostPerMeter: parsed.directCostPerMeter!,
    productionCostPerMeter: parsed.productionCostPerMeter!,
  }
}

function parseCostingAssumptionLine(value: unknown): CostingAssumptionLine | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const validSources: CostingAssumptionSource[] = ['direct_rate', 'monthly_expenses', 'manual_input', 'not_set']
  const validUnits: CostingAssumptionUnit[] = ['percent', 'INR_per_meter', 'meters']
  if (!validSources.includes(raw.source as CostingAssumptionSource)) return null
  if (!validUnits.includes(raw.unit as CostingAssumptionUnit)) return null
  const activeRate = raw.activeRate == null ? null : Number(raw.activeRate)
  const referenceRate = raw.referenceRate == null ? null : Number(raw.referenceRate)
  const priceImpactPerM = Number(raw.priceImpactPerM)
  const priceImpactTotal = raw.priceImpactTotal == null ? null : Number(raw.priceImpactTotal)
  if (activeRate != null && !Number.isFinite(activeRate)) return null
  if (referenceRate != null && !Number.isFinite(referenceRate)) return null
  if (!Number.isFinite(priceImpactPerM)) return null
  if (priceImpactTotal != null && !Number.isFinite(priceImpactTotal)) return null
  return {
    source: raw.source as CostingAssumptionSource,
    unit: raw.unit as CostingAssumptionUnit,
    activeRate,
    referenceRate,
    priceImpactPerM,
    priceImpactTotal,
  }
}

function parseCostingAssumptions(value: unknown): CostingAssumptionsSnapshot | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const overheadValue = raw.overhead
  if (overheadValue === null || typeof overheadValue !== 'object' || Array.isArray(overheadValue)) return null
  const overhead = overheadValue as Record<string, unknown>
  const mode = overhead.mode
  const source = overhead.source
  if (mode !== 'direct' && mode !== 'monthly_expenses') return null
  if (source !== 'direct_rate' && source !== 'monthly_expenses') return null
  const readNullable = (key: string) => overhead[key] == null ? null : Number(overhead[key])
  const activeRatePerM = Number(overhead.activeRatePerM)
  const referenceRatePerM = readNullable('referenceRatePerM')
  const priceImpactPerM = Number(overhead.priceImpactPerM)
  const quotePriceImpactPerM = Number(overhead.quotePriceImpactPerM)
  const priceImpactTotal = readNullable('priceImpactTotal')
  const monthlyExpenseTotal = Number(overhead.monthlyExpenseTotal)
  const monthlyOutputM = Number(overhead.monthlyOutputM)
  if (!Number.isFinite(activeRatePerM)
    || (referenceRatePerM != null && !Number.isFinite(referenceRatePerM))
    || !Number.isFinite(priceImpactPerM)
    || !Number.isFinite(quotePriceImpactPerM)
    || (priceImpactTotal != null && !Number.isFinite(priceImpactTotal))
    || !Number.isFinite(monthlyExpenseTotal)
    || !Number.isFinite(monthlyOutputM)) return null

  const commission = parseCostingAssumptionLine(raw.commission)
  const transport = parseCostingAssumptionLine(raw.transport)
  const margin = parseCostingAssumptionLine(raw.margin)
  const quantity = parseCostingAssumptionLine(raw.quantity)
  if (!commission || !transport || !margin || !quantity) return null

  return {
    overhead: {
      mode,
      source,
      activeRatePerM,
      referenceRatePerM,
      priceImpactPerM,
      quotePriceImpactPerM,
      priceImpactTotal,
      monthlyExpenseTotal,
      monthlyOutputM,
    },
    commission,
    transport,
    margin,
    quantity,
  }
}

/** Safely read a persisted result snapshot without trusting arbitrary JSON. */
export function parseCostingResultSnapshot(value: unknown): CostingResultSnapshot | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const breakdown = raw.breakdown
  if (breakdown === null || typeof breakdown !== 'object' || Array.isArray(breakdown)) return null
  const details = breakdown as Record<string, unknown>
  const readCurrency = (key: string) => {
    const parsed = Number(raw[key])
    return Number.isFinite(parsed) ? parsed : null
  }
  const readBreakdownCurrency = (key: string) => {
    const parsed = Number(details[key])
    return Number.isFinite(parsed) ? parsed : null
  }
  const required = [
    'productionCostPerM', 'overheadPerM', 'transportPerM', 'commissionPct',
    'commissionPerM', 'landedCostPerM', 'breakEvenPricePerM',
    'suggestedSellingPricePerM', 'targetMarginPct', 'actualMarginPct',
    'profitPerM',
  ]
  if (typeof raw.calculationVersion !== 'string' || typeof raw.roundingPolicy !== 'string') return null
  if (required.some(key => readCurrency(key) == null)) return null
  const breakdownKeys = [
    'warpCostPerM', 'weftCostPerM', 'weaveCostPerM', 'warpingAndSizingPerM',
    'windingPerM', 'processingPerM', 'finishingPerM', 'directCostPerM',
    'overheadPerM', 'productionCostPerM',
  ]
  if (breakdownKeys.some(key => readBreakdownCurrency(key) == null)) return null
  const quantity = raw.quantityM == null ? null : Number(raw.quantityM)
  const totalOrderValue = raw.totalOrderValue == null ? null : Number(raw.totalOrderValue)
  const totalLandedCost = raw.totalLandedCost == null ? null : Number(raw.totalLandedCost)
  const expectedProfitTotal = raw.expectedProfitTotal == null ? null : Number(raw.expectedProfitTotal)
  if (quantity !== null && !Number.isFinite(quantity)) return null
  if (totalOrderValue !== null && !Number.isFinite(totalOrderValue)) return null
  if (totalLandedCost !== null && !Number.isFinite(totalLandedCost)) return null
  if (expectedProfitTotal !== null && !Number.isFinite(expectedProfitTotal)) return null
  if (raw.quoteIsValid != null && typeof raw.quoteIsValid !== 'boolean') return null
  const assumptions = raw.assumptions == null ? null : parseCostingAssumptions(raw.assumptions)
  if (raw.assumptions != null && !assumptions) return null
  const snapshotSchemaVersion = raw.snapshotSchemaVersion == null ? 1 : Number(raw.snapshotSchemaVersion)
  if (!Number.isInteger(snapshotSchemaVersion) || snapshotSchemaVersion < 1) return null
  const parsedAudit = raw.audit == null ? null : parseCostingAudit(raw.audit)
  if (raw.audit != null && !parsedAudit) return null
  const audit = parsedAudit ?? undefined
  const overheadMode = raw.overheadMode === 'direct' ? 'direct' : 'monthly_expenses'
  const overheadSource = raw.overheadSource === 'direct_rate' ? 'direct_rate' : 'monthly_expenses'
  const overheadReferencePerM = raw.overheadReferencePerM == null ? null : Number(raw.overheadReferencePerM)
  const overheadPriceImpactPerM = raw.overheadPriceImpactPerM == null ? 0 : Number(raw.overheadPriceImpactPerM)
  const overheadQuotePriceImpactPerM = raw.overheadQuotePriceImpactPerM == null ? 0 : Number(raw.overheadQuotePriceImpactPerM)
  if ((overheadReferencePerM != null && !Number.isFinite(overheadReferencePerM))
    || !Number.isFinite(overheadPriceImpactPerM)
    || !Number.isFinite(overheadQuotePriceImpactPerM)) return null

  const nonNegativeValues = [
    readCurrency('productionCostPerM'),
    readCurrency('overheadPerM'),
    readCurrency('transportPerM'),
    readCurrency('commissionPct'),
    readCurrency('commissionPerM'),
    readCurrency('landedCostPerM'),
    readCurrency('breakEvenPricePerM'),
    readCurrency('suggestedSellingPricePerM'),
    ...breakdownKeys.map(readBreakdownCurrency),
  ]
  if (nonNegativeValues.some(value => value === null || value < 0)) return null
  if (readCurrency('commissionPct')! >= 100) return null
  if (readCurrency('targetMarginPct')! < -100 || readCurrency('targetMarginPct')! > 100) return null
  if (readCurrency('productionCostPerM')! <= 0 || readCurrency('suggestedSellingPricePerM')! <= 0) return null
  if (quantity !== null && quantity <= 0) return null
  if (quantity === null && (totalOrderValue !== null || totalLandedCost !== null || expectedProfitTotal !== null)) return null
  if ((totalOrderValue !== null && totalOrderValue < 0) || (totalLandedCost !== null && totalLandedCost < 0)) return null

  const closeEnough = (left: number, right: number, tolerance = 0.02) => Math.abs(left - right) <= tolerance
  if (!closeEnough(readCurrency('productionCostPerM')!, readBreakdownCurrency('productionCostPerM')!)) return null
  if (!closeEnough(readCurrency('overheadPerM')!, readBreakdownCurrency('overheadPerM')!)) return null
  if (readCurrency('landedCostPerM')! + 0.02 < readCurrency('productionCostPerM')!) return null
  if (!closeEnough(
    readCurrency('profitPerM')!,
    readCurrency('suggestedSellingPricePerM')! - readCurrency('landedCostPerM')!,
  )) return null
  if (expectedProfitTotal !== null && totalOrderValue !== null && totalLandedCost !== null
      && !closeEnough(expectedProfitTotal, totalOrderValue - totalLandedCost, 0.05)) return null
  if (quantity !== null && totalOrderValue !== null && !closeEnough(totalOrderValue, readCurrency('suggestedSellingPricePerM')! * quantity, 0.05)) return null
  if (quantity !== null && totalLandedCost !== null && !closeEnough(totalLandedCost, readCurrency('landedCostPerM')! * quantity, 0.05)) return null
  if (!closeEnough(
    readCurrency('commissionPerM')!,
    readCurrency('suggestedSellingPricePerM')! * readCurrency('commissionPct')! / 100,
  )) return null
  if (!closeEnough(
    readCurrency('landedCostPerM')!,
    readCurrency('productionCostPerM')! + readCurrency('transportPerM')! + readCurrency('commissionPerM')!,
  )) return null
  if (!closeEnough(
    readCurrency('breakEvenPricePerM')!,
    calculateBreakEvenPricePerM(readCurrency('productionCostPerM')!, readCurrency('transportPerM')!, readCurrency('commissionPct')!),
    0.05,
  )) return null
  if (!closeEnough(
    readCurrency('actualMarginPct')!,
    readCurrency('profitPerM')! / readCurrency('suggestedSellingPricePerM')! * 100,
    0.05,
  )) return null

  return {
    snapshotSchemaVersion,
    calculationVersion: raw.calculationVersion,
    roundingPolicy: raw.roundingPolicy,
    quantityM: quantity,
    quoteIsValid: raw.quoteIsValid == null ? true : raw.quoteIsValid,
    quoteErrorMessage: raw.quoteErrorMessage == null
      ? null
      : typeof raw.quoteErrorMessage === 'string' ? raw.quoteErrorMessage : null,
    productionCostPerM: readCurrency('productionCostPerM')!,
    overheadPerM: readCurrency('overheadPerM')!,
    overheadMode,
    overheadSource,
    overheadReferencePerM,
    overheadPriceImpactPerM,
    overheadQuotePriceImpactPerM,
    transportPerM: readCurrency('transportPerM')!,
    commissionPct: readCurrency('commissionPct')!,
    commissionPerM: readCurrency('commissionPerM')!,
    landedCostPerM: readCurrency('landedCostPerM')!,
    breakEvenPricePerM: readCurrency('breakEvenPricePerM')!,
    suggestedSellingPricePerM: readCurrency('suggestedSellingPricePerM')!,
    targetMarginPct: readCurrency('targetMarginPct')!,
    actualMarginPct: readCurrency('actualMarginPct')!,
    profitPerM: readCurrency('profitPerM')!,
    totalOrderValue,
    totalLandedCost,
    expectedProfitTotal,
    breakdown: {
      warpCostPerM: readBreakdownCurrency('warpCostPerM')!,
      weftCostPerM: readBreakdownCurrency('weftCostPerM')!,
      weaveCostPerM: readBreakdownCurrency('weaveCostPerM')!,
      warpingAndSizingPerM: readBreakdownCurrency('warpingAndSizingPerM')!,
      windingPerM: readBreakdownCurrency('windingPerM')!,
      processingPerM: readBreakdownCurrency('processingPerM')!,
      finishingPerM: readBreakdownCurrency('finishingPerM')!,
      directCostPerM: readBreakdownCurrency('directCostPerM')!,
      overheadPerM: readBreakdownCurrency('overheadPerM')!,
      productionCostPerM: readBreakdownCurrency('productionCostPerM')!,
    },
    assumptions,
    audit,
  }
}

/**
 * Master aggregation function — called once per render via useMemo.
 * All layers derive from EstimateState; zero server round-trips.
 */
/**
 * Resolves a monthly overhead amount based on category metadata.
 * Handles derived logic for Electricity (per-loom) and Depreciation.
 * Returns the final ₹/month amount.
 */
export function resolveOverheadItemAmount(
  item: OverheadItem,
  loomCount: number
): number {
  if (!item.isLocked || !item.meta) return item.monthlyAmount

  const meta = item.meta
  if (meta.type === 'electricity' && meta.mode === 'per_loom') {
    return new Decimal(meta.unitsPerLoomPerMonth || 0)
      .times(loomCount)
      .times(meta.ratePerUnit || 0)
      .toNumber()
  }

  if (meta.type === 'depreciation') {
    const totalValue = new Decimal(loomCount).times(meta.avgCostPerLoom || 0)
    const annualDepr = totalValue.div(meta.usefulLifeYears || 10)
    return annualDepr.div(12).toNumber()
  }

  return item.monthlyAmount
}

export function calcFullTotals(estimate: EstimateState): EstimatorV3Totals {
  const globalShortage = estimate.yarnShortagePct ?? 0
  const warpCrimpPct = estimate.warpCrimpPct || 0;

  // ── Layer 1: Warp Yarn (Additive shortage applied) ──────────────
  // Contract: row shortage/waste overrides the default. Null means use default,
  // explicit 0 means no waste. Total adjustment is crimp + effective waste.
  const warpRows: WarpRowResult[] = estimate.warpRows.map(r => {
    const mode: YarnCalculationMode = r.calculationMode === 'manual' ? 'manual' : 'formula'
    const effectiveDenier = getEffectiveYarnDenier(r)
    const formulaKgPer100m = calcWarpYarnKg(r.beamEnds, effectiveDenier)
    const manualKgPer100m = r.manualKgPer100m != null && Number.isFinite(Number(r.manualKgPer100m))
      ? Number(r.manualKgPer100m)
      : null
    const baseKgPer100mUsed = mode === 'manual'
      ? Math.max(0, manualKgPer100m ?? 0)
      : formulaKgPer100m
    const hasRowWasteOverride = r.shortagePct !== null && r.shortagePct !== undefined
    const wastePct = hasRowWasteOverride ? r.shortagePct! : globalShortage
    const totalAdjustmentPct = new Decimal(warpCrimpPct).plus(wastePct)
    const finalKgPer100m = new Decimal(baseKgPer100mUsed)
      .times(new Decimal(1).plus(totalAdjustmentPct.div(100)))
      .toNumber()

    const costPer100m = calcYarnCost(baseKgPer100mUsed, r.yarnRate, r.gstPct, totalAdjustmentPct.toNumber())
    const baseCostPer100m = calcYarnCost(baseKgPer100mUsed, r.yarnRate, r.gstPct, 0)
    const shortageCostPer100m = new Decimal(costPer100m).minus(baseCostPer100m).toNumber();
    
    return {
      ...r,
      // Results and downstream legacy snapshot columns always expose effective
      // denier, even when the user entered an English cotton count.
      calcDenier: effectiveDenier,
      mode,
      calculationMode: mode,
      manualKgPer100m,
      formulaKgPer100m,
      baseKgPer100mUsed,
      crimpPct: warpCrimpPct,
      wastePct,
      defaultWastePct: globalShortage,
      wastePctSource: hasRowWasteOverride ? 'row_override' : 'default',
      totalAdjustmentPct: totalAdjustmentPct.toNumber(),
      finalKgPer100m,
      ratePerKg: r.yarnRate,
      costPerMeter: new Decimal(costPer100m).div(100).toNumber(),
      kgPer100m: finalKgPer100m,
      costPer100m,
      shortagePctUsed: wastePct,
      shortageCostPer100m,
    }
  })

  // ── Layer 2: Weft Yarn (waste only; warp crimp does not apply) ───────────
  const weftRows: WeftRowResult[] = estimate.weftRows.map(r => {
    const mode: YarnCalculationMode = r.calculationMode === 'manual' ? 'manual' : 'formula'
    const effectiveCostingWidthCm = getEffectiveCostingWidthCm(r)
    const effectiveDenier = getEffectiveYarnDenier(r)
    const formulaKgPer100m = calcWeftYarnKg(r.picks, effectiveCostingWidthCm, effectiveDenier)
    const manualKgPer100m = r.manualKgPer100m != null && Number.isFinite(Number(r.manualKgPer100m))
      ? Number(r.manualKgPer100m)
      : null
    const baseKgPer100mUsed = mode === 'manual'
      ? Math.max(0, manualKgPer100m ?? 0)
      : formulaKgPer100m
    const hasRowWasteOverride = r.shortagePct !== null && r.shortagePct !== undefined
    const wastePct = hasRowWasteOverride ? r.shortagePct! : globalShortage
    const totalAdjustmentPct = new Decimal(wastePct)
    const finalKgPer100m = new Decimal(baseKgPer100mUsed)
      .times(new Decimal(1).plus(totalAdjustmentPct.div(100)))
      .toNumber()

    const costPer100m = calcYarnCost(baseKgPer100mUsed, r.yarnRate, r.gstPct, totalAdjustmentPct.toNumber())
    const baseCostPer100m = calcYarnCost(baseKgPer100mUsed, r.yarnRate, r.gstPct, 0)
    const shortageCostPer100m = new Decimal(costPer100m).minus(baseCostPer100m).toNumber();
    
    return {
      ...r,
      calcDenier: effectiveDenier,
      mode,
      calculationMode: mode,
      manualKgPer100m,
      effectiveCostingWidthCm,
      formulaKgPer100m,
      baseKgPer100mUsed,
      crimpPct: 0,
      wastePct,
      defaultWastePct: globalShortage,
      wastePctSource: hasRowWasteOverride ? 'row_override' : 'default',
      totalAdjustmentPct: totalAdjustmentPct.toNumber(),
      finalKgPer100m,
      ratePerKg: r.yarnRate,
      costPerMeter: new Decimal(costPer100m).div(100).toNumber(),
      effectiveCostingWidthInches: cmToInches(effectiveCostingWidthCm),
      kgPer100m: finalKgPer100m,
      costPer100m,
      shortagePctUsed: wastePct,
      shortageCostPer100m,
    }
  })

  const totalWarpKgPer100m    = warpRows.reduce((s, r) => s.plus(r.kgPer100m), new Decimal(0))
  const totalWeftKgPer100m    = weftRows.reduce((s, r) => s.plus(r.kgPer100m), new Decimal(0))
  const totalAllYarnKgPer100m = totalWarpKgPer100m.plus(totalWeftKgPer100m)

  // Per-row costs already include shortage — sum directly
  const warpCostPerM = warpRows.reduce((s, r) => s.plus(r.costPer100m), new Decimal(0)).div(100)
  const weftCostPerM = weftRows.reduce((s, r) => s.plus(r.costPer100m), new Decimal(0)).div(100)

  // Base costs (pre-shortage) for display
  const yarnBaseWarpPerM = warpRows.reduce((s, r) => s.plus(calcYarnCost(r.baseKgPer100mUsed, r.yarnRate, r.gstPct, 0)), new Decimal(0)).div(100)
  const yarnBaseWeftPerM = weftRows.reduce((s, r) => s.plus(calcYarnCost(r.baseKgPer100mUsed, r.yarnRate, r.gstPct, 0)), new Decimal(0)).div(100)

  // Total shortage cost across all rows: Σ(per-row shortage contributions)
  const yarnShortageCostPerM =
    warpRows.reduce((s, r) => s.plus(r.shortageCostPer100m), new Decimal(0)).div(100).plus(
    weftRows.reduce((s, r) => s.plus(r.shortageCostPer100m), new Decimal(0)).div(100))

  // ── Layer 3: Weave Cost ─────────────────────────────────────────────────
  // Use the total picks from all weft rows (sum of PPI)
  const totalPicks = estimate.weftRows.reduce((s, r) => s.plus(r.picks), new Decimal(0)).toNumber()
  const weaveCostPerM = new Decimal(calcWeaveCostPerMeter(totalPicks, estimate.perPickCostPaisa))

  // ── Layer 4: Warping + Sizing ───────────────────────────────────────────
  // sizingMode toggle: 'in_house' = sizing is already in overhead (rate = 0)
  //                    'outsourced' = real variable cash cost, use sizingRatePerKg
  const effectiveSizingRate = (estimate.sizingMode ?? 'in_house') === 'outsourced'
    ? estimate.sizingRatePerKg
    : 0
  const warpingAndSizingPerM = new Decimal(calcWarpingCostPerMeter(
    totalWarpKgPer100m.toNumber(),
    estimate.warpingRatePerKg,
    effectiveSizingRate
  ))

  // ── Layer 5: Winding (optional) ─────────────────────────────────────────
  const windingPerM = estimate.enabledSections.winding
    ? new Decimal(calcWindingCostPerMeter(totalAllYarnKgPer100m.toNumber(), estimate.windingRatePerKg))
    : new Decimal(0)

  // ── Layer 6+7: Processing + Finishing (optional) ────────────────────────
  const processingPerM = estimate.enabledSections.processing ? new Decimal(estimate.processingRatePerM) : new Decimal(0)
  const finishingPerM  = estimate.enabledSections.finishing  ? new Decimal(estimate.finishingRatePerM)  : new Decimal(0)

  // ── Direct Cost (sum of all layers above) ───────────────────────────────
  const directCostPerM =
    warpCostPerM.plus(weftCostPerM).plus(weaveCostPerM).plus(
    warpingAndSizingPerM).plus(windingPerM).plus(processingPerM).plus(finishingPerM)

  // ── Layer 8: Overhead (sum of monthly fixed costs ÷ monthly output) ────
  const { 
    overheadPerM: calculatedOverheadPerM, 
    totalMonthly: overheadTotalMonthly,
    resolvedItems
  } = calcOverheadCostPerMeter(
    estimate.overheadItems,
    estimate.monthlyOutputM,
    estimate.loomCount
  )
  // Direct mode uses the explicit ₹/m input. Older callers may still provide
  // an override without the new mode field, so preserve that compatibility
  // path. An explicit monthly mode always uses monthly expenses; retaining a
  // stale direct override there would make the visible method contradict the
  // amount used in the costing.
  const isDirectOverhead = getEffectiveOverheadMode(estimate) === 'direct'
  const overheadPerM = isDirectOverhead
    ? new Decimal(estimate.overheadOverridePerM ?? 0)
    : new Decimal(calculatedOverheadPerM)
  // ── Capacity Dynamics ─────────────────────────────────────
  const workingDays = estimate.monthlyWorkingDays || 26
  const ratedCapacityM = new Decimal(estimate.loomCount || 0).times(estimate.avgOutputPerLoomPerDay || 0).times(workingDays)
  const overheadPerMAtCapacity = ratedCapacityM.gt(0) ? new Decimal(overheadTotalMonthly).div(ratedCapacityM) : new Decimal(0)
  const capacityUtilisationPct = ratedCapacityM.gt(0) ? new Decimal(estimate.monthlyOutputM).div(ratedCapacityM).times(100) : new Decimal(0)
  
  // Cost of Idle Capacity: Actual Overhead Paid - Overhead recovered if run at capacity
  const costOfIdleCapacityMonthly = Decimal.max(0, new Decimal(overheadTotalMonthly).times(new Decimal(1).minus(capacityUtilisationPct.div(100))))

  const totalProductionCostPerM = directCostPerM.plus(overheadPerM)

  // ── Beam Capacity Preview ───────────────────────────────────────────────
  // Tape length is the consumed warp length.  With c% take-up, each metre of
  // finished cloth consumes (1 + c/100) metres of warp, so capacity is a
  // division. Multiplying by (1 - c/100) increasingly understates capacity as
  // crimp rises (for example 1,000 m at 5% is 952.381 m, not 950 m).
  const crimpFactor = new Decimal(1).plus(new Decimal(estimate.warpCrimpPct || 0).div(100))
  const estimatedBeamCapacityM = crimpFactor.gt(0)
    ? new Decimal(estimate.tapeLengthM).div(crimpFactor).toNumber()
    : 0

  const commercialInputs = getEffectiveCommercialInputs(estimate)
  const orderQuote = calcOrderQuote({
    totalProductionCostPerM: totalProductionCostPerM.toNumber(),
    orderQuantityM:  estimate.orderQuantityM || 0,
    commissionPct:   commercialInputs.commissionPct,
    transportPerM:   commercialInputs.transportPerM,
    profitMarginPct: estimate.profitPct,
  })

  const toYarnLayerAudit = (row: WarpRowResult | WeftRowResult, fallbackName: string): EstimatorYarnLayerAudit => {
    const isWarp = 'beamEnds' in row
    return {
      id: row.id,
      name: row.label?.trim() || fallbackName,
      mode: row.mode,
      formulaDescription: row.linearDensityUnit === 'cotton_count_ne'
        ? (isWarp
            ? '(5315 ÷ Ne) × beam ends / 90000'
            : '(5315 ÷ Ne) × PPI × effective width inches / 90000')
        : (isWarp
            ? 'denier × beam ends / 90000'
            : 'denier × PPI × effective width inches / 90000'),
      calcDenier: row.calcDenier,
      beamEnds: isWarp ? row.beamEnds : null,
      picks: 'picks' in row ? row.picks : null,
      effectiveCostingWidthInches: 'effectiveCostingWidthInches' in row ? row.effectiveCostingWidthInches : null,
      formulaKgPer100m: row.formulaKgPer100m,
      manualKgPer100m: row.manualKgPer100m ?? null,
      baseKgPer100mUsed: row.baseKgPer100mUsed,
      crimpPct: row.crimpPct,
      wastePct: row.wastePct,
      defaultWastePct: row.defaultWastePct,
      wastePctSource: row.wastePctSource,
      totalAdjustmentPct: row.totalAdjustmentPct,
      finalKgPer100m: row.finalKgPer100m,
      ratePerKg: row.ratePerKg,
      gstPct: row.gstPct,
      costPerMeter: row.costPerMeter,
    }
  }

  const postProcessingCostPerMeter = windingPerM.plus(processingPerM).plus(finishingPerM)
  const audit: EstimatorCostAudit = {
    warp: {
      layers: warpRows.map((row, index) => toYarnLayerAudit(row, `Warp layer ${index + 1}`)),
      totalCostPerMeter: warpCostPerM.toNumber(),
    },
    weft: {
      layers: weftRows.map((row, index) => toYarnLayerAudit(row, `Weft layer ${index + 1}`)),
      totalCostPerMeter: weftCostPerM.toNumber(),
    },
    yarnBaseCostPerMeter: yarnBaseWarpPerM.plus(yarnBaseWeftPerM).toNumber(),
    yarnAdjustmentCostPerMeter: yarnShortageCostPerM.toNumber(),
    yarnTotalCostPerMeter: warpCostPerM.plus(weftCostPerM).toNumber(),
    weaveCostPerMeter: weaveCostPerM.toNumber(),
    warpingAndSizingCostPerMeter: warpingAndSizingPerM.toNumber(),
    overheadCostPerMeter: overheadPerM.toNumber(),
    postProcessingCostPerMeter: postProcessingCostPerMeter.toNumber(),
    logisticsCostPerMeter: estimate.enabledSections.transport ? Number(estimate.transportPerM || 0) : 0,
    directCostPerMeter: directCostPerM.toNumber(),
    productionCostPerMeter: totalProductionCostPerM.toNumber(),
  }

  return {
    warpRows,
    weftRows,
    warpCostPerM:            warpCostPerM.toNumber(),
    weftCostPerM:            weftCostPerM.toNumber(),
    yarnBaseWarpPerM:        yarnBaseWarpPerM.toNumber(),
    yarnBaseWeftPerM:        yarnBaseWeftPerM.toNumber(),
    yarnShortageCostPerM:    yarnShortageCostPerM.toNumber(),
    weaveCostPerM:           weaveCostPerM.toNumber(),
    warpingAndSizingPerM:    warpingAndSizingPerM.toNumber(),
    windingPerM:             windingPerM.toNumber(),
    processingPerM:          processingPerM.toNumber(),
    finishingPerM:           finishingPerM.toNumber(),
    directCostPerM:          directCostPerM.toNumber(),
    overheadPerM:            overheadPerM.toNumber(),
    overheadTotalMonthly,
    overheadPerMAtCapacity:  overheadPerMAtCapacity.toNumber(),
    ratedCapacityM:          ratedCapacityM.toNumber(),
    capacityUtilisationPct:  capacityUtilisationPct.toNumber(),
    costOfIdleCapacityMonthly: costOfIdleCapacityMonthly.toNumber(),
    totalProductionCostPerM: totalProductionCostPerM.toNumber(),
    totalWarpKgPer100m:      totalWarpKgPer100m.toNumber(),
    totalAllYarnKgPer100m:   totalAllYarnKgPer100m.toNumber(),
    estimatedBeamCapacityM,
    orderQuote,
    resolvedItems,
    audit,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS (Surat standard polyester georgette baseline)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_WARP_ROW: Omit<WarpRow, 'id'> = {
  label:       'Warp 1',
  calculationMode: 'formula',
  manualKgPer100m: null,
  linearDensityUnit: 'denier',
  cottonCountNe: null,
  calcDenier:  0,
  beamEnds:    0,
  yarnRate:    0,
  gstPct:      0,
  shortagePct: null,
}

export const DEFAULT_WEFT_ROW: Omit<WeftRow, 'id'> = {
  label:       'Weft 1',
  calculationMode: 'formula',
  manualKgPer100m: null,
  linearDensityUnit: 'denier',
  cottonCountNe: null,
  picks:       0,
  reedSpace:   0,   // legacy effective costing width in cm
  effectiveCostingWidthCm: null,
  calcDenier:  0,
  yarnRate:    0,
  gstPct:      0,
  shortagePct: null,
}

export const DEFAULT_FACTORY_SECTIONS: FactorySections = {
  winding:    false,
  processing: false,
  finishing:  false,
  commission: false,
  transport:  false,
}

/** Default overhead items — shown before fixed workers are loaded from DB */
export const DEFAULT_OVERHEAD_ITEMS: Omit<OverheadItem, 'id'>[] = [
  { label: 'Rent / Lease',         monthlyAmount: 0, source: 'manual', category: 'rent', isPreset: true, isLocked: false },
  { label: 'Electricity',           monthlyAmount: 0, source: 'manual', category: 'electricity', isPreset: true, isLocked: false },
  { label: 'Water & Maintenance',   monthlyAmount: 0,  source: 'manual', category: 'water', isPreset: true, isLocked: false },
  { label: 'Factory Consumables',   monthlyAmount: 0,  source: 'manual', category: 'custom', isPreset: true, isLocked: false },
]

export function makeDefaultEstimateState(): EstimateState {
  return {
    warpRows:           [{ id: nanoid(), ...DEFAULT_WARP_ROW }],
    weftRows:           [{ id: nanoid(), ...DEFAULT_WEFT_ROW }],
    tapeLengthM:        0,
    perPickCostPaisa:   0,
    warpingRatePerKg:   0,
    sizingRatePerKg:    0,
    windingRatePerKg:   0,
    processingRatePerM: 0,
    finishingRatePerM:  0,
    yarnShortagePct:    0,  // default waste — applied per-row when row's shortagePct is null
    warpCrimpPct:       5.0, // default 5% take-up
    overheadItems:      DEFAULT_OVERHEAD_ITEMS.map(item => ({ ...item, id: nanoid() })),
    monthlyOutputM:     0,
    overheadOverridePerM: null,
    overheadMode:        'monthly_expenses',
    loomCount:          0,
    avgOutputPerLoomPerDay: 50,
    monthlyWorkingDays:  26,
    // ── Loom Type defaults ────────────────────────────────────────────────
    loomType:              null,   // no loom type selected = owner must choose
    loomRpm:               null,
    loomPowerKw:           null,
    loomRpmIsCustomised:   false,
    loomPowerKwIsCustomised: false,
    hoursPerShift:         12,     // 12h default; editable for 8h single-shift factories
    // ── Sizing Mode ───────────────────────────────────────────────────────
    sizingMode:            'in_house', // safe default: no cost increase on existing estimates
    // ─────────────────────────────────────────────────────────────────────
    overheadPct:        0,   // legacy compatibility only
    commissionPct:      0,
    transportPerM:      0,
    profitPct:          0,
    orderQuantityM:     null,
    enabledSections:    { ...DEFAULT_FACTORY_SECTIONS },
    isConfigured:       false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO / STRESS TEST ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export interface ScenarioResult {
  id:           string    // unique key for React rendering
  label:        string    // e.g. "Yarn +10%"
  description:  string    // short explanation of what changed
  totalProductionCostPerM: number
  quotePricePerM:          number | null  // null when no order qty
  costDelta:               number         // vs baseline production cost
  costDeltaPct:            number         // % change vs baseline
  profitDelta:             number | null  // vs baseline profit (null when no order qty)
}

/**
 * Run 4 pricing risk scenarios against the current estimate baseline.
 * All computation is client-side — no server round-trips needed.
 *
 * Scenarios:
 *   1. Yarn +10%       — all warp/weft yarn rates increase 10%
 *   2. Output -15%     — factory monthly output drops 15% → overhead rises
 *   3. Break-even      — what margin % gives exactly ₹0 profit
 *   4. Custom target   — given a specific quote price, what's the resulting margin
 */
export function runScenarios(
  baseline: EstimateState,
  baselineTotals: EstimatorV3Totals,
  customTargetPrice?: number
): ScenarioResult[] {
  const results: ScenarioResult[] = []

  // ── 1. Yarn +10% ────────────────────────────────────────────────────────
  const yarnUpState: EstimateState = {
    ...baseline,
    warpRows: baseline.warpRows.map(r => ({ ...r, yarnRate: new Decimal(r.yarnRate).times(1.10).toNumber() })),
    weftRows: baseline.weftRows.map(r => ({ ...r, yarnRate: new Decimal(r.yarnRate).times(1.10).toNumber() })),
  }
  const yarnUpTotals = calcFullTotals(yarnUpState)
  const yarnUpCostDelta = new Decimal(yarnUpTotals.totalProductionCostPerM).minus(baselineTotals.totalProductionCostPerM)
  results.push({
    id:          'yarn-up-10',
    label:       'Yarn +10%',
    description: 'All yarn rates increase by 10%',
    totalProductionCostPerM: yarnUpTotals.totalProductionCostPerM,
    quotePricePerM: yarnUpTotals.orderQuote?.quotePricePerM ?? null,
    costDelta:   yarnUpCostDelta.toNumber(),
    costDeltaPct: baselineTotals.totalProductionCostPerM > 0
      ? yarnUpCostDelta.div(baselineTotals.totalProductionCostPerM).times(100).toNumber()
      : 0,
    profitDelta: yarnUpTotals.orderQuote && baselineTotals.orderQuote
      ? new Decimal(yarnUpTotals.orderQuote.grossProfitRupees).minus(baselineTotals.orderQuote.grossProfitRupees).toNumber()
      : null,
  })

  // ── 2. Output -15% ──────────────────────────────────────────────────────
  const outputDownState: EstimateState = {
    ...baseline,
    monthlyOutputM: Math.max(1, new Decimal(baseline.monthlyOutputM).times(0.85).toNumber()),
  }
  const outputDownTotals = calcFullTotals(outputDownState)
  const outputDownCostDelta = new Decimal(outputDownTotals.totalProductionCostPerM).minus(baselineTotals.totalProductionCostPerM)
  results.push({
    id:          'output-down-15',
    label:       'Output -15%',
    description: 'Monthly output drops 15% — overhead per metre rises',
    totalProductionCostPerM: outputDownTotals.totalProductionCostPerM,
    quotePricePerM: outputDownTotals.orderQuote?.quotePricePerM ?? null,
    costDelta:   outputDownCostDelta.toNumber(),
    costDeltaPct: baselineTotals.totalProductionCostPerM > 0
      ? outputDownCostDelta.div(baselineTotals.totalProductionCostPerM).times(100).toNumber()
      : 0,
    profitDelta: outputDownTotals.orderQuote && baselineTotals.orderQuote
      ? new Decimal(outputDownTotals.orderQuote.grossProfitRupees).minus(baselineTotals.orderQuote.grossProfitRupees).toNumber()
      : null,
  })

  // ── 3. Break-even margin ────────────────────────────────────────────────
  // Solve for the selling price where gross profit is exactly ₹0.  This is
  // not the landed cost of the baseline target-margin quote.
  if (baselineTotals.orderQuote) {
    const commercialInputs = getEffectiveCommercialInputs(baseline)
    const breakEvenPricePerM = calculateBreakEvenPricePerM(
      baselineTotals.totalProductionCostPerM,
      commercialInputs.transportPerM,
      commercialInputs.commissionPct,
    )
    results.push({
      id:          'break-even',
      label:       'Break-even',
      description: 'Minimum selling price after transport and commission at 0% margin',
      totalProductionCostPerM: baselineTotals.totalProductionCostPerM,
      quotePricePerM: breakEvenPricePerM,
      costDelta:   0, // production cost doesn't change
      costDeltaPct: 0,
      profitDelta: baselineTotals.orderQuote
        ? new Decimal(0).minus(baselineTotals.orderQuote.grossProfitRupees).toNumber()
        : null,
    })
  }

  // ── 4. Custom target price ──────────────────────────────────────────────
  // Owner enters a price the party demanded — what's the resulting margin?
  if (customTargetPrice != null && customTargetPrice > 0 && baselineTotals.orderQuote) {
    const P = new Decimal(baselineTotals.totalProductionCostPerM)
    const commercialInputs = getEffectiveCommercialInputs(baseline)
    const T = new Decimal(commercialInputs.transportPerM)
    const C = new Decimal(commercialInputs.commissionPct).div(100)
    const targetPrice = new Decimal(customTargetPrice)

    const commissionPerM = targetPrice.times(C)
    const landedCostPerM = P.plus(T).plus(commissionPerM)
    const profitPerM = targetPrice.minus(landedCostPerM)

    const impliedMarginPct = targetPrice.gt(0)
      ? profitPerM.div(targetPrice).times(100)
      : new Decimal(0)

    const orderQty   = new Decimal(baseline.orderQuantityM ?? 0)
    const totalValue = targetPrice.times(orderQty)
    const totalCost  = landedCostPerM.times(orderQty)
    const grossProfit = totalValue.minus(totalCost)

    results.push({
      id:          'custom-target',
      label:       `Target ₹${customTargetPrice.toFixed(2)}/m`,
      description: `If party forces ₹${customTargetPrice.toFixed(2)}/m — margin = ${impliedMarginPct.toFixed(1)}%`,
      totalProductionCostPerM: baselineTotals.totalProductionCostPerM,
      quotePricePerM: customTargetPrice,
      costDelta:   0,
      costDeltaPct: 0,
      profitDelta: baselineTotals.orderQuote
        ? grossProfit.minus(baselineTotals.orderQuote.grossProfitRupees).toNumber()
        : null,
    })
  }

  return results
}
