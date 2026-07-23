import {
  getEffectiveCostingWidthCm,
  getEffectiveYarnDenier,
  type EstimateState,
  type WarpRow,
  type WeftRow,
} from './estimator'

export type EstimatorValidationIssue = {
  field: string
  message: string
}

export type EstimatorValidationResult =
  | { valid: true; issues: [] }
  | { valid: false; issues: EstimatorValidationIssue[] }

const MAX_ROWS = 20
const MAX_DENIER = 100_000
const MAX_COTTON_COUNT_NE = 1_000
const MAX_BEAM_ENDS = 1_000_000
const MAX_PICKS = 2_000
const MAX_WIDTH_CM = 1_000
const MAX_RATE_PER_KG = 1_000_000
const MAX_PERCENT = 100
const MAX_WASTE_PERCENT = 500
const MAX_TAPE_LENGTH_M = 1_000_000
const MAX_PICK_COST = 1_000
const MAX_TARGET_METERS = 100_000_000
const MAX_COST_PER_M = 10_000_000
const MAX_MONTHLY_AMOUNT = 1_000_000_000
const MAX_LOOMS = 100_000
const MAX_WORKING_DAYS = 366
const MAX_OUTPUT_PER_LOOM_PER_DAY = 1_000_000
export const UNUSUALLY_LOW_DENIER = 20

export function getYarnDensityWarning(effectiveDenier: number): string | undefined {
  if (!Number.isFinite(effectiveDenier) || effectiveDenier <= 0 || effectiveDenier >= UNUSUALLY_LOW_DENIER) {
    return undefined
  }

  return `Unusually low (under ${UNUSUALLY_LOW_DENIER} D). Confirm the yarn numbering and unit.`
}

export type FactoryCostProfileInput = {
  warping_rate_per_kg: number
  sizing_rate_per_kg: number
  winding_rate_per_kg: number
  overhead_pct: number
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
}

function resultFromIssues(issues: EstimatorValidationIssue[]): EstimatorValidationResult {
  return issues.length > 0 ? { valid: false, issues } : { valid: true, issues: [] }
}

function addNumberIssue(
  issues: EstimatorValidationIssue[],
  field: string,
  label: string,
  value: unknown,
  options: {
    min?: number
    max: number
    allowZero?: boolean
    required?: boolean
  }
) {
  const numberValue = Number(value)
  const min = options.min ?? 0
  const lowerBoundText = options.allowZero ? `at least ${min}` : `greater than ${min}`

  if (!Number.isFinite(numberValue)) {
    issues.push({ field, message: `${label} must be a valid number.` })
    return
  }

  if (options.required && value === null) {
    issues.push({ field, message: `${label} is required.` })
    return
  }

  if (options.allowZero ? numberValue < min : numberValue <= min) {
    issues.push({ field, message: `${label} must be ${lowerBoundText}.` })
    return
  }

  if (numberValue > options.max) {
    issues.push({ field, message: `${label} is outside the supported range.` })
  }
}

