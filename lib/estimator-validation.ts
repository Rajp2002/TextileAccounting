import { getEffectiveCostingWidthCm, type EstimateState, type WarpRow, type WeftRow } from './estimator'

export type EstimatorValidationIssue = {
  field: string
  message: string
}

export type EstimatorValidationResult =
  | { valid: true; issues: [] }
  | { valid: false; issues: EstimatorValidationIssue[] }

const MAX_ROWS = 20
const MAX_DENIER = 100_000
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

function validateWarpRow(row: WarpRow, index: number, issues: EstimatorValidationIssue[]) {
  const prefix = `warpRows.${index}`
  const label = `Warp row ${index + 1}`

  addNumberIssue(issues, `${prefix}.calcDenier`, `${label} denier`, row.calcDenier, { max: MAX_DENIER })
  addNumberIssue(issues, `${prefix}.beamEnds`, `${label} beam ends`, row.beamEnds, { max: MAX_BEAM_ENDS })
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

  addNumberIssue(issues, `${prefix}.picks`, `${label} picks`, row.picks, { max: MAX_PICKS })
  addNumberIssue(issues, `${prefix}.effectiveCostingWidthCm`, `${label} effective costing width`, getEffectiveCostingWidthCm(row), { max: MAX_WIDTH_CM })
  addNumberIssue(issues, `${prefix}.calcDenier`, `${label} denier`, row.calcDenier, { max: MAX_DENIER })
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

  warpRows.forEach((row, index) => validateWarpRow(row, index, issues))
  weftRows.forEach((row, index) => validateWeftRow(row, index, issues))

  addNumberIssue(issues, 'tapeLengthM', 'Tape length', estimate.tapeLengthM, { max: MAX_TAPE_LENGTH_M })
  addNumberIssue(issues, 'perPickCostPaisa', 'Weaving rate per pick', estimate.perPickCostPaisa, { max: MAX_PICK_COST })
  addNumberIssue(issues, 'warpingRatePerKg', 'Warping rate', estimate.warpingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, 'sizingRatePerKg', 'Sizing rate', estimate.sizingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, 'windingRatePerKg', 'Winding rate', estimate.windingRatePerKg, { max: MAX_RATE_PER_KG, allowZero: true })
  addNumberIssue(issues, 'processingRatePerM', 'Processing rate', estimate.processingRatePerM, { max: MAX_COST_PER_M, allowZero: true })
  addNumberIssue(issues, 'finishingRatePerM', 'Finishing rate', estimate.finishingRatePerM, { max: MAX_COST_PER_M, allowZero: true })
  addNumberIssue(issues, 'yarnShortagePct', 'Default yarn waste %', estimate.yarnShortagePct, { max: MAX_WASTE_PERCENT, allowZero: true })
  addNumberIssue(issues, 'warpCrimpPct', 'Warp crimp %', estimate.warpCrimpPct, { max: MAX_PERCENT, allowZero: true })
  addNumberIssue(issues, 'monthlyOutputM', 'Monthly output', estimate.monthlyOutputM, { max: MAX_TARGET_METERS, allowZero: true })

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
