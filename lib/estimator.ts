/**
 * lib/estimator.ts — Vastra Estimator V3 (Clean Break)
 *
 * Complete rewrite. All V1 code (calculateLandedCost, runStressTests,
 * DEFAULT_ESTIMATOR_INPUTS) has been removed. calcFullTotals is the
 * only math engine in this file.
 *
 * COST STACK (per metre of finished fabric):
 *   Layer 1: Warp yarn     = Σ (beamEnds × calcDenier × rate × GST × shortage)
 *   Layer 2: Weft yarn     = Σ (picks × reedSpace × calcDenier × rate × GST × shortage)
 *   Layer 3: Weave cost    = picks(PPI) × perPickCostPaisa
 *   Layer 4: Warping+Sizing= totalWarpKg × (warpingRate + sizingRate) / 100
 *   Layer 5: Winding       = totalAllYarnKg × windingRate / 100  [optional]
 *   Layer 6: Processing    = processingRatePerM  [optional, flat ₹/m]
 *   Layer 7: Finishing     = finishingRatePerM   [optional, flat ₹/m]
 *            directCost    = Layers 1–7
 *   Layer 8: Overhead      = directCost × overheadPct / 100
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
  shortagePct: number   // shortage/wastage % for this component
}

/** One weft component (fabrics can have multi-pick weft blends) */
export interface WeftRow {
  id: string
  label?: string
  picks: number         // picks per inch (PPI) — industry standard in Surat
  reedSpace: number     // fabric width in cm
  calcDenier: number    // effective weft yarn denier
  yarnRate: number      // ₹/kg
  gstPct: number
  shortagePct: number
}

/** Which optional cost sections apply to this factory/estimate */
export interface FactorySections {
  winding:    boolean   // yarn arrives on hanks, needs rewinding onto cones
  processing: boolean   // dyeing / printing
  finishing:  boolean   // calendering, heat-setting
  commission: boolean   // broker/agent involvement
  transport:  boolean   // factory delivers rather than buyer collecting
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
  overheadPct:         number          // overhead as % of direct production cost
  commissionPct:       number          // selling commission %
  transportPerM:       number          // transport cost ₹/m
  profitPct:           number          // desired profit margin %
  orderQuantityM:      number | null   // null = order module not yet activated
  enabledSections:     FactorySections
}

/** Warp row after formula has been applied */
export interface WarpRowResult extends WarpRow {
  kgPer100m:   number   // raw yarn kg per 100m of fabric
  costPer100m: number   // ₹ per 100m (GST + shortage inclusive)
}