export function validateFactoryCostProfile(input: FactoryCostProfileInput): EstimatorValidationResult {
  const issues: EstimatorValidationIssue[] = []
  addNumberIssue(issues, 'warping_rate_per_kg', 'Warping rate', input.warping_rate_per_kg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, 'sizing_rate_per_kg', 'Sizing rate', input.sizing_rate_per_kg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, 'winding_rate_per_kg', 'Winding rate', input.winding_rate_per_kg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, 'overhead_pct', 'Overhead %', input.overhead_pct, { max: 100, allowZero: true })
  addNumberIssue(issues, 'default_commission_pct', 'Default commission %', input.default_commission_pct, { max: 99.99, allowZero: true })
  if (input.default_margin_pct != null) addNumberIssue(issues, 'default_margin_pct', 'Default margin %', input.default_margin_pct, { max: 99.99, allowZero: true })
  if (input.yarn_review_interval_days != null) {
    if (!Number.isInteger(input.yarn_review_interval_days) || input.yarn_review_interval_days < 1 || input.yarn_review_interval_days > 1095) {
      issues.push({ field: 'yarn_review_interval_days', message: 'Yarn review period must be between 1 and 1095 days.' })
    }
  }
  addNumberIssue(issues, 'default_transport_per_m', 'Default transport', input.default_transport_per_m, { max: MAX_COST_PER_M, allowZero: true })
  if (input.default_processing_rate_per_m != null) addNumberIssue(issues, 'default_processing_rate_per_m', 'Default processing rate', input.default_processing_rate_per_m, { max: MAX_COST_PER_M, allowZero: true })
  if (input.default_finishing_rate_per_m != null) addNumberIssue(issues, 'default_finishing_rate_per_m', 'Default finishing rate', input.default_finishing_rate_per_m, { max: MAX_COST_PER_M, allowZero: true })
  if (input.overhead_override_per_m != null) addNumberIssue(issues, 'overhead_override_per_m', 'Overhead override', input.overhead_override_per_m, { max: MAX_COST_PER_M, allowZero: true })
  if (input.monthly_output_m != null) addNumberIssue(issues, 'monthly_output_m', 'Monthly output', input.monthly_output_m, { max: MAX_TARGET_METERS })
  if (input.loom_count != null) addNumberIssue(issues, 'loom_count', 'Loom count', input.loom_count, { max: MAX_LOOMS, allowZero: true })
  if (input.monthly_working_days != null) addNumberIssue(issues, 'monthly_working_days', 'Monthly working days', input.monthly_working_days, { max: 31 })
  if (input.avg_output_per_loom_per_day != null) addNumberIssue(issues, 'avg_output_per_loom_per_day', 'Average output per loom per day', input.avg_output_per_loom_per_day, { max: MAX_OUTPUT_PER_LOOM_PER_DAY })
  if (input.yarn_shortage_pct != null) addNumberIssue(issues, 'yarn_shortage_pct', 'Default yarn waste %', input.yarn_shortage_pct, { max: MAX_WASTE_PERCENT, allowZero: true })
  if (input.warp_crimp_pct != null) addNumberIssue(issues, 'warp_crimp_pct', 'Warp crimp %', input.warp_crimp_pct, { max: MAX_PERCENT, allowZero: true })
  return resultFromIssues(issues)
}

function validateWarpRow(row: WarpRow, index: number, issues: EstimatorValidationIssue[]) {
  const prefix = `warpRows.${index}`
  const label = `Warp row ${index + 1}`

  if (row.calculationMode !== 'manual') {
    if (row.linearDensityUnit === 'cotton_count_ne') {
      addNumberIssue(issues, `${prefix}.cottonCountNe`, `${label} English cotton count`, row.cottonCountNe, {
        max: MAX_COTTON_COUNT_NE,
        required: true,
      })
      addNumberIssue(issues, `${prefix}.effectiveDenier`, `${label} converted denier`, getEffectiveYarnDenier(row), { max: MAX_DENIER })
    } else {
      addNumberIssue(issues, `${prefix}.calcDenier`, `${label} denier`, row.calcDenier, { max: MAX_DENIER })
    }
    addNumberIssue(issues, `${prefix}.beamEnds`, `${label} beam ends`, row.beamEnds, { max: MAX_BEAM_ENDS })
  }
  addNumberIssue(issues, `${prefix}.yarnRate`, `${label} yarn rate`, row.yarnRate, { max: MAX_RATE_PER_KG })
  addNumberIssue(issues, `${prefix}.gstPct`, `${label} GST %`, row.gstPct, { max: MAX_PERCENT, allowZero: true })

  if (row.shortagePct !== null && row.shortagePct !== undefined) {
    addNumberIssue(issues, `${prefix}.shortagePct`, `${label} waste %`, row.shortagePct, { max: MAX_WASTE_PERCENT, allowZero: true })
  }

  if (row.calculationMode === 'manual') {
    addNumberIssue(issues, `${prefix}.manualKgPer100m`, `${label} manual kg/100m`, row.manualKgPer100m, {
      max: MAX_RATE_PER_KG,
      required: true,
    })
  }
}

