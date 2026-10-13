import {
  allocateWeftPicks,
  getEffectiveCostingWidthCm,
  getWeftPickConvention,
  getEffectiveOverheadMode,
  getEffectiveYarnDenier,
  LOOM_TYPE_DEFAULTS,
  calculateBreakEvenPricePerM,
  type CostingResultSnapshot,
  type EstimatorV3Totals,
  type FactorySections,
  type OverheadItem,
  type EstimateState,
  type WarpRow,
  type WeftRow,
} from './estimator'

export type EstimatorValidationIssue = {
  field: string
  message: string
}

export type EstimatorValidationResult =
  | { valid: true; issues: []; warnings?: EstimatorValidationIssue[] }
  | { valid: false; issues: EstimatorValidationIssue[]; warnings?: EstimatorValidationIssue[] }

export type EstimatorReadinessStatus = 'blocked' | 'warning_ack_required' | 'calculation_required' | 'ready'

export type EstimatorReadinessResult = {
  status: EstimatorReadinessStatus
  canDisplayMoney: boolean
  canPersist: boolean
  issues: EstimatorValidationIssue[]
  warnings: EstimatorValidationIssue[]
}

const MAX_ROWS = 20
const MIN_DENIER = 0.1
const MAX_DENIER = 5_000
const MAX_COTTON_COUNT_NE = 500
const MAX_BEAM_ENDS = 250_000
const MAX_COMMON_BEAM_ENDS = 25_000
const MAX_PICKS = 500
const MIN_WIDTH_CM = 10
const MAX_WIDTH_CM = 300
const MAX_RATE_PER_KG = 1_000_000
const MAX_PERCENT = 100
const MAX_WASTE_PERCENT = 100
const MAX_TAPE_LENGTH_M = 1_000_000
const MAX_PICK_COST = 1_000
const MAX_TARGET_METERS = 100_000_000
const MAX_COST_PER_M = 10_000_000
const MAX_TOTAL_VALUE = Number.MAX_SAFE_INTEGER
const MAX_MONTHLY_AMOUNT = 1_000_000_000
const MAX_OVERHEAD_ITEMS = 100
const MAX_LOOMS = 1_000
const MAX_WORKING_DAYS = 31
const MAX_OUTPUT_PER_LOOM_PER_DAY = 1_000
const MAX_LOOM_RPM = 3_000
const MAX_LOOM_POWER_KW = 100
const MAX_SHIFT_HOURS = 24
const MAX_RATE_WARNING_PER_KG = 1_000
const MAX_COMMON_DENIER = 1_200
const MIN_COMMON_DENIER = 20
const MAX_COMMON_COTTON_COUNT_NE = 120
const MIN_COMMON_COTTON_COUNT_NE = 10
const MAX_COMMON_PICKS = 150
const MIN_COMMON_PICKS = 10
const MAX_COMMON_WIDTH_CM = 203.2
const MIN_COMMON_WIDTH_CM = 76.2
const MAX_COMMON_CRIMP_PCT = 15
const MAX_COMMON_WASTE_PCT = 15
const MAX_COMMON_OUTPUT_PER_LOOM_PER_DAY = 500
export const UNUSUALLY_LOW_DENIER = 20

function formatValidationNumber(value: number): string {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

/**
 * Factory capacity is the denominator for monthly-expense overhead and is
 * also required when the estimate will drive a production workflow. A
 * standalone costing with an explicit direct ₹/m overhead rate does not use
 * loom count or factory capacity in its production-cost formula.
 */
export function requiresFactoryCapacity(
  estimate: Pick<EstimateState, 'overheadMode' | 'overheadOverridePerM'>,
  productionWorkflow = false,
): boolean {
  return productionWorkflow || getEffectiveOverheadMode(estimate) === 'monthly_expenses'
}

/**
 * Free validates without loom capacity. Its input schema accepts manual
 * monthly expenses only, so loom count can never change a Free price, and
 * the Free page has no loom-capacity inputs. Monthly output, the divisor for
 * monthly-expense overhead, stays required by the snapshot validation itself.
 */
export const FREE_ESTIMATE_VALIDATION_OPTIONS = { requireTapeLength: false, requireCapacity: false } as const

export function getYarnDensityWarning(effectiveDenier: number): string | undefined {
  if (!Number.isFinite(effectiveDenier) || effectiveDenier <= 0) {
    return undefined
  }

  if (effectiveDenier < MIN_COMMON_DENIER) {
    return `Unusually low (under ${UNUSUALLY_LOW_DENIER} D). Confirm the yarn numbering and unit.`
  }

  if (effectiveDenier > MAX_COMMON_DENIER) {
    return `Unusually heavy (over ${MAX_COMMON_DENIER} D). Confirm the yarn numbering and unit.`
  }

  return undefined
}

export type FactoryCostProfileInput = {
  warping_rate_per_kg: number
  sizing_rate_per_kg: number
  winding_rate_per_kg: number
  overhead_pct?: number
  overhead_mode?: 'direct' | 'monthly_expenses'
  default_commission_pct: number
  default_margin_pct?: number
  default_transport_per_m: number
  yarn_review_interval_days?: number
  default_processing_rate_per_m?: number
  default_finishing_rate_per_m?: number
  monthly_output_m?: number
  overhead_override_per_m?: number | null
  loom_count?: number
  monthly_working_days?: number
  avg_output_per_loom_per_day?: number
  yarn_shortage_pct?: number
  warp_crimp_pct?: number
  enabled_sections?: FactorySections
  overhead_items?: OverheadItem[]
}

function resultFromIssues(issues: EstimatorValidationIssue[], warnings: EstimatorValidationIssue[] = []): EstimatorValidationResult {
  if (issues.length > 0) {
    return warnings.length > 0 ? { valid: false, issues, warnings } : { valid: false, issues }
  }
  return warnings.length > 0 ? { valid: true, issues: [], warnings } : { valid: true, issues: [] }
}

function addNumberIssue(
  issues: EstimatorValidationIssue[],
  warnings: EstimatorValidationIssue[],
  field: string,
  label: string,
  value: unknown,
  options: {
    min?: number
    hardMin?: number
    max: number
    allowZero?: boolean
    required?: boolean
    warningMin?: number
    warningMax?: number
    warningMessage?: string
  }
) {
  const isBlank = value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
  const numberValue = typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN
  const min = options.min ?? 0
  const hardMin = options.hardMin ?? min
  const lowerBoundText = options.allowZero ? `at least ${min}` : `greater than ${min}`

  if (isBlank) {
    if (options.required) issues.push({ field, message: `${label} is required.` })
    return
  }

  if (!Number.isFinite(numberValue)) {
    issues.push({ field, message: `${label} must be a valid number.` })
    return
  }

  if (options.allowZero ? numberValue < min : numberValue <= min) {
    issues.push({ field, message: `${label} must be ${lowerBoundText}.` })
    return
  }

  if (numberValue < hardMin) {
    issues.push({ field, message: `${label} must be at least ${hardMin}.` })
    return
  }

  if (numberValue > options.max) {
    issues.push({ field, message: `${label} is outside the supported range.` })
    return
  }

  const belowWarning = options.warningMin !== undefined && numberValue < options.warningMin
  const aboveWarning = options.warningMax !== undefined && numberValue > options.warningMax
  if (belowWarning || aboveWarning) {
    warnings.push({
      field,
      message: options.warningMessage ?? `${label} is unusual. Confirm the value before saving.`,
    })
  }
}

function isBlankNumericValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue === 0
}

