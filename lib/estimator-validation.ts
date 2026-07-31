import {
  getEffectiveCostingWidthCm,
  getEffectiveYarnDenier,
  LOOM_TYPE_DEFAULTS,
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

const MAX_ROWS = 20
const MIN_DENIER = 0.1
const MAX_DENIER = 5_000
const MAX_COTTON_COUNT_NE = 500
const MAX_BEAM_ENDS = 250_000
const MAX_PICKS = 500
const MAX_WIDTH_CM = 300
const MAX_RATE_PER_KG = 1_000_000
const MAX_PERCENT = 100
const MAX_WASTE_PERCENT = 100
const MAX_TAPE_LENGTH_M = 1_000_000
const MAX_PICK_COST = 1_000
const MAX_TARGET_METERS = 100_000_000
const MAX_COST_PER_M = 10_000_000
const MAX_MONTHLY_AMOUNT = 1_000_000_000
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
  const numberValue = Number(value)
  const min = options.min ?? 0
  const hardMin = options.hardMin ?? min
  const lowerBoundText = options.allowZero ? `at least ${min}` : `greater than ${min}`

  if (options.required && (value === null || value === undefined || (typeof value === 'string' && value.trim() === ''))) {
    issues.push({ field, message: `${label} is required.` })
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

export function validateFactoryCostProfile(input: FactoryCostProfileInput): EstimatorValidationResult {
  const issues: EstimatorValidationIssue[] = []
  const warnings: EstimatorValidationIssue[] = []
  addNumberIssue(issues, warnings, 'warping_rate_per_kg', 'Warping rate', input.warping_rate_per_kg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, warnings, 'sizing_rate_per_kg', 'Sizing rate', input.sizing_rate_per_kg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, warnings, 'winding_rate_per_kg', 'Winding rate', input.winding_rate_per_kg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, warnings, 'overhead_pct', 'Overhead %', input.overhead_pct, { max: 100, allowZero: true })
  addNumberIssue(issues, warnings, 'default_commission_pct', 'Default commission %', input.default_commission_pct, { max: 99.99, allowZero: true })
  if (input.default_margin_pct != null) addNumberIssue(issues, warnings, 'default_margin_pct', 'Default margin %', input.default_margin_pct, { max: 99.99, allowZero: true })
  if (input.yarn_review_interval_days != null) {
    if (!Number.isInteger(input.yarn_review_interval_days) || input.yarn_review_interval_days < 1 || input.yarn_review_interval_days > 1095) {
      issues.push({ field: 'yarn_review_interval_days', message: 'Yarn review period must be between 1 and 1095 days.' })
    }
  }
  addNumberIssue(issues, warnings, 'default_transport_per_m', 'Default transport', input.default_transport_per_m, { max: MAX_COST_PER_M, allowZero: true })
  if (input.default_processing_rate_per_m != null) addNumberIssue(issues, warnings, 'default_processing_rate_per_m', 'Default processing rate', input.default_processing_rate_per_m, { max: MAX_COST_PER_M, allowZero: true })
  if (input.default_finishing_rate_per_m != null) addNumberIssue(issues, warnings, 'default_finishing_rate_per_m', 'Default finishing rate', input.default_finishing_rate_per_m, { max: MAX_COST_PER_M, allowZero: true })
  if (input.overhead_override_per_m != null) addNumberIssue(issues, warnings, 'overhead_override_per_m', 'Overhead override', input.overhead_override_per_m, { max: MAX_COST_PER_M, allowZero: true })
  if (input.monthly_output_m != null) addNumberIssue(issues, warnings, 'monthly_output_m', 'Monthly output', input.monthly_output_m, { max: MAX_TARGET_METERS })
  if (input.loom_count != null) addNumberIssue(issues, warnings, 'loom_count', 'Loom count', input.loom_count, { max: MAX_LOOMS, allowZero: true })
  if (input.monthly_working_days != null) addNumberIssue(issues, warnings, 'monthly_working_days', 'Monthly working days', input.monthly_working_days, { max: 31 })
  if (input.avg_output_per_loom_per_day != null) addNumberIssue(issues, warnings, 'avg_output_per_loom_per_day', 'Average output per loom per day', input.avg_output_per_loom_per_day, { max: MAX_OUTPUT_PER_LOOM_PER_DAY, warningMax: MAX_COMMON_OUTPUT_PER_LOOM_PER_DAY, warningMessage: 'Output above 500 m per loom per day is unusual. Confirm the loom, shift, and unit.' })
  if (input.yarn_shortage_pct != null) addNumberIssue(issues, warnings, 'yarn_shortage_pct', 'Default yarn waste %', input.yarn_shortage_pct, { max: MAX_WASTE_PERCENT, allowZero: true, warningMax: MAX_COMMON_WASTE_PCT, warningMessage: 'Waste above 15% is unusual. Confirm this is a percentage, not a multiplier.' })
  if (input.warp_crimp_pct != null) addNumberIssue(issues, warnings, 'warp_crimp_pct', 'Warp crimp %', input.warp_crimp_pct, { max: 50, allowZero: true, warningMax: MAX_COMMON_CRIMP_PCT, warningMessage: 'Warp crimp above 15% is unusual. Confirm the fabric construction and unit.' })
  return resultFromIssues(issues, warnings)
}

function validateWarpRow(row: WarpRow, index: number, issues: EstimatorValidationIssue[], warnings: EstimatorValidationIssue[]) {
  const prefix = `warpRows.${index}`
  const label = `Warp row ${index + 1}`

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
    addNumberIssue(issues, warnings, `${prefix}.beamEnds`, `${label} beam ends`, row.beamEnds, { max: MAX_BEAM_ENDS })
  }
  addNumberIssue(issues, warnings, `${prefix}.yarnRate`, `${label} yarn rate`, row.yarnRate, { max: MAX_RATE_PER_KG, warningMax: MAX_RATE_WARNING_PER_KG, warningMessage: `${label} yarn rate is above ₹${MAX_RATE_WARNING_PER_KG}/kg. Confirm the rate and unit.` })
  addNumberIssue(issues, warnings, `${prefix}.gstPct`, `${label} GST %`, row.gstPct, { max: MAX_PERCENT, allowZero: true })

  if (row.shortagePct !== null && row.shortagePct !== undefined) {
    addNumberIssue(issues, warnings, `${prefix}.shortagePct`, `${label} waste %`, row.shortagePct, { max: MAX_WASTE_PERCENT, allowZero: true, warningMax: MAX_COMMON_WASTE_PCT, warningMessage: `${label} waste above 15% is unusual. Confirm this is a percentage, not a multiplier.` })
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
  const label = `Weft row ${index + 1}`

  if (!row.label?.trim()) issues.push({ field: `${prefix}.label`, message: `${label} needs a label so its yarn and rate can be identified.` })

  // Picks remain required in manual-yarn mode because loom wages are still
  // calculated per pick. Manual mode overrides yarn kg, not weaving labour.
  addNumberIssue(issues, warnings, `${prefix}.picks`, `${label} picks`, row.picks, { max: MAX_PICKS, warningMin: MIN_COMMON_PICKS, warningMax: MAX_COMMON_PICKS, warningMessage: `${label} picks are unusual. Confirm the PPI unit and fabric construction.` })
  if (row.calculationMode !== 'manual') {
    addNumberIssue(issues, warnings, `${prefix}.effectiveCostingWidthCm`, `${label} effective costing width`, getEffectiveCostingWidthCm(row), { min: 5, max: MAX_WIDTH_CM, warningMin: MIN_COMMON_WIDTH_CM, warningMax: MAX_COMMON_WIDTH_CM, warningMessage: `${label} width is unusual. Confirm whether the value is in centimetres or inches.` })
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

  if (row.calculationMode === 'manual') {
    addNumberIssue(issues, warnings, `${prefix}.manualKgPer100m`, `${label} manual kg/100m`, row.manualKgPer100m, {
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

  addNumberIssue(issues, warnings, 'tapeLengthM', 'Tape length', estimate.tapeLengthM, {
    max: MAX_TAPE_LENGTH_M,
    allowZero: options.requireTapeLength === false,
  })
  addNumberIssue(issues, warnings, 'perPickCostPaisa', 'Weaving rate per pick', estimate.perPickCostPaisa, { max: MAX_PICK_COST })
  addNumberIssue(issues, warnings, 'warpingRatePerKg', 'Warping rate', estimate.warpingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, warnings, 'sizingRatePerKg', 'Sizing rate', estimate.sizingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, warnings, 'windingRatePerKg', 'Winding rate', estimate.windingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, warnings, 'processingRatePerM', 'Processing rate', estimate.processingRatePerM, { max: MAX_COST_PER_M, allowZero: true })
  addNumberIssue(issues, warnings, 'finishingRatePerM', 'Finishing rate', estimate.finishingRatePerM, { max: MAX_COST_PER_M, allowZero: true })
  addNumberIssue(issues, warnings, 'yarnShortagePct', 'Default yarn waste %', estimate.yarnShortagePct, { max: MAX_WASTE_PERCENT, allowZero: true, warningMax: MAX_COMMON_WASTE_PCT, warningMessage: 'Waste above 15% is unusual. Confirm this is a percentage, not a multiplier.' })
  addNumberIssue(issues, warnings, 'warpCrimpPct', 'Warp crimp %', estimate.warpCrimpPct, { max: 50, allowZero: true, warningMax: MAX_COMMON_CRIMP_PCT, warningMessage: 'Warp crimp above 15% is unusual. Confirm the fabric construction and unit.' })
  addNumberIssue(issues, warnings, 'monthlyOutputM', 'Monthly output', estimate.monthlyOutputM, { max: MAX_TARGET_METERS })
  addNumberIssue(issues, warnings, 'commissionPct', 'Commission %', estimate.commissionPct, { max: MAX_PERCENT, allowZero: true })
  addNumberIssue(issues, warnings, 'profitPct', 'Profit margin %', estimate.profitPct, { max: MAX_PERCENT, allowZero: true })
  addNumberIssue(issues, warnings, 'transportPerM', 'Transport per meter', estimate.transportPerM, { max: MAX_COST_PER_M, allowZero: true })
  addNumberIssue(issues, warnings, 'loomCount', 'Loom count', estimate.loomCount, { max: MAX_LOOMS, allowZero: true })
  addNumberIssue(issues, warnings, 'monthlyWorkingDays', 'Monthly working days', estimate.monthlyWorkingDays, { max: MAX_WORKING_DAYS })
  addNumberIssue(issues, warnings, 'avgOutputPerLoomPerDay', 'Average output per loom per day', estimate.avgOutputPerLoomPerDay, {
    max: MAX_OUTPUT_PER_LOOM_PER_DAY,
    allowZero: estimate.loomCount === 0,
    warningMax: MAX_COMMON_OUTPUT_PER_LOOM_PER_DAY,
    warningMessage: 'Output above 500 m per loom per day is unusual. Confirm the loom, shift, and unit.',
  })

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
    addNumberIssue(issues, warnings, 'overheadOverridePerM', 'Overhead override', estimate.overheadOverridePerM, { max: MAX_COST_PER_M, allowZero: true })
  }

  if (estimate.orderQuantityM !== null && estimate.orderQuantityM !== undefined) {
    addNumberIssue(issues, warnings, 'orderQuantityM', 'Order quantity', estimate.orderQuantityM, { max: MAX_TARGET_METERS })
  }

  const ratedCapacity = Number(estimate.loomCount) * Number(estimate.monthlyWorkingDays) * Number(estimate.avgOutputPerLoomPerDay)
  if (Number.isFinite(ratedCapacity) && ratedCapacity > 0 && Number(estimate.monthlyOutputM) > ratedCapacity) {
    warnings.push({
      field: 'monthlyOutputM',
      message: 'Monthly output is above the rated loom capacity. Confirm the loom count, working days, and daily output.',
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
}): EstimatorValidationResult {
  const snapshotValidation = validateEstimatorSnapshot(input.estimate, {
    requireTapeLength: input.requireTapeLength,
  })
  const issues = snapshotValidation.valid ? [] : [...snapshotValidation.issues]
  const warnings = snapshotValidation.warnings ? [...snapshotValidation.warnings] : []

  addNumberIssue(issues, warnings, 'totalProductionCostPerM', 'Production cost per meter', input.totalProductionCostPerM, { max: MAX_COST_PER_M })
  addNumberIssue(issues, warnings, 'quotePricePerM', 'Quote price per meter', input.quotePricePerM, { max: MAX_COST_PER_M })

  if (input.targetMeters !== undefined && input.targetMeters !== null) {
    addNumberIssue(issues, warnings, 'targetMeters', 'Target meters', input.targetMeters, { max: MAX_TARGET_METERS })
  }

  return resultFromIssues(issues, warnings)
}

export function getFirstEstimatorValidationMessage(result: EstimatorValidationResult): string | null {
  return result.valid ? null : result.issues[0]?.message ?? 'Estimator input is invalid.'
}
