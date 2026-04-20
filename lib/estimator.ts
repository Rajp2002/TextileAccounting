/**
 * lib/estimator.ts — Loomi Estimator V3 (Clean Break)
 *
 * Complete rewrite. All V1 code (calculateLandedCost, runStressTests,
 * DEFAULT_ESTIMATOR_INPUTS) has been removed. calcFullTotals is the
 * only math engine in this file.
 *
 * COST STACK (per metre of finished fabric):
 *   Layer 1: Warp yarn     = Σ (beamEnds × calcDenier × (1 + warpCrimpPct/100) × rate × GST × shortage)
 *             ↑ warpCrimpPct accounts for yarn take-up: 6% crimp → 1.06m yarn per 1m cloth
 *   Layer 2: Weft yarn     = Σ (picks × reedSpace × calcDenier × rate × GST × shortage)
 *   Layer 3: Weave cost    = picks(PPI) × perPickCostPaisa
 *   Layer 4: Warping+Sizing= totalWarpKg × (warpingRate + sizingRate) / 100
 *   Layer 5: Winding       = totalAllYarnKg × windingRate / 100  [optional]
 *   Layer 6: Processing    = processingRatePerM  [optional, flat ₹/m]
 *   Layer 7: Finishing     = finishingRatePerM   [optional, flat ₹/m]
 *            directCost    = Layers 1–7
 *   Layer 8: Overhead      = Σ(overheadItems[i].monthlyAmount) / monthlyOutputM
 *              (sum of all fixed monthly factory costs divided by monthly output metres)
 *              effectiveOverheadPct = (overheadPerM / directCostPerM) × 100  [display only]
 *   ─────────────────────────────────────────────────────
 *   totalProductionCostPerM = directCost + overhead
 *
 * ORDER QUOTE (applied after production cost is known):
 *   landedCostPerM  = totalProductionCostPerM × (1 + commissionPct/100) + transportPerM
 *   quotePricePerM  = landedCostPerM × (1 + profitMarginPct/100)
 */

import { nanoid } from 'nanoid'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** One component of a blended warp (e.g. "3444 ends of 75D main + 84 ends of selvedge") */
export interface WarpRow {
  id: string
  label?: string        // optional display label e.g. "Main", "Selvedge"
  calcDenier: number    // effective denier after doubling (e.g. 75/2 → 37.5)
  beamEnds: number      // ends for THIS row only — discrete per component
  yarnRate: number      // ₹/kg market rate for this yarn
  gstPct: number        // GST % on this specific yarn (different materials = different brackets)
  shortagePct: number | null // shortage/wastage % for this component (null = global fallback, 0 = intentional zero)
}