function isBlankWarpComponent(row: WarpRow): boolean {
  return !row.label?.trim() && [
    row.calcDenier,
    row.cottonCountNe,
    row.beamEnds,
    row.yarnRate,
    row.manualKgPer100m,
  ].every(isBlankNumericValue)
}

function isBlankWeftComponent(row: WeftRow): boolean {
  return !row.label?.trim() && [
    row.picks,
    row.reedSpace,
    row.effectiveCostingWidthCm,
    row.calcDenier,
    row.cottonCountNe,
    row.yarnRate,
    row.manualKgPer100m,
  ].every(isBlankNumericValue)
}

export function validateFactoryCostProfile(input: FactoryCostProfileInput): EstimatorValidationResult {
  const issues: EstimatorValidationIssue[] = []
  const warnings: EstimatorValidationIssue[] = []
  const enabledSections = input.enabled_sections
  addNumberIssue(issues, warnings, 'warping_rate_per_kg', 'Warping rate', input.warping_rate_per_kg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, warnings, 'sizing_rate_per_kg', 'Sizing rate', input.sizing_rate_per_kg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, warnings, 'winding_rate_per_kg', 'Winding rate', input.winding_rate_per_kg, { max: MAX_RATE_PER_KG, allowZero: true })
  const overheadMode = input.overhead_mode
    ?? (input.overhead_override_per_m != null ? 'direct' : 'monthly_expenses')
  if (!['direct', 'monthly_expenses'].includes(overheadMode)) {
    issues.push({ field: 'overhead_mode', message: 'Choose how factory overhead should be calculated.' })
  }
  addNumberIssue(issues, warnings, 'default_commission_pct', 'Default commission %', input.default_commission_pct, { max: 99.99, allowZero: true })
  if (input.default_margin_pct != null) addNumberIssue(issues, warnings, 'default_margin_pct', 'Default margin %', input.default_margin_pct, { max: 99.99, allowZero: true })
  if (input.yarn_review_interval_days != null) {
    if (!Number.isInteger(input.yarn_review_interval_days) || input.yarn_review_interval_days < 1 || input.yarn_review_interval_days > 1095) {
      issues.push({ field: 'yarn_review_interval_days', message: 'Yarn review period must be between 1 and 1095 days.' })
    }
  }
  addNumberIssue(issues, warnings, 'default_transport_per_m', 'Default transport', input.default_transport_per_m, { max: MAX_COST_PER_M, allowZero: true })
  if (input.default_processing_rate_per_m != null || enabledSections?.processing) addNumberIssue(issues, warnings, 'default_processing_rate_per_m', 'Default processing rate', input.default_processing_rate_per_m, { max: MAX_COST_PER_M, allowZero: true })
  if (input.default_finishing_rate_per_m != null || enabledSections?.finishing) addNumberIssue(issues, warnings, 'default_finishing_rate_per_m', 'Default finishing rate', input.default_finishing_rate_per_m, { max: MAX_COST_PER_M, allowZero: true })
  if (input.overhead_override_per_m != null) addNumberIssue(issues, warnings, 'overhead_override_per_m', 'Direct overhead rate', input.overhead_override_per_m, { max: MAX_COST_PER_M, allowZero: true })
  if (overheadMode === 'direct') {
    addNumberIssue(issues, warnings, 'overhead_override_per_m', 'Direct overhead rate', input.overhead_override_per_m, {
      max: MAX_COST_PER_M,
      required: true,
    })
  }
  if (overheadMode === 'monthly_expenses') {
    addNumberIssue(issues, warnings, 'monthly_output_m', 'Standard monthly production', input.monthly_output_m, { max: MAX_TARGET_METERS, required: true })
  }
  if (input.loom_count != null) addNumberIssue(issues, warnings, 'loom_count', 'Loom count', input.loom_count, { max: MAX_LOOMS, allowZero: true })
  if (input.monthly_working_days != null) addNumberIssue(issues, warnings, 'monthly_working_days', 'Monthly working days', input.monthly_working_days, { max: 31 })
  if (input.avg_output_per_loom_per_day != null) addNumberIssue(issues, warnings, 'avg_output_per_loom_per_day', 'Average output per loom per day', input.avg_output_per_loom_per_day, { max: MAX_OUTPUT_PER_LOOM_PER_DAY, warningMax: MAX_COMMON_OUTPUT_PER_LOOM_PER_DAY, warningMessage: 'Output above 500 m per loom per day is unusual. Confirm the loom, shift, and unit.' })
  if (input.yarn_shortage_pct != null) addNumberIssue(issues, warnings, 'yarn_shortage_pct', 'Default yarn waste %', input.yarn_shortage_pct, { max: MAX_WASTE_PERCENT, allowZero: true, warningMax: MAX_COMMON_WASTE_PCT, warningMessage: 'Waste above 15% is unusual. Confirm this is a percentage, not a multiplier.' })
  if (input.warp_crimp_pct != null) addNumberIssue(issues, warnings, 'warp_crimp_pct', 'Warp crimp %', input.warp_crimp_pct, { max: 50, allowZero: true, warningMax: MAX_COMMON_CRIMP_PCT, warningMessage: 'Warp crimp above 15% is unusual. Confirm the fabric construction and unit.' })
  if (input.enabled_sections?.winding && Number(input.winding_rate_per_kg) <= 0) {
    issues.push({ field: 'winding_rate_per_kg', message: 'Enter a winding rate or switch Winding off.' })
  }
  if (input.enabled_sections?.processing && Number(input.default_processing_rate_per_m) <= 0) {
    issues.push({ field: 'default_processing_rate_per_m', message: 'Enter a processing rate or switch Processing / Dyeing off.' })
  }
  if (input.enabled_sections?.finishing && Number(input.default_finishing_rate_per_m) <= 0) {
    issues.push({ field: 'default_finishing_rate_per_m', message: 'Enter a finishing rate or switch Finishing off.' })
  }
  if (input.overhead_items !== undefined) {
    if (!Array.isArray(input.overhead_items)) {
      issues.push({ field: 'overhead_items', message: 'Overhead items must be a list.' })
    } else if (input.overhead_items.length > MAX_OVERHEAD_ITEMS) {
      issues.push({ field: 'overhead_items', message: `Use ${MAX_OVERHEAD_ITEMS} or fewer overhead items.` })
    } else {
      input.overhead_items.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
          issues.push({ field: `overhead_items.${index}`, message: `Overhead item ${index + 1} is invalid.` })
          return
        }
        addNumberIssue(issues, warnings, `overhead_items.${index}.monthlyAmount`, `Overhead item ${index + 1} monthly amount`, item.monthlyAmount, {
          max: MAX_MONTHLY_AMOUNT,
          allowZero: true,
        })
        const meta = item.meta
        if (!meta) return
        if (meta.type === 'electricity') {
          if (meta.unitsPerLoomPerMonth != null) addNumberIssue(issues, warnings, `overhead_items.${index}.meta.unitsPerLoomPerMonth`, `Overhead item ${index + 1} units per loom`, meta.unitsPerLoomPerMonth, { max: MAX_MONTHLY_AMOUNT, allowZero: true })
          if (meta.ratePerUnit != null) addNumberIssue(issues, warnings, `overhead_items.${index}.meta.ratePerUnit`, `Overhead item ${index + 1} rate per unit`, meta.ratePerUnit, { max: MAX_COST_PER_M, allowZero: true })
        } else if (meta.type === 'depreciation') {
          if (meta.avgCostPerLoom != null) addNumberIssue(issues, warnings, `overhead_items.${index}.meta.avgCostPerLoom`, `Overhead item ${index + 1} average loom cost`, meta.avgCostPerLoom, { max: MAX_MONTHLY_AMOUNT, allowZero: true })
          addNumberIssue(issues, warnings, `overhead_items.${index}.meta.usefulLifeYears`, `Overhead item ${index + 1} useful life`, meta.usefulLifeYears, { min: 1, max: 100, required: true })
        }
      })
    }
  }
  return resultFromIssues(issues, warnings)
}

