import {
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
    maxDecimals?: number
  }
) {
  const isBlank = value === null
    || value === undefined
    || (typeof value === 'string' && value.trim() === '')
  if (isBlank) {
    issues.push({
      field,
      message: options.required ? `${label} is required.` : `${label} must be a valid number.`,
    })
    return
  }

  // EstimateState is numeric by contract. Keep the runtime boundary strict so
  // manually tampered payloads such as "1,000", " 250 ", and other strings
  // cannot be silently coerced into a different costing value.
  if (typeof value !== 'number') {
    issues.push({ field, message: `${label} must be a valid number.` })
    return
  }

  const numberValue = value
  const min = options.min ?? 0
  const lowerBoundText = options.allowZero ? `at least ${min}` : `greater than ${min}`

  if (!Number.isFinite(numberValue)) {
    issues.push({ field, message: `${label} must be a valid number.` })
    return
  }

  if (options.allowZero ? numberValue < min : numberValue <= min) {
    issues.push({ field, message: `${label} must be ${lowerBoundText}.` })
    return
  }

  if (numberValue > options.max) {
    issues.push({ field, message: `${label} is outside the supported range.` })
    return
  }

  if (options.maxDecimals !== undefined) {
    const [, fractional = ''] = numberValue.toString().toLowerCase().split('e')[0].split('.')
    const exponent = Number(numberValue.toString().toLowerCase().split('e')[1] ?? 0)
    const decimalPlaces = Math.max(0, fractional.length - exponent)
    if (decimalPlaces > options.maxDecimals) {
      const suffix = options.maxDecimals === 1 ? 'place' : 'places'
      issues.push({
        field,
        message: `${label} must use no more than ${options.maxDecimals} decimal ${suffix}.`,
      })
    }
  }
}

function validateWarpRow(row: WarpRow, index: number, issues: EstimatorValidationIssue[]) {
  const prefix = `warpRows.${index}`
  const label = `Warp row ${index + 1}`

  if (row.calculationMode !== 'manual') {
    if (row.linearDensityUnit === 'cotton_count_ne') {
      addNumberIssue(issues, `${prefix}.cottonCountNe`, `${label} English cotton count`, row.cottonCountNe, {
        max: MAX_COTTON_COUNT_NE,
        required: true,
        maxDecimals: 3,
      })
      addNumberIssue(issues, `${prefix}.effectiveDenier`, `${label} converted denier`, getEffectiveYarnDenier(row), { max: MAX_DENIER })
    } else {
      addNumberIssue(issues, `${prefix}.calcDenier`, `${label} denier`, row.calcDenier, { max: MAX_DENIER, maxDecimals: 3 })
    }
    addNumberIssue(issues, `${prefix}.beamEnds`, `${label} beam ends`, row.beamEnds, { max: MAX_BEAM_ENDS, maxDecimals: 0 })
  }
  addNumberIssue(issues, `${prefix}.yarnRate`, `${label} yarn rate`, row.yarnRate, { max: MAX_RATE_PER_KG, maxDecimals: 2 })
  addNumberIssue(issues, `${prefix}.gstPct`, `${label} GST %`, row.gstPct, { max: MAX_PERCENT, allowZero: true, maxDecimals: 2 })

  if (row.shortagePct !== null && row.shortagePct !== undefined) {
    addNumberIssue(issues, `${prefix}.shortagePct`, `${label} waste %`, row.shortagePct, { max: MAX_WASTE_PERCENT, allowZero: true, maxDecimals: 2 })
  }

  if (row.calculationMode === 'manual') {
    addNumberIssue(issues, `${prefix}.manualKgPer100m`, `${label} manual kg/100m`, row.manualKgPer100m, {
      max: MAX_RATE_PER_KG,
      required: true,
      maxDecimals: 3,
    })
  }
}

function validateWeftRow(row: WeftRow, index: number, issues: EstimatorValidationIssue[]) {
  const prefix = `weftRows.${index}`
  const label = `Weft row ${index + 1}`

  // Picks remain required in manual-yarn mode because loom wages are still
  // calculated per pick. Manual mode overrides yarn kg, not weaving labour.
  addNumberIssue(issues, `${prefix}.picks`, `${label} picks`, row.picks, { max: MAX_PICKS, maxDecimals: 3 })
  if (row.finishedWidthCm !== null && row.finishedWidthCm !== undefined) {
    addNumberIssue(issues, `${prefix}.finishedWidthCm`, `${label} finished width`, row.finishedWidthCm, {
      max: MAX_WIDTH_CM,
      allowZero: row.calculationMode === 'manual',
      maxDecimals: 4,
    })
  }
  const costingWidth = row.effectiveCostingWidthCm !== null && row.effectiveCostingWidthCm !== undefined
    ? row.effectiveCostingWidthCm
    : row.reedSpace
  addNumberIssue(issues, `${prefix}.effectiveCostingWidthCm`, `${label} effective costing width`, costingWidth, {
    max: MAX_WIDTH_CM,
    allowZero: row.calculationMode === 'manual',
    maxDecimals: 4,
  })
  if (row.calculationMode !== 'manual') {
    if (row.linearDensityUnit === 'cotton_count_ne') {
      addNumberIssue(issues, `${prefix}.cottonCountNe`, `${label} English cotton count`, row.cottonCountNe, {
        max: MAX_COTTON_COUNT_NE,
        required: true,
        maxDecimals: 3,
      })
      addNumberIssue(issues, `${prefix}.effectiveDenier`, `${label} converted denier`, getEffectiveYarnDenier(row), { max: MAX_DENIER })
    } else {
      addNumberIssue(issues, `${prefix}.calcDenier`, `${label} denier`, row.calcDenier, { max: MAX_DENIER, maxDecimals: 3 })
    }
  }
  addNumberIssue(issues, `${prefix}.yarnRate`, `${label} yarn rate`, row.yarnRate, { max: MAX_RATE_PER_KG, maxDecimals: 2 })
  addNumberIssue(issues, `${prefix}.gstPct`, `${label} GST %`, row.gstPct, { max: MAX_PERCENT, allowZero: true, maxDecimals: 2 })

  if (row.shortagePct !== null && row.shortagePct !== undefined) {
    addNumberIssue(issues, `${prefix}.shortagePct`, `${label} waste %`, row.shortagePct, { max: MAX_WASTE_PERCENT, allowZero: true, maxDecimals: 2 })
  }

  if (row.calculationMode === 'manual') {
    addNumberIssue(issues, `${prefix}.manualKgPer100m`, `${label} manual kg/100m`, row.manualKgPer100m, {
      max: MAX_RATE_PER_KG,
      required: true,
      maxDecimals: 3,
    })
  }
}

