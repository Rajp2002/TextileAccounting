/**
 * lib/estimator.ts — Vastra Estimator (Surat Weaving Formula v2)
 *
 * Core calculation engine using the actual textile weaving math used
 * in Surat's water-jet and rapier loom factories.
 *
 * COST BREAKDOWN:
 *   1. Material Cost/m  = warp_yarn + weft_yarn  (using denier & ends/picks)
 *   2. Machine Cost/m   = flat ₹/m rate (covers loom, electricity, maintenance)
 *   3. Overhead Cost/m  = daily overhead allocated per active machine / daily meters
 *   4. GST              = optional additive
 *   ─────────────────────────────────────────────────────────────
 *   Quote Price/m       = (Total Cost) × (1 + margin%)
 */

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface EstimatorInputs {
  // ── Yarn Specs ──────────────────────────────────────────────────────────
  /** Actual single-end yarn denier (e.g. 75 for 75D polyester) */
  yarn_denier: number
  /** Calculated/effective denier after doubling (e.g. 75/2 → 37.5, or same as yarn_denier for single yarn) */
  calculated_yarn_denier: number
  /** Total number of warp ends wound on the beam */
  beam_ends: number
  /** Picks per centimeter in the weft direction */
  picks_per_cm: number
  /** Finished fabric width in centimeters */
  reed_space_cm: number
  /** Weft yarn denier (leave same as yarn_denier if warp = weft) */
  weft_denier: number
  /** Length of one full beam tape in meters */
  tape_length_m: number
  /** Combined warp + weft shrinkage percentage (e.g. 5 or 8) */
  shrinkage_pct: number

  // ── Financials ───────────────────────────────────────────────────────────
  /** Current market rate for raw yarn in ₹/kg */
  yarn_rate_per_kg: number
  /** Flat machine charge per meter including electricity (₹/m) */
  machine_rate_per_m: number
  /** Factory total fixed daily overhead in ₹ (rent + admin salaries etc.) */
  daily_overhead: number
  /** Number of active machines to distribute overhead across */
  total_active_machines: number
  /** Desired profit margin percentage */
  margin_pct: number
  /** GST rate percentage (0 if not applicable) */
  gst_pct: number
}

export interface EstimatorResult {
  /** Warp yarn in kg per meter of fabric */
  warp_yarn_kg_per_m: number
  /** Weft yarn in kg per meter of fabric */
  weft_yarn_kg_per_m: number
  /** Total raw yarn kg per meter (pre-shrinkage) */
  total_yarn_kg_per_m: number
  /** Actual yarn needed per meter AFTER accounting for shrinkage loss */
  yarn_kg_per_m_with_shrinkage: number
  /** Raw material cost per meter in ₹ */
  material_cost_per_m: number
  /** Flat machine/loom cost per meter in ₹ */
  machine_cost_per_m: number
  /** Allocated daily overhead per meter in ₹ */
  overhead_cost_per_m: number
  /** Sum of all costs before GST */
  total_cost_per_m: number
  /** GST amount per meter */
  gst_amount_per_m: number
  /** Final landed cost per meter (total + GST) */
  landed_cost_per_m: number
  /** Recommended quote price per meter */
  quote_price_per_m: number
  /** Profit margin in ₹ per meter */
  profit_per_m: number
  /** Estimated meters this beam can produce */
  estimated_beam_meters: number
  /** Total order value at quote price */
  total_order_value: (meters: number) => number
}

// ---------------------------------------------------------------------------
// CORE FORMULA
// ---------------------------------------------------------------------------

/**
 * Calculates the landed cost per meter using the Surat textile weaving formula.
 *
 * WARP yarn weight formula:
 *   Weight (g/m) = (beam_ends × calculated_yarn_denier) / 9000
 *   (Denier = grams per 9000 meters; one end contributes denier/9000 g per meter)
 *
 * WEFT yarn weight formula:
 *   Weight (g/m) = (picks_per_cm × 100 × reed_space_cm/100 × weft_denier) / 9000
 *                = (picks_per_cm × reed_space_cm × weft_denier) / 9000
 *
 * Both are then adjusted for shrinkage loss:
 *   actual_yarn = calculated_yarn / (1 - shrinkage%)
 *
 * This gives us the ACTUAL yarn consumed per meter of finished fabric.
 */