function validateWarpRow(row: WarpRow, index: number, issues: EstimatorValidationIssue[], warnings: EstimatorValidationIssue[]) {
  const prefix = `warpRows.${index}`
  const label = row.label?.trim()
    ? `Warp layer ${index + 1} (${row.label.trim()})`
    : `Warp layer ${index + 1}`

  if (isBlankWarpComponent(row)) {
    issues.push({ field: prefix, message: `Remove this blank warp component or complete it before saving.` })
    return
  }

  if (!row.label?.trim()) issues.push({ field: `${prefix}.label`, message: `${label} needs a label so its yarn and rate can be identified.` })

  if (row.calculationMode !== 'manual') {
    if (row.linearDensityUnit === 'cotton_count_ne') {
      addNumberIssue(issues, warnings, `${prefix}.cottonCountNe`, `${label} English cotton count`, row.cottonCountNe, {
        min: 0,
        hardMin: 0.1,
        max: MAX_COTTON_COUNT_NE,
        required: true,
        warningMin: MIN_COMMON_COTTON_COUNT_NE,
        warningMax: MAX_COMMON_COTTON_COUNT_NE,
        warningMessage: `${label} cotton count is unusual. Confirm the Ne unit and ply count.`,
      })
      addNumberIssue(issues, warnings, `${prefix}.effectiveDenier`, `${label} converted denier`, getEffectiveYarnDenier(row), { min: 0, hardMin: MIN_DENIER, max: MAX_DENIER, warningMin: MIN_COMMON_DENIER, warningMax: MAX_COMMON_DENIER, warningMessage: `${label} converted denier is unusual. Confirm the yarn numbering and unit.` })
    } else {
      addNumberIssue(issues, warnings, `${prefix}.calcDenier`, `${label} denier`, row.calcDenier, { min: 0, hardMin: MIN_DENIER, max: MAX_DENIER, warningMin: MIN_COMMON_DENIER, warningMax: MAX_COMMON_DENIER, warningMessage: `${label} denier is unusual. Confirm the yarn numbering and unit.` })
    }
    addNumberIssue(issues, warnings, `${prefix}.beamEnds`, `${label} beam ends`, row.beamEnds, { max: MAX_BEAM_ENDS, warningMax: MAX_COMMON_BEAM_ENDS, warningMessage: `${label} beam ends are unusually high. Confirm the beam plan and unit.` })
  }
  addNumberIssue(issues, warnings, `${prefix}.yarnRate`, `${label} yarn rate`, row.yarnRate, { max: MAX_RATE_PER_KG, warningMax: MAX_RATE_WARNING_PER_KG, warningMessage: `${label} yarn rate is above ₹${MAX_RATE_WARNING_PER_KG}/kg. Confirm the rate and unit.` })
  addNumberIssue(issues, warnings, `${prefix}.gstPct`, `${label} GST %`, row.gstPct, { max: MAX_PERCENT, allowZero: true })

  if (row.shortagePct !== null && row.shortagePct !== undefined) {
    addNumberIssue(issues, warnings, `${prefix}.shortagePct`, `${label} waste %`, row.shortagePct, { max: MAX_WASTE_PERCENT, allowZero: true, warningMax: MAX_COMMON_WASTE_PCT, warningMessage: `${label} waste above 15% is unusual. Confirm this is a percentage, not a multiplier.` })
  }
  if (row.crimpPct !== null && row.crimpPct !== undefined) {
    addNumberIssue(issues, warnings, `${prefix}.crimpPct`, `${label} crimp %`, row.crimpPct, { max: 50, allowZero: true, warningMax: MAX_COMMON_CRIMP_PCT, warningMessage: `${label} crimp above 15% is unusual. Confirm this is a percentage of take-up.` })
  }

  if (row.calculationMode === 'manual') {
    addNumberIssue(issues, warnings, `${prefix}.manualKgPer100m`, `${label} manual kg/100m`, row.manualKgPer100m, {
      max: MAX_RATE_PER_KG,
      required: true,
    })
  }
}