/** One weft component (fabrics can have multi-pick weft blends) */
export interface WeftRow {
  id: string
  label?: string
  picks: number         // picks per inch (PPI) — industry standard in Surat
  reedSpace: number     // finished CLOTH width in cm (not loom/reed width)
                        // Use the actual output cloth width — narrower than loom due to crimp
  calcDenier: number    // effective weft yarn denier
  yarnRate: number      // ₹/kg
  gstPct: number
  shortagePct: number | null
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

/** Complete client-side estimate state (what the estimator page manages) */
export interface EstimateState {
  warpRows:            WarpRow[]
  weftRows:            WeftRow[]
  tapeLengthM:         number          // metres per beam tape (for beam capacity preview)
  perPickCostPaisa:    number          // loom charge in paise per pick (e.g. 0.16)
  warpingRatePerKg:    number          // ₹/kg charged by warping unit
  sizingRatePerKg:     number          // ₹/kg charged by sizing unit
  windingRatePerKg:    number          // ₹/kg charged for rewinding (0 if not applicable)
  processingRatePerM:  number          // flat ₹/m for dyeing/printing
  finishingRatePerM:   number          // flat ₹/m for calendering/heat-setting
  // ── Yarn shortage — applied to combined warp+weft total ──────────────────
  yarnShortagePct:     number          // single shortage % applied after summing all yarn costs
  warpCrimpPct:        number          // warp take-up % for accurate beam capacity calculation
  // ── Overhead V2: itemized breakdown ─────────────────────────────────────
  overheadItems:       OverheadItem[]  // list of monthly fixed cost line items
  monthlyOutputM:      number          // estimated metres produced per month (denominator)
  overheadOverridePerM: number | null  // when set, bypasses the itemized calc entirely
  // ── Factory Capacity Configuration ──────────────────────────────────────
  loomCount:           number          // total active looms in factory
  avgOutputPerLoomPerDay: number       // e.g. 50m for waterjets, 25m for rapier
  monthlyWorkingDays:  number          // default 26
  outputSuggestion?: {
    avg30Days: number
    avg90Days: number
    lastUpdated: string
  }
  // ── kept for backward-compat serialisation (computed, never user-edited) ─
  overheadPct:         number          // effective overhead % — derived from items/denominator
  // ────────────────────────────────────────────────────────────────────────
  commissionPct:       number          // selling commission %
  transportPerM:       number          // transport cost ₹/m
  profitPct:           number          // desired profit margin %
  orderQuantityM:      number | null   // null = order module not yet activated
  enabledSections:     FactorySections
}

/** Warp row after formula has been applied */
export interface WarpRowResult extends WarpRow {
  kgPer100m:        number   // raw yarn kg per 100m of fabric
  costPer100m:      number   // ₹ per 100m (GST + shortage inclusive)
  shortagePctUsed:  number   // effective shortage % applied (row-level or global fallback)
  shortageCostPer100m: number // rupee contribution of shortage for this row
}

/** Weft row after formula has been applied */
export interface WeftRowResult extends WeftRow {
  kgPer100m:        number
  costPer100m:      number
  shortagePctUsed:  number
  shortageCostPer100m: number
}

/** Output of calcOrderQuote when order quantity is known */
export interface OrderQuote {
  landedCostPerM:     number   // production cost + commission % + transport
  quotePricePerM:     number   // what the owner tells the buyer
  totalOrderValue:    number   // quotePricePerM × orderQuantityM
  grossProfitRupees:  number   // totalOrderValue − landed cost × qty
  actualMarginPct:    number   // gross profit as % of total order value
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
  effectiveOverheadPct:    number   // overheadPerM / directCostPerM × 100 (display only)
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
  return (beamEnds * calcDenier * 100) / 9_000_000
}

/**
 * Weft yarn weight per 100m of finished fabric.
 *
 * Formula: (picks × clothWidth × calcDenier × 100) / 9_000_000
 *   - picks     = picks per INCH (PPI) — standard Surat unit
 *   - clothWidth = FINISHED cloth output width in cm (NOT loom/reed width)
 *
 * IMPORTANT: Use the actual output cloth width, not the loom reed width.
 * The loom reed may be 96–120cm wide but the cloth output is typically
 * 60–80cm due to warp/weft crimp. Using reed width over-estimates weft
 * consumption by ~20–35%.
 *
 *   Per 1m fabric length: picks × (clothWidth/100) m of weft thread
 *   × 100 (per-100m) ÷ 9000 (denier→g/m) ÷ 1000 (g→kg)
 *
 * @param picks      - picks per inch (PPI)
 * @param clothWidth - finished cloth output width in cm
 * @param calcDenier - effective weft yarn denier
 * @returns kg per 100m
 */
export function calcWeftYarnKg(picks: number, clothWidth: number, calcDenier: number): number {
  return (picks * clothWidth * calcDenier * 100) / 9_000_000
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
  const rateWithGst = yarnRate * (1 + gstPct / 100)
  return kgPer100m * rateWithGst * (1 + shortagePct / 100)
}

/**
 * Weave cost per metre of finished fabric.
 *
 * The confirmed Surat formula — NO reed space multiplication.
 * The per-pick rate inherently accounts for the standard machine width.
 *
 * Formula: picks (PPI) × perPickCostPaisa
 *   e.g. 68 picks × 0.16 paise = ₹10.88 / m
 *
 * @param picks            - picks per inch (PPI)
 * @param perPickCostPaisa - loom charge in paise per pick (₹ × 100)
 * @returns ₹ per metre
 */
export function calcWeaveCostPerMeter(picks: number, perPickCostPaisa: number): number {
  return picks * perPickCostPaisa
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
  return (totalWarpKgPer100m * (warpingRatePerKg + sizingRatePerKg)) / 100
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
  return (totalAllYarnKgPer100m * windingRatePerKg) / 100
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
export function ensureOverheadIntegrity(items: any[]): OverheadItem[] {
  if (!Array.isArray(items)) return []
  return items.map(item => ({
    id:            item.id || nanoid(),
    label:         item.label || 'Unnamed Item',
    monthlyAmount: Number(item.monthlyAmount || 0),
    category:      item.category || 'custom',
    isPreset:      item.isPreset ?? false,
    isLocked:      item.isLocked ?? false,
    source:        item.source || 'manual',
    workerId:      item.workerId || undefined,
    meta:          item.meta || undefined
  }))
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
  const totalMonthly = resolvedItems.reduce((sum, item) => sum + (item.monthlyAmount || 0), 0)
  const overheadPerM = monthlyOutputM > 0 ? totalMonthly / monthlyOutputM : 0
  return { overheadPerM, totalMonthly, resolvedItems }
}

/**
 * Order-level quote calculations.
 * Only called when the owner has entered an order quantity.
 *
 * landedCostPerM  = production × (1 + commission%) + transport
 * quotePricePerM  = landedCost × (1 + margin%)
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

  const landedCostPerM   = totalProductionCostPerM * (1 + commissionPct / 100) + transportPerM
  const quotePricePerM   = landedCostPerM * (1 + profitMarginPct / 100)
  const totalOrderValue  = quotePricePerM * orderQuantityM
  const totalCost        = landedCostPerM * orderQuantityM
  const grossProfitRupees = totalOrderValue - totalCost
  const actualMarginPct  = totalOrderValue > 0 ? (grossProfitRupees / totalOrderValue) * 100 : 0

  return { landedCostPerM, quotePricePerM, totalOrderValue, grossProfitRupees, actualMarginPct }
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
    return (meta.unitsPerLoomPerMonth || 0) * loomCount * (meta.ratePerUnit || 0)
  }

  if (meta.type === 'depreciation') {
    const totalValue = loomCount * (meta.avgCostPerLoom || 0)
    const annualDepr = totalValue / (meta.usefulLifeYears || 10)
    return annualDepr / 12
  }

  return item.monthlyAmount
}

export function calcFullTotals(estimate: EstimateState): EstimatorV3Totals {
  const globalShortage = estimate.yarnShortagePct ?? 0
  const warpCrimpPct = estimate.warpCrimpPct || 0;

  // ── Layer 1: Warp Yarn (Additive shortage applied) ──────────────
  // Each row uses its own shortagePct; falls back to the global yarnShortagePct.
  // We use additive logic: Total Shortage = Crimp % + Waste %.
  // The cost directly multiples base kg * total shortage.
  const warpRows: WarpRowResult[] = estimate.warpRows.map(r => {
    const baseKg          = calcWarpYarnKg(r.beamEnds, r.calcDenier);
    const shortagePctUsed = (r.shortagePct !== null && r.shortagePct !== undefined) ? r.shortagePct : globalShortage;
    const totalShortagePct = warpCrimpPct + shortagePctUsed;
    
    // To match Surat manual paper calculations exactly (where a '1.1 multiplier' applies equally to sizing cost)
    // Both crimp and waste contribute to the gross weight sent to Sizing and Warping.
    const kgPer100m       = baseKg * (1 + totalShortagePct / 100);

    const costPer100m     = calcYarnCost(baseKg, r.yarnRate, r.gstPct, totalShortagePct);
    const baseCostPer100m = calcYarnCost(baseKg, r.yarnRate, r.gstPct, 0);
    const shortageCostPer100m = costPer100m - baseCostPer100m;
    
    return { ...r, kgPer100m, costPer100m, shortagePctUsed, shortageCostPer100m }
  })

  // ── Layer 2: Weft Yarn (Additive shortage applied) ───────────────────────
  const weftRows: WeftRowResult[] = estimate.weftRows.map(r => {
    const baseKg          = calcWeftYarnKg(r.picks, r.reedSpace, r.calcDenier)
    const shortagePctUsed = (r.shortagePct !== null && r.shortagePct !== undefined) ? r.shortagePct : globalShortage;
    const totalShortagePct = shortagePctUsed; // Weft usually has 0% crimp, only waste

    // Ensure weft contributes to total winding weight with the same '1.1 multiplier' safety net
    const kgPer100m       = baseKg * (1 + totalShortagePct / 100);

    const costPer100m     = calcYarnCost(baseKg, r.yarnRate, r.gstPct, totalShortagePct);
    const baseCostPer100m = calcYarnCost(baseKg, r.yarnRate, r.gstPct, 0);
    const shortageCostPer100m = costPer100m - baseCostPer100m;
    
    return { ...r, kgPer100m, costPer100m, shortagePctUsed, shortageCostPer100m }
  })

  const totalWarpKgPer100m    = warpRows.reduce((s, r) => s + r.kgPer100m, 0)
  const totalWeftKgPer100m    = weftRows.reduce((s, r) => s + r.kgPer100m, 0)
  const totalAllYarnKgPer100m = totalWarpKgPer100m + totalWeftKgPer100m

  // Per-row costs already include shortage — sum directly
  const warpCostPerM = warpRows.reduce((s, r) => s + r.costPer100m, 0) / 100
  const weftCostPerM = weftRows.reduce((s, r) => s + r.costPer100m, 0) / 100

  // Base costs (pre-shortage) for display
  const yarnBaseWarpPerM = warpRows.reduce((s, r) => s + calcYarnCost(r.kgPer100m, r.yarnRate, r.gstPct, 0), 0) / 100
  const yarnBaseWeftPerM = weftRows.reduce((s, r) => s + calcYarnCost(r.kgPer100m, r.yarnRate, r.gstPct, 0), 0) / 100

  // Total shortage cost across all rows: Σ(per-row shortage contributions)
  const yarnShortageCostPerM =
    warpRows.reduce((s, r) => s + r.shortageCostPer100m, 0) / 100 +
    weftRows.reduce((s, r) => s + r.shortageCostPer100m, 0) / 100

  // ── Layer 3: Weave Cost ─────────────────────────────────────────────────
  // Use the total picks from all weft rows (sum of PPI)
  const totalPicks   = estimate.weftRows.reduce((s, r) => s + r.picks, 0)
  const weaveCostPerM = calcWeaveCostPerMeter(totalPicks, estimate.perPickCostPaisa)

  // ── Layer 4: Warping + Sizing ───────────────────────────────────────────
  const warpingAndSizingPerM = calcWarpingCostPerMeter(
    totalWarpKgPer100m,
    estimate.warpingRatePerKg,
    estimate.sizingRatePerKg
  )

  // ── Layer 5: Winding (optional) ─────────────────────────────────────────
  const windingPerM = estimate.enabledSections.winding
    ? calcWindingCostPerMeter(totalAllYarnKgPer100m, estimate.windingRatePerKg)
    : 0

  // ── Layer 6+7: Processing + Finishing (optional) ────────────────────────
  const processingPerM = estimate.enabledSections.processing ? estimate.processingRatePerM : 0
  const finishingPerM  = estimate.enabledSections.finishing  ? estimate.finishingRatePerM  : 0

  // ── Direct Cost (sum of all layers above) ───────────────────────────────
  const directCostPerM =
    warpCostPerM + weftCostPerM + weaveCostPerM +
    warpingAndSizingPerM + windingPerM + processingPerM + finishingPerM

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
  // Direct override takes precedence when set and positive
  const overheadPerM = (estimate.overheadOverridePerM != null && estimate.overheadOverridePerM > 0)
    ? estimate.overheadOverridePerM
    : calculatedOverheadPerM
  // Effective % for display + backward-compat snapshot in saved quotes
  const effectiveOverheadPct = directCostPerM > 0 ? (overheadPerM / directCostPerM) * 100 : 0

  // ── Capacity Dynamics ─────────────────────────────────────
  const workingDays = estimate.monthlyWorkingDays || 26
  const ratedCapacityM = (estimate.loomCount || 0) * (estimate.avgOutputPerLoomPerDay || 0) * workingDays
  const overheadPerMAtCapacity = ratedCapacityM > 0 ? (overheadTotalMonthly / ratedCapacityM) : 0
  const capacityUtilisationPct = ratedCapacityM > 0 ? (estimate.monthlyOutputM / ratedCapacityM) * 100 : 0
  
  // Cost of Idle Capacity: Actual Overhead Paid - Overhead recovered if run at capacity
  const costOfIdleCapacityMonthly = Math.max(0, overheadTotalMonthly * (1 - (capacityUtilisationPct / 100)))

  const totalProductionCostPerM = directCostPerM + overheadPerM

  // ── Beam Capacity Preview ───────────────────────────────────────────────
  // Approximate metres a full beam produces (tape_length reduced by take-up)
  const estimatedBeamCapacityM = estimate.tapeLengthM * (1 - (estimate.warpCrimpPct || 0) / 100)

  // ── Order Quote (only when quantity is set) ─────────────────────────────
  const orderQuote = estimate.orderQuantityM && estimate.orderQuantityM > 0
    ? calcOrderQuote({
        totalProductionCostPerM,
        orderQuantityM:  estimate.orderQuantityM,
        commissionPct:   estimate.enabledSections.commission ? estimate.commissionPct : 0,
        transportPerM:   estimate.enabledSections.transport  ? estimate.transportPerM  : 0,
        profitMarginPct: estimate.profitPct,
      })
    : null

  return {
    warpRows,
    weftRows,
    warpCostPerM,
    weftCostPerM,
    yarnBaseWarpPerM,
    yarnBaseWeftPerM,
    yarnShortageCostPerM,
    weaveCostPerM,
    warpingAndSizingPerM,
    windingPerM,
    processingPerM,
    finishingPerM,
    directCostPerM,
    overheadPerM,
    overheadTotalMonthly,
    effectiveOverheadPct,
    overheadPerMAtCapacity,
    ratedCapacityM,
    capacityUtilisationPct,
    costOfIdleCapacityMonthly,
    totalProductionCostPerM,
    totalWarpKgPer100m,
    totalAllYarnKgPer100m,
    estimatedBeamCapacityM,
    orderQuote,
    resolvedItems,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS (Surat standard polyester georgette baseline)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_WARP_ROW: Omit<WarpRow, 'id'> = {
  calcDenier:  0,
  beamEnds:    0,
  yarnRate:    0,
  gstPct:      0,
  shortagePct: null,
}

export const DEFAULT_WEFT_ROW: Omit<WeftRow, 'id'> = {
  picks:       0,
  reedSpace:   0,   // finished cloth width in cm (not loom reed width, not folded width)
  calcDenier:  0,
  yarnRate:    0,
  gstPct:      0,
  shortagePct: null,
}

export const DEFAULT_FACTORY_SECTIONS: FactorySections = {
  winding:    false,
  processing: false,
  finishing:  false,
  commission: true,
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
    yarnShortagePct:    0,  // default shortage — applied per-row when row's shortagePct is 0
    warpCrimpPct:       5.0, // default 5% take-up
    overheadItems:      DEFAULT_OVERHEAD_ITEMS.map(item => ({ ...item, id: nanoid() })),
    monthlyOutputM:     0,
    overheadOverridePerM: null,
    loomCount:          0,
    avgOutputPerLoomPerDay: 50,
    monthlyWorkingDays:  26,
    overheadPct:        0,   // will be computed — kept for compat
    commissionPct:      0,
    transportPerM:      0,
    profitPct:          0,
    orderQuantityM:     null,
    enabledSections:    { ...DEFAULT_FACTORY_SECTIONS },
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
    warpRows: baseline.warpRows.map(r => ({ ...r, yarnRate: r.yarnRate * 1.10 })),
    weftRows: baseline.weftRows.map(r => ({ ...r, yarnRate: r.yarnRate * 1.10 })),
  }
  const yarnUpTotals = calcFullTotals(yarnUpState)
  results.push({
    id:          'yarn-up-10',
    label:       'Yarn +10%',
    description: 'All yarn rates increase by 10%',
    totalProductionCostPerM: yarnUpTotals.totalProductionCostPerM,
    quotePricePerM: yarnUpTotals.orderQuote?.quotePricePerM ?? null,
    costDelta:   yarnUpTotals.totalProductionCostPerM - baselineTotals.totalProductionCostPerM,
    costDeltaPct: baselineTotals.totalProductionCostPerM > 0
      ? ((yarnUpTotals.totalProductionCostPerM - baselineTotals.totalProductionCostPerM) / baselineTotals.totalProductionCostPerM) * 100
      : 0,
    profitDelta: yarnUpTotals.orderQuote && baselineTotals.orderQuote
      ? yarnUpTotals.orderQuote.grossProfitRupees - baselineTotals.orderQuote.grossProfitRupees
      : null,
  })

  // ── 2. Output -15% ──────────────────────────────────────────────────────
  const outputDownState: EstimateState = {
    ...baseline,
    monthlyOutputM: Math.max(1, baseline.monthlyOutputM * 0.85),
  }
  const outputDownTotals = calcFullTotals(outputDownState)
  results.push({
    id:          'output-down-15',
    label:       'Output -15%',
    description: 'Monthly output drops 15% — overhead per metre rises',
    totalProductionCostPerM: outputDownTotals.totalProductionCostPerM,
    quotePricePerM: outputDownTotals.orderQuote?.quotePricePerM ?? null,
    costDelta:   outputDownTotals.totalProductionCostPerM - baselineTotals.totalProductionCostPerM,
    costDeltaPct: baselineTotals.totalProductionCostPerM > 0
      ? ((outputDownTotals.totalProductionCostPerM - baselineTotals.totalProductionCostPerM) / baselineTotals.totalProductionCostPerM) * 100
      : 0,
    profitDelta: outputDownTotals.orderQuote && baselineTotals.orderQuote
      ? outputDownTotals.orderQuote.grossProfitRupees - baselineTotals.orderQuote.grossProfitRupees
      : null,
  })

  // ── 3. Break-even margin ────────────────────────────────────────────────
  // Find the margin % where gross profit is exactly ₹0 → quotePricePerM = landedCostPerM
  // That means profit margin = 0%. The landed cost IS the break-even price.
  if (baselineTotals.orderQuote) {
    const breakEvenState: EstimateState = { ...baseline, profitPct: 0 }
    const breakEvenTotals = calcFullTotals(breakEvenState)
    results.push({
      id:          'break-even',
      label:       'Break-even',
      description: 'Margin set to 0% — landed cost = quote price',
      totalProductionCostPerM: breakEvenTotals.totalProductionCostPerM,
      quotePricePerM: breakEvenTotals.orderQuote?.quotePricePerM ?? null,
      costDelta:   0, // production cost doesn't change
      costDeltaPct: 0,
      profitDelta: baselineTotals.orderQuote
        ? -baselineTotals.orderQuote.grossProfitRupees
        : null,
    })
  }

  // ── 4. Custom target price ──────────────────────────────────────────────
  // Owner enters a price the party demanded — what's the resulting margin?
  if (customTargetPrice != null && customTargetPrice > 0 && baselineTotals.orderQuote) {
    const landedCost = baselineTotals.orderQuote.landedCostPerM
    const impliedMarginPct = landedCost > 0
      ? ((customTargetPrice - landedCost) / landedCost) * 100
      : 0
    const orderQty   = baseline.orderQuantityM ?? 0
    const totalValue = customTargetPrice * orderQty
    const totalCost  = landedCost * orderQty
    const grossProfit = totalValue - totalCost
    results.push({
      id:          'custom-target',
      label:       `Target ₹${customTargetPrice.toFixed(2)}/m`,
      description: `If party forces ₹${customTargetPrice.toFixed(2)}/m — margin = ${impliedMarginPct.toFixed(1)}%`,
      totalProductionCostPerM: baselineTotals.totalProductionCostPerM,
      quotePricePerM: customTargetPrice,
      costDelta:   0,
      costDeltaPct: 0,
      profitDelta: baselineTotals.orderQuote
        ? grossProfit - baselineTotals.orderQuote.grossProfitRupees
        : null,
    })
  }

  return results
}