/** Weft row after formula has been applied */
export interface WeftRowResult extends WeftRow {
  kgPer100m:   number
  costPer100m: number
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
  warpCostPerM:            number
  weftCostPerM:            number
  weaveCostPerM:           number
  warpingAndSizingPerM:    number
  windingPerM:             number
  processingPerM:          number
  finishingPerM:           number
  directCostPerM:          number
  overheadPerM:            number
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
 * Formula: (picks × reedSpace × calcDenier × 100) / 9_000_000
 *   - picks = picks per INCH (PPI) — standard Surat unit
 *   - Each pick spans reedSpace cm of fabric width
 *   - Per 1m fabric length: picks × (reedSpace/100) m of weft thread
 *   - × 100 (per-100m) ÷ 9000 (denier→g/m) ÷ 1000 (g→kg)
 *   = picks × reedSpace × calcDenier × 100 / 9_000_000
 *
 * @param picks      - picks per inch (PPI)
 * @param reedSpace  - fabric width in cm
 * @param calcDenier - effective weft yarn denier
 * @returns kg per 100m
 */
export function calcWeftYarnKg(picks: number, reedSpace: number, calcDenier: number): number {
  return (picks * reedSpace * calcDenier * 100) / 9_000_000
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
 * Overhead cost per metre.
 * Overhead is a percentage of direct production cost to naturally scale
 * with fabric complexity. A high-picks jacquard uses more overhead than a plain weave.
 *
 * Formula: directCostPerM × (overheadPct / 100)
 *
 * @param directCostPerM - sum of all cost layers before overhead
 * @param overheadPct    - overhead as % of direct cost (e.g. 8 for 8%)
 * @returns ₹ per metre
 */
export function calcOverheadCostPerMeter(directCostPerM: number, overheadPct: number): number {
  return directCostPerM * (overheadPct / 100)
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
export function calcFullTotals(estimate: EstimateState): EstimatorV3Totals {
  // ── Layer 1: Warp Yarn ──────────────────────────────────────────────────
  const warpRows: WarpRowResult[] = estimate.warpRows.map(r => {
    const kgPer100m   = calcWarpYarnKg(r.beamEnds, r.calcDenier)
    const costPer100m = calcYarnCost(kgPer100m, r.yarnRate, r.gstPct, r.shortagePct)
    return { ...r, kgPer100m, costPer100m }
  })

  // ── Layer 2: Weft Yarn ──────────────────────────────────────────────────
  const weftRows: WeftRowResult[] = estimate.weftRows.map(r => {
    const kgPer100m   = calcWeftYarnKg(r.picks, r.reedSpace, r.calcDenier)
    const costPer100m = calcYarnCost(kgPer100m, r.yarnRate, r.gstPct, r.shortagePct)
    return { ...r, kgPer100m, costPer100m }
  })

  const totalWarpKgPer100m    = warpRows.reduce((s, r) => s + r.kgPer100m, 0)
  const totalWeftKgPer100m    = weftRows.reduce((s, r) => s + r.kgPer100m, 0)
  const totalAllYarnKgPer100m = totalWarpKgPer100m + totalWeftKgPer100m

  const warpCostPerM = warpRows.reduce((s, r) => s + r.costPer100m, 0) / 100
  const weftCostPerM = weftRows.reduce((s, r) => s + r.costPer100m, 0) / 100

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

  // ── Layer 8: Overhead (% of direct cost) ───────────────────────────────
  const overheadPerM = calcOverheadCostPerMeter(directCostPerM, estimate.overheadPct)

  const totalProductionCostPerM = directCostPerM + overheadPerM

  // ── Beam Capacity Preview ───────────────────────────────────────────────
  // Approximate metres a full beam tape produces (tape_length for warp direction)
  const estimatedBeamCapacityM = estimate.tapeLengthM

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
    weaveCostPerM,
    warpingAndSizingPerM,
    windingPerM,
    processingPerM,
    finishingPerM,
    directCostPerM,
    overheadPerM,
    totalProductionCostPerM,
    totalWarpKgPer100m,
    totalAllYarnKgPer100m,
    estimatedBeamCapacityM,
    orderQuote,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS (Surat standard polyester georgette baseline)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_WARP_ROW: Omit<WarpRow, 'id'> = {
  calcDenier:  75,
  beamEnds:    3200,
  yarnRate:    107,
  gstPct:      5,
  shortagePct: 5,
}

export const DEFAULT_WEFT_ROW: Omit<WeftRow, 'id'> = {
  picks:       68,
  reedSpace:   110,
  calcDenier:  75,
  yarnRate:    107,
  gstPct:      5,
  shortagePct: 3,
}

export const DEFAULT_FACTORY_SECTIONS: FactorySections = {
  winding:    false,
  processing: false,
  finishing:  false,
  commission: true,
  transport:  false,
}

export function makeDefaultEstimateState(): EstimateState {
  return {
    warpRows:           [{ id: nanoid(), ...DEFAULT_WARP_ROW }],
    weftRows:           [{ id: nanoid(), ...DEFAULT_WEFT_ROW }],
    tapeLengthM:        100,
    perPickCostPaisa:   0.16,
    warpingRatePerKg:   2.00,
    sizingRatePerKg:    1.50,
    windingRatePerKg:   0,
    processingRatePerM: 0,
    finishingRatePerM:  0,
    overheadPct:        8,
    commissionPct:      2,
    transportPerM:      0,
    profitPct:          15,
    orderQuantityM:     null,
    enabledSections:    { ...DEFAULT_FACTORY_SECTIONS },
  }
}