function validateWeftRow(row: WeftRow, index: number, issues: EstimatorValidationIssue[], warnings: EstimatorValidationIssue[]) {
  const prefix = `weftRows.${index}`
  const label = row.label?.trim()
    ? `Weft layer ${index + 1} (${row.label.trim()})`
    : `Weft layer ${index + 1}`

  if (isBlankWeftComponent(row)) {
    issues.push({ field: prefix, message: `Remove this blank weft component or complete it before saving.` })
    return
  }

  if (!row.label?.trim()) issues.push({ field: `${prefix}.label`, message: `${label} needs a label so its yarn and rate can be identified.` })

  // Picks remain required in manual-yarn mode because loom wages are still
  // calculated per pick. Manual mode overrides yarn kg, not weaving labour.
  addNumberIssue(issues, warnings, `${prefix}.picks`, `${label} picks`, row.picks, { max: MAX_PICKS, warningMin: MIN_COMMON_PICKS, warningMax: MAX_COMMON_PICKS, warningMessage: `${label} picks are unusual. Confirm the PPI unit and fabric construction.` })
  if (row.calculationMode !== 'manual') {
    addNumberIssue(issues, warnings, `${prefix}.effectiveCostingWidthCm`, `${label} effective costing width`, getEffectiveCostingWidthCm(row), { min: MIN_WIDTH_CM, hardMin: MIN_WIDTH_CM, max: MAX_WIDTH_CM, warningMin: MIN_COMMON_WIDTH_CM, warningMax: MAX_COMMON_WIDTH_CM, warningMessage: `${label} width is unusual. Confirm whether the value is in centimetres or inches.` })
    if (row.linearDensityUnit === 'cotton_count_ne') {
      addNumberIssue(issues, warnings, `${prefix}.cottonCountNe`, `${label} English cotton count`, row.cottonCountNe, {
        min: 0,
        hardMin: 0.1,
        max: MAX_COTTON_COUNT_NE,
        required: true,
        warningMin: MIN_COMMON_COTTON_COUNT_NE,
        warningMax: MAX_COMMON_COTTON_COUNT_NE,
        warningMessage: `${label} cotton count is unusual. Confirm the Ne unit and ply count.`,
      })
      addNumberIssue(issues, warnings, `${prefix}.effectiveDenier`, `${label} converted denier`, getEffectiveYarnDenier(row), { min: 0, hardMin: MIN_DENIER, max: MAX_DENIER, warningMin: MIN_COMMON_DENIER, warningMax: MAX_COMMON_DENIER, warningMessage: `${label} converted denier is unusual. Confirm the yarn numbering and unit.` })
    } else {
      addNumberIssue(issues, warnings, `${prefix}.calcDenier`, `${label} denier`, row.calcDenier, { min: 0, hardMin: MIN_DENIER, max: MAX_DENIER, warningMin: MIN_COMMON_DENIER, warningMax: MAX_COMMON_DENIER, warningMessage: `${label} denier is unusual. Confirm the yarn numbering and unit.` })
    }
  }
  addNumberIssue(issues, warnings, `${prefix}.yarnRate`, `${label} yarn rate`, row.yarnRate, { max: MAX_RATE_PER_KG, warningMax: MAX_RATE_WARNING_PER_KG, warningMessage: `${label} yarn rate is above ₹${MAX_RATE_WARNING_PER_KG}/kg. Confirm the rate and unit.` })
  addNumberIssue(issues, warnings, `${prefix}.gstPct`, `${label} GST %`, row.gstPct, { max: MAX_PERCENT, allowZero: true })

  if (row.shortagePct !== null && row.shortagePct !== undefined) {
    addNumberIssue(issues, warnings, `${prefix}.shortagePct`, `${label} waste %`, row.shortagePct, { max: MAX_WASTE_PERCENT, allowZero: true, warningMax: MAX_COMMON_WASTE_PCT, warningMessage: `${label} waste above 15% is unusual. Confirm this is a percentage, not a multiplier.` })
  }
  if (row.crimpPct !== null && row.crimpPct !== undefined) {
    addNumberIssue(issues, warnings, `${prefix}.crimpPct`, `${label} crimp %`, row.crimpPct, { max: 50, allowZero: true, warningMax: MAX_COMMON_CRIMP_PCT, warningMessage: `${label} crimp above 15% is unusual. Confirm this is a percentage of take-up.` })
  }

  if (row.calculationMode === 'manual') {
    addNumberIssue(issues, warnings, `${prefix}.manualKgPer100m`, `${label} manual kg/100m`, row.manualKgPer100m, {
      max: MAX_RATE_PER_KG,
      required: true,
    })
  }
}