export function validateEstimatorSnapshot(estimate: EstimateState): EstimatorValidationResult {
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

  addNumberIssue(issues, 'tapeLengthM', 'Tape length', estimate.tapeLengthM, { max: MAX_TAPE_LENGTH_M, maxDecimals: 3 })
  addNumberIssue(issues, 'perPickCostPaisa', 'Weaving rate per pick', estimate.perPickCostPaisa, { max: MAX_PICK_COST, maxDecimals: 4 })
  addNumberIssue(issues, 'warpingRatePerKg', 'Warping rate', estimate.warpingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: true, maxDecimals: 2 })
  addNumberIssue(issues, 'sizingRatePerKg', 'Sizing rate', estimate.sizingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: true, maxDecimals: 2 })
  addNumberIssue(issues, 'windingRatePerKg', 'Winding rate', estimate.windingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: true, maxDecimals: 2 })
  addNumberIssue(issues, 'processingRatePerM', 'Processing rate', estimate.processingRatePerM, { max: MAX_COST_PER_M, allowZero: true, maxDecimals: 2 })
  addNumberIssue(issues, 'finishingRatePerM', 'Finishing rate', estimate.finishingRatePerM, { max: MAX_COST_PER_M, allowZero: true, maxDecimals: 2 })
  addNumberIssue(issues, 'yarnShortagePct', 'Default yarn waste %', estimate.yarnShortagePct, { max: MAX_WASTE_PERCENT, allowZero: true, maxDecimals: 2 })
  addNumberIssue(issues, 'warpCrimpPct', 'Warp crimp %', estimate.warpCrimpPct, { max: MAX_PERCENT, allowZero: true, maxDecimals: 2 })
  addNumberIssue(issues, 'monthlyOutputM', 'Monthly output', estimate.monthlyOutputM, { max: MAX_TARGET_METERS, maxDecimals: 3 })
  addNumberIssue(issues, 'commissionPct', 'Commission %', estimate.commissionPct, { max: MAX_PERCENT, allowZero: true, maxDecimals: 2 })
  addNumberIssue(issues, 'profitPct', 'Profit margin %', estimate.profitPct, { max: MAX_PERCENT, allowZero: true, maxDecimals: 2 })
  addNumberIssue(issues, 'transportPerM', 'Transport per meter', estimate.transportPerM, { max: MAX_COST_PER_M, allowZero: true, maxDecimals: 2 })
  addNumberIssue(issues, 'loomCount', 'Machine count', estimate.loomCount, { max: MAX_LOOMS, allowZero: true, maxDecimals: 0 })
  addNumberIssue(issues, 'monthlyWorkingDays', 'Monthly working days', estimate.monthlyWorkingDays, { max: MAX_WORKING_DAYS, maxDecimals: 0 })
  addNumberIssue(issues, 'avgOutputPerLoomPerDay', 'Average output per machine per day', estimate.avgOutputPerLoomPerDay, {
    max: MAX_OUTPUT_PER_LOOM_PER_DAY,
    allowZero: estimate.loomCount === 0,
    maxDecimals: 3,
  })

  if (Number(estimate.commissionPct) + Number(estimate.profitPct) >= 100) {
    issues.push({ field: 'profitPct', message: 'Commission and profit margin together must be less than 100%.' })
  }

  if (estimate.overheadOverridePerM !== null && estimate.overheadOverridePerM !== undefined) {
    addNumberIssue(issues, 'overheadOverridePerM', 'Overhead override', estimate.overheadOverridePerM, { max: MAX_COST_PER_M, allowZero: true, maxDecimals: 2 })
  }

  if (estimate.orderQuantityM !== null && estimate.orderQuantityM !== undefined) {
    addNumberIssue(issues, 'orderQuantityM', 'Order quantity', estimate.orderQuantityM, { max: MAX_TARGET_METERS, maxDecimals: 3 })
  }

  overheadItems.forEach((item, index) => {
    addNumberIssue(issues, `overheadItems.${index}.monthlyAmount`, `Overhead item ${index + 1} monthly amount`, item.monthlyAmount, {
      max: MAX_MONTHLY_AMOUNT,
      allowZero: true,
      maxDecimals: 2,
    })
  })

  return resultFromIssues(issues)
}

export function validateEstimatorQuoteBoundary(input: {
  estimate: EstimateState
  totalProductionCostPerM: number
  quotePricePerM: number
  targetMeters?: number | null
}): EstimatorValidationResult {
  const snapshotValidation = validateEstimatorSnapshot(input.estimate)
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