function validateWeftRow(row: WeftRow, index: number, issues: EstimatorValidationIssue[]) {
  const prefix = `weftRows.${index}`
  const label = `Weft row ${index + 1}`

  // Picks remain required in manual-yarn mode because loom wages are still
  // calculated per pick. Manual mode overrides yarn kg, not weaving labour.
  addNumberIssue(issues, `${prefix}.picks`, `${label} picks`, row.picks, { max: MAX_PICKS })
  if (row.calculationMode !== 'manual') {
    addNumberIssue(issues, `${prefix}.effectiveCostingWidthCm`, `${label} effective costing width`, getEffectiveCostingWidthCm(row), { max: MAX_WIDTH_CM })
    if (row.linearDensityUnit === 'cotton_count_ne') {
      addNumberIssue(issues, `${prefix}.cottonCountNe`, `${label} English cotton count`, row.cottonCountNe, {
        max: MAX_COTTON_COUNT_NE,
        required: true,
      })
      addNumberIssue(issues, `${prefix}.effectiveDenier`, `${label} converted denier`, getEffectiveYarnDenier(row), { max: MAX_DENIER })
    } else {
      addNumberIssue(issues, `${prefix}.calcDenier`, `${label} denier`, row.calcDenier, { max: MAX_DENIER })
    }
  }
  addNumberIssue(issues, `${prefix}.yarnRate`, `${label} yarn rate`, row.yarnRate, { max: MAX_RATE_PER_KG })
  addNumberIssue(issues, `${prefix}.gstPct`, `${label} GST %`, row.gstPct, { max: MAX_PERCENT, allowZero: true })

  if (row.shortagePct !== null && row.shortagePct !== undefined) {
    addNumberIssue(issues, `${prefix}.shortagePct`, `${label} waste %`, row.shortagePct, { max: MAX_WASTE_PERCENT, allowZero: true })
  }

  if (row.calculationMode === 'manual') {
    addNumberIssue(issues, `${prefix}.manualKgPer100m`, `${label} manual kg/100m`, row.manualKgPer100m, {
      max: MAX_RATE_PER_KG,
      required: true,
    })
  }
}