/**
 * A fabric with several weft systems must say how its picks were entered:
 * picks for each system, or the total PPI shared by a ratio. The engine never
 * guesses, because 64 PPI means 64 in total or 128 in total depending on it.
 */
export function validateWeftPickConvention(weftRows: readonly WeftRow[], issues: EstimatorValidationIssue[]) {
  const rows = weftRows.filter(row => row && typeof row === 'object')
  if (rows.length <= 1) return
  const convention = getWeftPickConvention(rows)
  if (convention === null) {
    issues.push({
      field: 'weftPickConvention',
      message: 'This fabric has more than one weft yarn. Choose whether the picks are entered for each weft yarn or as the total picks shared by a ratio.',
    })
    return
  }
  if (convention !== 'total_ratio') return
  rows.forEach((row, index) => {
    const ratio = Number(row.pickRatio)
    if (!Number.isFinite(ratio) || ratio <= 0) {
      issues.push({ field: 'weftPickRepeat', message: `Weft layer ${index + 1} picks in each repeat must be greater than 0.` })
    }
  })
  const total = rows.reduce((sum, row) => sum + (Number(row.picks) || 0), 0)
  if (!(total > 0)) {
    issues.push({ field: 'weftTotalPicks', message: 'Total picks (PPI) must be greater than 0.' })
    return
  }
  const allocation = allocateWeftPicks(total, rows.map(row => Number(row.pickRatio)))
  if (!allocation.ok) return
  const drifted = rows.some((row, index) => Math.abs((Number(row.picks) || 0) - allocation.picks[index]) > 1e-6)
  if (drifted) {
    issues.push({ field: 'weftTotalPicks', message: 'The weft picks no longer match the pick ratio. Re-enter the total picks or the ratio.' })
  }
}

