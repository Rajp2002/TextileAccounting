import crypto from 'crypto'
import type { EstimateState } from './estimator'

type FingerprintOptions = {
  warpInstruction?: string | null
  weftInstruction?: string | null
}

function normalizeNumber(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(8) : value ?? null
}

function stableValue(value: unknown): unknown {
  if (typeof value === 'number') return normalizeNumber(value)
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(item => stableValue(item))

  return Object.keys(value as Record<string, unknown>)
    .filter(childKey => childKey !== 'id')
    .sort()
    .reduce<Record<string, unknown>>((result, childKey) => {
      result[childKey] = stableValue((value as Record<string, unknown>)[childKey])
      return result
    }, {})
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
