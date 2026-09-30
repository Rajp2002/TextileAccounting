import crypto from 'crypto'
import type { EstimateState } from './estimator'
import { stableValue } from './costing-input-changes'

export { summarizeCostingInputChanges, type CostingInputChangeCategory } from './costing-input-changes'

type FingerprintOptions = {
  warpInstruction?: string | null
  weftInstruction?: string | null
}

/**
 * Identifies the user-visible Cost Estimate inputs, without treating generated
 * row ids as a change. It is deliberately independent of current factory
 * defaults: a saved snapshot represents the values Rajesh saw at save time.
 */
export function buildCostingInputFingerprint(
  state: EstimateState,
  options: FingerprintOptions = {},
) {
  const input = {
    warpRows: state.warpRows,
    weftRows: state.weftRows,
    tapeLengthM: state.tapeLengthM,
    perPickCostPaisa: state.perPickCostPaisa,
    warpingRatePerKg: state.warpingRatePerKg,
    sizingRatePerKg: state.sizingRatePerKg,
    windingRatePerKg: state.windingRatePerKg,
    processingRatePerM: state.processingRatePerM,
    finishingRatePerM: state.finishingRatePerM,
    yarnShortagePct: state.yarnShortagePct,
    warpCrimpPct: state.warpCrimpPct,
    overheadItems: state.overheadItems,
    monthlyOutputM: state.monthlyOutputM,
    overheadOverridePerM: state.overheadOverridePerM,
    overheadMode: state.overheadMode,
    loomCount: state.loomCount,
    avgOutputPerLoomPerDay: state.avgOutputPerLoomPerDay,
    monthlyWorkingDays: state.monthlyWorkingDays,
    loomType: state.loomType,
    loomRpm: state.loomRpm,
    loomPowerKw: state.loomPowerKw,
    hoursPerShift: state.hoursPerShift,
    warpingMode: state.warpingMode ?? 'in_house',
    sizingMode: state.sizingMode,
    commissionPct: state.commissionPct,
    transportPerM: state.transportPerM,
    profitPct: state.profitPct,
    orderQuantityM: state.orderQuantityM,
    enabledSections: state.enabledSections,
    warpInstruction: options.warpInstruction?.trim() || '',
    weftInstruction: options.weftInstruction?.trim() || '',
  }

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stableValue(input)))
    .digest('hex')
}