export function validateEstimatorSnapshot(
  estimate: EstimateState,
  options: { requireTapeLength?: boolean; requireCapacity?: boolean } = {},
): EstimatorValidationResult {
  const issues: EstimatorValidationIssue[] = []
  const warnings: EstimatorValidationIssue[] = []
  if (!estimate || typeof estimate !== 'object') {
    return resultFromIssues([{ field: 'estimate', message: 'Estimator input is required.' }])
  }

  const warpRows = Array.isArray(estimate.warpRows) ? estimate.warpRows : []
  const weftRows = Array.isArray(estimate.weftRows) ? estimate.weftRows : []
  const overheadItems = Array.isArray(estimate.overheadItems) ? estimate.overheadItems : []

  if (warpRows.length === 0) {
    issues.push({ field: 'warpRows', message: 'Add at least one warp row before saving.' })
  } else if (warpRows.length > MAX_ROWS) {
    issues.push({ field: 'warpRows', message: `Use ${MAX_ROWS} or fewer warp rows.` })
  }

  if (weftRows.length === 0) {
    issues.push({ field: 'weftRows', message: 'Add at least one weft row before saving.' })
  } else if (weftRows.length > MAX_ROWS) {
    issues.push({ field: 'weftRows', message: `Use ${MAX_ROWS} or fewer weft rows.` })
  }

  if (!Array.isArray(estimate.overheadItems)) {
    issues.push({ field: 'overheadItems', message: 'Overhead items must be a list.' })
  }

  warpRows.forEach((row, index) => {
    if (!row || typeof row !== 'object') {
      issues.push({ field: `warpRows.${index}`, message: `Warp row ${index + 1} is invalid.` })
      return
    }
    validateWarpRow(row, index, issues, warnings)
  })
  weftRows.forEach((row, index) => {
    if (!row || typeof row !== 'object') {
      issues.push({ field: `weftRows.${index}`, message: `Weft row ${index + 1} is invalid.` })
      return
    }
    validateWeftRow(row, index, issues, warnings)
  })
  validateWeftPickConvention(weftRows, issues)

  addNumberIssue(issues, warnings, 'tapeLengthM', 'Tape length', estimate.tapeLengthM, {
    max: MAX_TAPE_LENGTH_M,
    allowZero: options.requireTapeLength === false,
  })
  addNumberIssue(issues, warnings, 'perPickCostPaisa', 'Weaving rate', estimate.perPickCostPaisa, { max: MAX_PICK_COST })
  addNumberIssue(issues, warnings, 'warpingRatePerKg', 'Warping rate', estimate.warpingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: estimate.warpingMode !== 'outsourced', required: estimate.warpingMode === 'outsourced' })
  addNumberIssue(issues, warnings, 'sizingRatePerKg', 'Sizing rate', estimate.sizingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: estimate.sizingMode !== 'outsourced', required: estimate.sizingMode === 'outsourced' })
  const sections = estimate.enabledSections
  addNumberIssue(issues, warnings, 'windingRatePerKg', 'Winding rate', estimate.windingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: !sections?.winding, required: Boolean(sections?.winding) })
  addNumberIssue(issues, warnings, 'processingRatePerM', 'Processing rate', estimate.processingRatePerM, { max: MAX_COST_PER_M, allowZero: !sections?.processing, required: Boolean(sections?.processing) })
  addNumberIssue(issues, warnings, 'finishingRatePerM', 'Finishing rate', estimate.finishingRatePerM, { max: MAX_COST_PER_M, allowZero: !sections?.finishing, required: Boolean(sections?.finishing) })
  addNumberIssue(issues, warnings, 'yarnShortagePct', 'Default yarn waste %', estimate.yarnShortagePct, { max: MAX_WASTE_PERCENT, allowZero: true, warningMax: MAX_COMMON_WASTE_PCT, warningMessage: 'Waste above 15% is unusual. Confirm this is a percentage, not a multiplier.' })
  addNumberIssue(issues, warnings, 'warpCrimpPct', 'Warp crimp %', estimate.warpCrimpPct, { max: 50, allowZero: true, warningMax: MAX_COMMON_CRIMP_PCT, warningMessage: 'Warp crimp above 15% is unusual. Confirm the fabric construction and unit.' })
  const overheadMode = estimate.overheadMode
    ?? (estimate.overheadOverridePerM != null ? 'direct' : 'monthly_expenses')
  const requireCapacity = options.requireCapacity === true
  if (!['direct', 'monthly_expenses'].includes(overheadMode)) {
    issues.push({ field: 'overheadMode', message: 'Choose a valid overhead calculation method.' })
  }
  if (overheadMode === 'direct') {
    addNumberIssue(issues, warnings, 'overheadOverridePerM', 'Direct overhead rate', estimate.overheadOverridePerM, {
      max: MAX_COST_PER_M,
      required: true,
    })
  }
  if (overheadMode === 'monthly_expenses' && estimate.overheadOverridePerM != null) {
    addNumberIssue(issues, warnings, 'overheadOverridePerM', 'Current costing overhead', estimate.overheadOverridePerM, {
      max: MAX_COST_PER_M,
      allowZero: true,
    })
  }
  addNumberIssue(issues, warnings, 'monthlyOutputM', 'Standard monthly production', estimate.monthlyOutputM, {
    max: MAX_TARGET_METERS,
    allowZero: !requireCapacity && overheadMode === 'direct',
    required: requireCapacity || overheadMode === 'monthly_expenses',
  })
  addNumberIssue(issues, warnings, 'commissionPct', 'Commission %', estimate.commissionPct, { max: MAX_PERCENT, allowZero: true })
  addNumberIssue(issues, warnings, 'profitPct', 'Profit margin %', estimate.profitPct, { max: MAX_PERCENT, allowZero: true })
  addNumberIssue(issues, warnings, 'transportPerM', 'Transport per meter', estimate.transportPerM, { max: MAX_COST_PER_M, allowZero: true })
  addNumberIssue(issues, warnings, 'loomCount', 'Loom count', estimate.loomCount, { max: MAX_LOOMS, allowZero: !requireCapacity })
  addNumberIssue(issues, warnings, 'monthlyWorkingDays', 'Monthly working days', estimate.monthlyWorkingDays, { max: MAX_WORKING_DAYS })
  addNumberIssue(issues, warnings, 'avgOutputPerLoomPerDay', 'Average output per loom per day', estimate.avgOutputPerLoomPerDay, {
    max: MAX_OUTPUT_PER_LOOM_PER_DAY,
    allowZero: !requireCapacity && estimate.loomCount === 0,
    warningMax: MAX_COMMON_OUTPUT_PER_LOOM_PER_DAY,
    warningMessage: 'Output above 500 m per loom per day is unusual. Confirm the loom, shift, and unit.',
  })

  if (!sections?.winding && Number(estimate.windingRatePerKg) > 0) {
    warnings.push({ field: 'enabledSections.winding', message: 'A winding rate is entered but Winding is switched off, so it will not be included in this costing.' })
  }
  if (!sections?.processing && Number(estimate.processingRatePerM) > 0) {
    warnings.push({ field: 'enabledSections.processing', message: 'A processing rate is entered but Processing is switched off, so it will not be included in this costing.' })
  }
  if (!sections?.finishing && Number(estimate.finishingRatePerM) > 0) {
    warnings.push({ field: 'enabledSections.finishing', message: 'A finishing rate is entered but Finishing is switched off, so it will not be included in this costing.' })
  }
  if (Number(estimate.commissionPct) + Number(estimate.profitPct) >= 100) {
    issues.push({ field: 'profitPct', message: 'Commission and profit margin together must be less than 100%.' })
  }

  if (estimate.loomType !== null && estimate.loomType !== undefined) {
    if (!Object.prototype.hasOwnProperty.call(LOOM_TYPE_DEFAULTS, estimate.loomType)) {
      issues.push({ field: 'loomType', message: 'Loom type is invalid.' })
    }
    addNumberIssue(issues, warnings, 'loomRpm', 'Loom RPM', estimate.loomRpm, { min: 1, max: MAX_LOOM_RPM, required: estimate.loomType === 'other' })
    addNumberIssue(issues, warnings, 'loomPowerKw', 'Loom power', estimate.loomPowerKw, { min: 0, max: MAX_LOOM_POWER_KW, allowZero: true, required: estimate.loomType === 'other' })
    addNumberIssue(issues, warnings, 'hoursPerShift', 'Hours per shift', estimate.hoursPerShift, { min: 1, max: MAX_SHIFT_HOURS, required: false })
  }

  if (estimate.overheadOverridePerM !== null && estimate.overheadOverridePerM !== undefined) {
    addNumberIssue(issues, warnings, 'overheadOverridePerM', 'Direct overhead rate', estimate.overheadOverridePerM, { max: MAX_COST_PER_M, allowZero: true })
  }

  if (estimate.orderQuantityM !== null && estimate.orderQuantityM !== undefined) {
    addNumberIssue(issues, warnings, 'orderQuantityM', 'Order quantity', estimate.orderQuantityM, { max: MAX_TARGET_METERS })
  }

  const ratedCapacity = Number(estimate.loomCount) * Number(estimate.monthlyWorkingDays) * Number(estimate.avgOutputPerLoomPerDay)
  if (Number.isFinite(ratedCapacity) && ratedCapacity > 0 && Number(estimate.monthlyOutputM) > ratedCapacity) {
    const monthlyOutput = Number(estimate.monthlyOutputM)
    const overheadImpact = overheadMode === 'direct'
      ? 'Direct overhead uses the saved ₹/m rate, so monthly output is a reference check and does not change this costing.'
      : 'Monthly output is the denominator for monthly-expense overhead, so it changes the overhead cost per metre.'
    warnings.push({
      field: 'monthlyOutputM',
      message: `Monthly output is above the rated loom capacity. Actual output is ${formatValidationNumber(monthlyOutput)} m versus ${formatValidationNumber(ratedCapacity)} m rated capacity (${formatValidationNumber(Number(estimate.loomCount))} looms × ${formatValidationNumber(Number(estimate.monthlyWorkingDays))} working days × ${formatValidationNumber(Number(estimate.avgOutputPerLoomPerDay))} m/loom/day). ${overheadImpact} Confirm the capacity inputs.`,
    })
  }

  overheadItems.forEach((item, index) => {
    addNumberIssue(issues, warnings, `overheadItems.${index}.monthlyAmount`, `Overhead item ${index + 1} monthly amount`, item.monthlyAmount, {
      max: MAX_MONTHLY_AMOUNT,
      allowZero: true,
    })
    if (item.meta?.type === 'electricity') {
      if (item.meta.unitsPerLoomPerMonth != null) addNumberIssue(issues, warnings, `overheadItems.${index}.meta.unitsPerLoomPerMonth`, `Overhead item ${index + 1} units per loom`, item.meta.unitsPerLoomPerMonth, { max: MAX_MONTHLY_AMOUNT, allowZero: true })
      if (item.meta.ratePerUnit != null) addNumberIssue(issues, warnings, `overheadItems.${index}.meta.ratePerUnit`, `Overhead item ${index + 1} rate per unit`, item.meta.ratePerUnit, { max: MAX_COST_PER_M, allowZero: true })
    }
    if (item.meta?.type === 'depreciation') {
      addNumberIssue(issues, warnings, `overheadItems.${index}.meta.avgCostPerLoom`, `Overhead item ${index + 1} average loom cost`, item.meta.avgCostPerLoom, { max: MAX_MONTHLY_AMOUNT, allowZero: true })
      addNumberIssue(issues, warnings, `overheadItems.${index}.meta.usefulLifeYears`, `Overhead item ${index + 1} useful life`, item.meta.usefulLifeYears, { min: 1, max: 100 })
    }
  })

  return resultFromIssues(issues, warnings)
}