export function validateEstimatorSnapshot(
  estimate: EstimateState,
  options: { requireTapeLength?: boolean } = {},
): EstimatorValidationResult {
  const issues: EstimatorValidationIssue[] = []
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
    validateWarpRow(row, index, issues)
  })
  weftRows.forEach((row, index) => {
    if (!row || typeof row !== 'object') {
      issues.push({ field: `weftRows.${index}`, message: `Weft row ${index + 1} is invalid.` })
      return
    }
    validateWeftRow(row, index, issues)
  })

  addNumberIssue(issues, 'tapeLengthM', 'Tape length', estimate.tapeLengthM, {
    max: MAX_TAPE_LENGTH_M,
    allowZero: options.requireTapeLength === false,
  })
  addNumberIssue(issues, 'perPickCostPaisa', 'Weaving rate per pick', estimate.perPickCostPaisa, { max: MAX_PICK_COST })
  addNumberIssue(issues, 'warpingRatePerKg', 'Warping rate', estimate.warpingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, 'sizingRatePerKg', 'Sizing rate', estimate.sizingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, 'windingRatePerKg', 'Winding rate', estimate.windingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, 'processingRatePerM', 'Processing rate', estimate.processingRatePerM, { max: MAX_COST_PER_M, allowZero: true })
  addNumberIssue(issues, 'finishingRatePerM', 'Finishing rate', estimate.finishingRatePerM, { max: MAX_COST_PER_M, allowZero: true })
  addNumberIssue(issues, 'yarnShortagePct', 'Default yarn waste %', estimate.yarnShortagePct, { max: MAX_WASTE_PERCENT, allowZero: true })
  addNumberIssue(issues, 'warpCrimpPct', 'Warp crimp %', estimate.warpCrimpPct, { max: MAX_PERCENT, allowZero: true })
  addNumberIssue(issues, 'monthlyOutputM', 'Monthly output', estimate.monthlyOutputM, { max: MAX_TARGET_METERS })
  addNumberIssue(issues, 'commissionPct', 'Commission %', estimate.commissionPct, { max: MAX_PERCENT, allowZero: true })
  addNumberIssue(issues, 'profitPct', 'Profit margin %', estimate.profitPct, { max: MAX_PERCENT, allowZero: true })
  addNumberIssue(issues, 'transportPerM', 'Transport per meter', estimate.transportPerM, { max: MAX_COST_PER_M, allowZero: true })
  addNumberIssue(issues, 'loomCount', 'Loom count', estimate.loomCount, { max: MAX_LOOMS, allowZero: true })
  addNumberIssue(issues, 'monthlyWorkingDays', 'Monthly working days', estimate.monthlyWorkingDays, { max: MAX_WORKING_DAYS })
  addNumberIssue(issues, 'avgOutputPerLoomPerDay', 'Average output per loom per day', estimate.avgOutputPerLoomPerDay, {
    max: MAX_OUTPUT_PER_LOOM_PER_DAY,
    allowZero: estimate.loomCount === 0,
  })

  if (Number(estimate.commissionPct) + Number(estimate.profitPct) >= 100) {
    issues.push({ field: 'profitPct', message: 'Commission and profit margin together must be less than 100%.' })
  }

  if (estimate.overheadOverridePerM !== null && estimate.overheadOverridePerM !== undefined) {
    addNumberIssue(issues, 'overheadOverridePerM', 'Overhead override', estimate.overheadOverridePerM, { max: MAX_COST_PER_M, allowZero: true })
  }

  if (estimate.orderQuantityM !== null && estimate.orderQuantityM !== undefined) {
    addNumberIssue(issues, 'orderQuantityM', 'Order quantity', estimate.orderQuantityM, { max: MAX_TARGET_METERS })
  }

  overheadItems.forEach((item, index) => {
    addNumberIssue(issues, `overheadItems.${index}.monthlyAmount`, `Overhead item ${index + 1} monthly amount`, item.monthlyAmount, {
      max: MAX_MONTHLY_AMOUNT,
      allowZero: true,
    })
  })

  return resultFromIssues(issues)
}

export function validateEstimatorQuoteBoundary(input: {
  estimate: EstimateState
  totalProductionCostPerM: number
  quotePricePerM: number
  targetMeters?: number | null
  requireTapeLength?: boolean
}): EstimatorValidationResult {
  const snapshotValidation = validateEstimatorSnapshot(input.estimate, {
    requireTapeLength: input.requireTapeLength,
  })
  const issues = snapshotValidation.valid ? [] : [...snapshotValidation.issues]

  addNumberIssue(issues, 'totalProductionCostPerM', 'Production cost per meter', input.totalProductionCostPerM, { max: MAX_COST_PER_M })
  addNumberIssue(issues, 'quotePricePerM', 'Quote price per meter', input.quotePricePerM, { max: MAX_COST_PER_M })

  if (input.targetMeters !== undefined && input.targetMeters !== null) {
    addNumberIssue(issues, 'targetMeters', 'Target meters', input.targetMeters, { max: MAX_TARGET_METERS })
  }

  return resultFromIssues(issues)
}

export function getFirstEstimatorValidationMessage(result: EstimatorValidationResult): string | null {
  return result.valid ? null : result.issues[0]?.message ?? 'Estimator input is invalid.'
}