export function calculateLandedCost(inputs: EstimatorInputs): EstimatorResult {
  const {
    calculated_yarn_denier,
    beam_ends,
    picks_per_cm,
    reed_space_cm,
    weft_denier,
    tape_length_m,
    shrinkage_pct,
    yarn_rate_per_kg,
    machine_rate_per_m,
    daily_overhead,
    total_active_machines,
    margin_pct,
    gst_pct,
  } = inputs

  // ── 1. WARP YARN ───────────────────────────────────────────────────────
  // g/m = (ends × denier) / 9000
  const warp_g_per_m = (beam_ends * calculated_yarn_denier) / 9000
  const warp_kg_per_m = warp_g_per_m / 1000

  // ── 2. WEFT YARN ───────────────────────────────────────────────────────
  // Total weft thread length per meter of fabric:
  //   picks_per_cm × 100cm (per meter length) × (reed_space_cm / 100)m (width per pick)
  // Simplifies to: picks_per_cm × reed_space_cm thread-meters per fabric-meter
  // Weight (g/m) = (picks_per_cm × reed_space_cm × weft_denier) / 9000
  const weft_g_per_m = (picks_per_cm * reed_space_cm * weft_denier) / 9000
  const weft_kg_per_m = weft_g_per_m / 1000

  // ── 3. TOTAL YARN (before shrinkage) ───────────────────────────────────
  const total_yarn_kg_per_m = warp_kg_per_m + weft_kg_per_m

  // ── 4. SHRINKAGE ADJUSTMENT ─────────────────────────────────────────────
  // More yarn is loaded than the finished fabric length would suggest.
  // If shrinkage is 5%, we need 1/(1-0.05) = 1.0526× more yarn.
  const shrinkage_factor = 1 / (1 - shrinkage_pct / 100)
  const yarn_kg_per_m_with_shrinkage = total_yarn_kg_per_m * shrinkage_factor

  // ── 5. MATERIAL COST ───────────────────────────────────────────────────
  const material_cost_per_m = yarn_kg_per_m_with_shrinkage * yarn_rate_per_kg

  // ── 6. MACHINE COST ────────────────────────────────────────────────────
  // Flat rate — covers electricity, loom depreciation, maintenance
  const machine_cost_per_m_val = machine_rate_per_m

  // ── 7. OVERHEAD ALLOCATION ──────────────────────────────────────────────
  // Overhead is the daily fixed cost divided across all active machines.
  // Each machine is responsible for 1 share. Within that share, cost is
  // attributed per meter produced (use a standard ~100m/day/machine default
  // when we don't have live data; owners set actual numbers in settings).
  const STANDARD_DAILY_METERS_PER_MACHINE = 100 // conservative benchmark
  const machines = Math.max(total_active_machines, 1)
  const overhead_per_machine_per_day = daily_overhead / machines
  const overhead_cost_per_m =
    overhead_per_machine_per_day / STANDARD_DAILY_METERS_PER_MACHINE

  // ── 8. TOTAL COST ──────────────────────────────────────────────────────
  const total_cost_per_m =
    material_cost_per_m + machine_cost_per_m_val + overhead_cost_per_m

  // ── 9. GST ─────────────────────────────────────────────────────────────
  const gst_amount_per_m = total_cost_per_m * (gst_pct / 100)
  const landed_cost_per_m = total_cost_per_m + gst_amount_per_m

  // ── 10. QUOTE PRICE & PROFIT ───────────────────────────────────────────
  const quote_price_per_m = landed_cost_per_m * (1 + margin_pct / 100)
  const profit_per_m = quote_price_per_m - landed_cost_per_m

  // ── 11. BEAM CAPACITY ──────────────────────────────────────────────────
  // Meters this beam can produce based on tape_length and shrinkage
  const estimated_beam_meters = tape_length_m * (1 - shrinkage_pct / 100)

  return {
    warp_yarn_kg_per_m: warp_kg_per_m,
    weft_yarn_kg_per_m: weft_kg_per_m,
    total_yarn_kg_per_m,
    yarn_kg_per_m_with_shrinkage,
    material_cost_per_m,
    machine_cost_per_m: machine_cost_per_m_val,
    overhead_cost_per_m,
    total_cost_per_m,
    gst_amount_per_m,
    landed_cost_per_m,
    quote_price_per_m,
    profit_per_m,
    estimated_beam_meters,
    total_order_value: (meters: number) => meters * quote_price_per_m,
  }
}

// ---------------------------------------------------------------------------
// STRESS TESTS
// ---------------------------------------------------------------------------

export interface StressTestResult {
  scenario: string
  cost_per_m: number
  delta: number
}

export function runStressTests(inputs: EstimatorInputs): StressTestResult[] {
  const base = calculateLandedCost(inputs)

  return [
    {
      scenario: 'Yarn +5% price hike',
      cost_per_m: calculateLandedCost({
        ...inputs,
        yarn_rate_per_kg: inputs.yarn_rate_per_kg * 1.05,
      }).landed_cost_per_m,
      delta:
        calculateLandedCost({
          ...inputs,
          yarn_rate_per_kg: inputs.yarn_rate_per_kg * 1.05,
        }).landed_cost_per_m - base.landed_cost_per_m,
    },
    {
      scenario: 'Shrinkage +3% worse than expected',
      cost_per_m: calculateLandedCost({
        ...inputs,
        shrinkage_pct: inputs.shrinkage_pct + 3,
      }).landed_cost_per_m,
      delta:
        calculateLandedCost({
          ...inputs,
          shrinkage_pct: inputs.shrinkage_pct + 3,
        }).landed_cost_per_m - base.landed_cost_per_m,
    },
    {
      scenario: 'Machine rate up ₹0.50/m',
      cost_per_m: calculateLandedCost({
        ...inputs,
        machine_rate_per_m: inputs.machine_rate_per_m + 0.5,
      }).landed_cost_per_m,
      delta:
        calculateLandedCost({
          ...inputs,
          machine_rate_per_m: inputs.machine_rate_per_m + 0.5,
        }).landed_cost_per_m - base.landed_cost_per_m,
    },
  ]
}

// ---------------------------------------------------------------------------
// DEFAULT TEMPLATE (Surat standard polyester georgette)
// ---------------------------------------------------------------------------

export const DEFAULT_ESTIMATOR_INPUTS: EstimatorInputs = {
  yarn_denier: 75,
  calculated_yarn_denier: 75,
  beam_ends: 3200,
  picks_per_cm: 23,
  reed_space_cm: 110,
  weft_denier: 75,
  tape_length_m: 100,
  shrinkage_pct: 5,
  yarn_rate_per_kg: 107,
  machine_rate_per_m: 1.50,
  daily_overhead: 0,
  total_active_machines: 24,
  margin_pct: 10,
  gst_pct: 5,
}