export function validateEstimatorQuoteBoundary(input: {
  estimate: EstimateState
  totalProductionCostPerM: number
  quotePricePerM: number
  targetMeters?: number | null
  requireTapeLength?: boolean
  requireCapacity?: boolean
  result?: CostingResultSnapshot | null
  totals?: EstimatorV3Totals | null
}): EstimatorValidationResult {
  const snapshotValidation = validateEstimatorSnapshot(input.estimate, {
    requireTapeLength: input.requireTapeLength,
    requireCapacity: input.requireCapacity ?? true,
  })
  const issues = snapshotValidation.valid ? [] : [...snapshotValidation.issues]
  const warnings = snapshotValidation.warnings ? [...snapshotValidation.warnings] : []

  addNumberIssue(issues, warnings, 'totalProductionCostPerM', 'Production cost per meter', input.totalProductionCostPerM, { max: MAX_COST_PER_M })
  addNumberIssue(issues, warnings, 'quotePricePerM', 'Quote price per meter', input.quotePricePerM, { max: MAX_COST_PER_M })

  if (input.targetMeters !== undefined && input.targetMeters !== null) {
    addNumberIssue(issues, warnings, 'targetMeters', 'Target meters', input.targetMeters, { max: MAX_TARGET_METERS })
  }

  if (input.result !== undefined) {
    const resultValidation = validateCostingResultBoundary(input.result, input.totals)
    if (!resultValidation.valid) issues.push(...resultValidation.issues)
  }

  return resultFromIssues(issues, warnings)
}

function withinTolerance(left: number, right: number, tolerance = 0.02) {
  return Math.abs(left - right) <= tolerance
}

/**
 * Validate the rounded result separately from the raw calculation engine.
 * The engine intentionally remains recoverable for incomplete drafts; this
 * boundary is what decides whether a money figure is safe to display or save.
 */
export function validateCostingResultBoundary(
  result: CostingResultSnapshot | null | undefined,
  totals?: EstimatorV3Totals | null,
): EstimatorValidationResult {
  const issues: EstimatorValidationIssue[] = []
  if (!result) {
    issues.push({ field: 'costingResult', message: 'Complete the required inputs before calculating a reliable cost.' })
    return resultFromIssues(issues)
  }

  const nonNegativeFields: Array<[string, string, number]> = [
    ['productionCostPerM', 'Production cost per meter', result.productionCostPerM],
    ['overheadPerM', 'Overhead per meter', result.overheadPerM],
    ['transportPerM', 'Transport per meter', result.transportPerM],
    ['commissionPct', 'Commission %', result.commissionPct],
    ['commissionPerM', 'Commission per meter', result.commissionPerM],
    ['landedCostPerM', 'Landed cost per meter', result.landedCostPerM],
    ['breakEvenPricePerM', 'Break-even price per meter', result.breakEvenPricePerM],
    ['suggestedSellingPricePerM', 'Suggested selling price per meter', result.suggestedSellingPricePerM],
  ]
  nonNegativeFields.forEach(([field, label, value]) => {
    const max = field === 'commissionPct' ? MAX_PERCENT : MAX_COST_PER_M
    addNumberIssue(issues, [], field, label, value, { max, allowZero: true })
  })
  addNumberIssue(issues, [], 'targetMarginPct', 'Target margin %', result.targetMarginPct, { min: -100, max: MAX_PERCENT, allowZero: true })
  if (Number(result.productionCostPerM) <= 0) {
    issues.push({ field: 'productionCostPerM', message: 'Production cost per meter must be greater than zero before saving.' })
  }
  if (Number(result.suggestedSellingPricePerM) <= 0) {
    issues.push({ field: 'suggestedSellingPricePerM', message: 'Suggested selling price must be greater than zero before saving.' })
  }
  if (result.commissionPct >= 100) {
    issues.push({ field: 'commissionPct', message: 'Commission % must be below 100%.' })
  }

  const breakdownEntries = Object.entries(result.breakdown)
  breakdownEntries.forEach(([field, value]) => {
    addNumberIssue(issues, [], `breakdown.${field}`, 'Calculated cost component', value, { max: MAX_COST_PER_M, allowZero: true })
  })

  if (result.quantityM !== null) {
    addNumberIssue(issues, [], 'quantityM', 'Order quantity', result.quantityM, { max: MAX_TARGET_METERS })
    if (result.totalOrderValue === null || result.totalLandedCost === null || result.expectedProfitTotal === null) {
      issues.push({ field: 'expectedProfitTotal', message: 'Order totals are incomplete for the selected quantity.' })
    }
  }
  ;(['totalOrderValue', 'totalLandedCost'] as const).forEach(field => {
    const value = result[field]
    if (value !== null) addNumberIssue(issues, [], field, field === 'totalOrderValue' ? 'Total order value' : 'Total landed cost', value, { max: MAX_TOTAL_VALUE, allowZero: true })
  })
  if (result.expectedProfitTotal !== null && !Number.isFinite(result.expectedProfitTotal)) {
    issues.push({ field: 'expectedProfitTotal', message: 'Expected profit must be a valid number.' })
  }
  if (!Number.isFinite(result.actualMarginPct) || !Number.isFinite(result.profitPerM)) {
    issues.push({ field: 'actualMarginPct', message: 'Calculated margin and profit must be valid numbers.' })
  }

  if (!withinTolerance(result.productionCostPerM, result.breakdown.productionCostPerM)) {
    issues.push({ field: 'breakdown.productionCostPerM', message: 'Calculated production cost does not match its breakdown.' })
  }
  if (!withinTolerance(result.overheadPerM, result.breakdown.overheadPerM)) {
    issues.push({ field: 'breakdown.overheadPerM', message: 'Calculated overhead does not match its breakdown.' })
  }
  if (result.landedCostPerM + 0.02 < result.productionCostPerM) {
    issues.push({ field: 'landedCostPerM', message: 'Landed cost cannot be below production cost.' })
  }
  if (!withinTolerance(result.profitPerM, result.suggestedSellingPricePerM - result.landedCostPerM)) {
    issues.push({ field: 'profitPerM', message: 'Calculated profit does not match the selling price and landed cost.' })
  }
  if (result.expectedProfitTotal !== null && result.totalOrderValue !== null && result.totalLandedCost !== null
      && !withinTolerance(result.expectedProfitTotal, result.totalOrderValue - result.totalLandedCost, 0.05)) {
    issues.push({ field: 'expectedProfitTotal', message: 'Expected profit total does not match the order totals.' })
  }
  if (result.quantityM === null && (result.totalOrderValue !== null || result.totalLandedCost !== null || result.expectedProfitTotal !== null)) {
    issues.push({ field: 'quantityM', message: 'Order totals cannot be present without a valid order quantity.' })
  }
  if (result.quantityM !== null && result.totalOrderValue !== null && !withinTolerance(
    result.totalOrderValue,
    result.suggestedSellingPricePerM * result.quantityM,
    0.05,
  )) {
    issues.push({ field: 'totalOrderValue', message: 'Total order value does not match the quoted price and quantity.' })
  }
  if (result.quantityM !== null && result.totalLandedCost !== null && !withinTolerance(
    result.totalLandedCost,
    result.landedCostPerM * result.quantityM,
    0.05,
  )) {
    issues.push({ field: 'totalLandedCost', message: 'Total landed cost does not match the landed cost and quantity.' })
  }
  if (!withinTolerance(result.commissionPerM, result.suggestedSellingPricePerM * result.commissionPct / 100)) {
    issues.push({ field: 'commissionPerM', message: 'Commission per meter does not match the quote and commission rate.' })
  }
  if (!withinTolerance(
    result.landedCostPerM,
    result.productionCostPerM + result.transportPerM + result.commissionPerM,
  )) {
    issues.push({ field: 'landedCostPerM', message: 'Landed cost does not match production, transport, and commission.' })
  }
  if (!withinTolerance(
    result.breakEvenPricePerM,
    calculateBreakEvenPricePerM(result.productionCostPerM, result.transportPerM, result.commissionPct),
    0.05,
  )) {
    issues.push({ field: 'breakEvenPricePerM', message: 'Break-even price does not match the production, transport, and commission inputs.' })
  }
  if (result.suggestedSellingPricePerM > 0
      && !withinTolerance(result.actualMarginPct, result.profitPerM / result.suggestedSellingPricePerM * 100, 0.05)) {
    issues.push({ field: 'actualMarginPct', message: 'Calculated margin does not match the profit percentage.' })
  }

  if (totals) {
    if (!Number.isFinite(totals.totalProductionCostPerM) || totals.totalProductionCostPerM <= 0) {
      issues.push({ field: 'totalProductionCostPerM', message: 'The calculation engine did not produce a positive production cost.' })
    }
    if (totals.orderQuote && totals.orderQuote.isValid === false) {
      issues.push({ field: 'orderQuote', message: totals.orderQuote.errorMessage ?? 'The quotation inputs cannot produce a valid selling price.' })
    }
  }

  return resultFromIssues(issues)
}

export function getEstimatorReadiness(input: {
  validation: EstimatorValidationResult
  result?: CostingResultSnapshot | null
  totals?: EstimatorV3Totals | null
  warningsAcknowledged?: boolean
  /** Metered drafts have input validation, but no result to validate yet. */
  awaitingCalculation?: boolean
}): EstimatorReadinessResult {
  const inputIssues = input.validation.valid ? [] : [...input.validation.issues]
  const warnings = input.validation.warnings ? [...input.validation.warnings] : []
  const resultValidation = input.awaitingCalculation
    ? { valid: true as const, issues: [] }
    : validateCostingResultBoundary(input.result, input.totals)
  const issues = [...inputIssues, ...(resultValidation.valid ? [] : resultValidation.issues)]

  if (issues.length > 0) {
    return { status: 'blocked', canDisplayMoney: false, canPersist: false, issues, warnings }
  }
  if (warnings.length > 0 && input.warningsAcknowledged === false) {
    return { status: 'warning_ack_required', canDisplayMoney: !input.awaitingCalculation, canPersist: false, issues: [], warnings }
  }
  if (input.awaitingCalculation) {
    return { status: 'calculation_required', canDisplayMoney: false, canPersist: false, issues: [], warnings }
  }
  return { status: 'ready', canDisplayMoney: true, canPersist: true, issues: [], warnings }
}

export function getFirstEstimatorValidationMessage(result: EstimatorValidationResult): string | null {
  return result.valid ? null : result.issues[0]?.message ?? 'Estimator input is invalid.'
}
