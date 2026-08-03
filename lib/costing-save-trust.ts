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

export type CostingInputChangeCategory =
  | 'rate'
  | 'waste'
  | 'width'
  | 'margin'
  | 'commission'
  | 'transport'
  | 'quantity'
  | 'overhead'
  | 'construction'

function numberChanged(left: unknown, right: unknown) {
  const leftValue = Number(left ?? 0)
  const rightValue = Number(right ?? 0)
  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return left !== right
  return Math.abs(leftValue - rightValue) > 0.000001
}

function rowFieldChanged(
  leftRows: Array<Record<string, unknown>>,
  rightRows: Array<Record<string, unknown>>,
  fields: string[],
) {
  if (leftRows.length !== rightRows.length) return true
  return leftRows.some((leftRow, index) => {
    const rightRow = rightRows[index] ?? {}
    return fields.some(field => {
      const left = leftRow[field]
      const right = rightRow[field]
      if (typeof left === 'number' || typeof right === 'number' || left == null || right == null) {
        return numberChanged(left, right)
      }
      return left !== right
    })
  })
}

/**
 * Produces a short, owner-facing explanation for an intentional new costing
 * version. It compares saved user inputs only; generated ids and calculated
 * totals are deliberately excluded so a normal save cannot look like a new
 * economic version merely because the estimator recomputed.
 */
export function summarizeCostingInputChanges(
  previous: EstimateState | null | undefined,
  current: EstimateState,
): CostingInputChangeCategory[] {
  if (!previous) return []

  const changed: CostingInputChangeCategory[] = []
  const previousWarp = previous.warpRows as unknown as Array<Record<string, unknown>>
  const currentWarp = current.warpRows as unknown as Array<Record<string, unknown>>
  const previousWeft = previous.weftRows as unknown as Array<Record<string, unknown>>
  const currentWeft = current.weftRows as unknown as Array<Record<string, unknown>>

  if (rowFieldChanged(previousWarp, currentWarp, ['yarnRate', 'gstPct'])) {
    changed.push('rate')
  }
  if (rowFieldChanged(previousWarp, currentWarp, ['shortagePct', 'calcDenier', 'cottonCountNe'])
    || rowFieldChanged(previousWeft, currentWeft, ['shortagePct', 'calcDenier', 'cottonCountNe'])
    || numberChanged(previous.yarnShortagePct, current.yarnShortagePct)
    || numberChanged(previous.warpCrimpPct, current.warpCrimpPct)) {
    changed.push('waste')
  }
  if (rowFieldChanged(previousWeft, currentWeft, ['effectiveCostingWidthCm', 'reedSpace'])) {
    changed.push('width')
  }
  if (numberChanged(previous.profitPct, current.profitPct)) changed.push('margin')
  if (numberChanged(previous.commissionPct, current.commissionPct)
    || previous.enabledSections.commission !== current.enabledSections.commission) {
    changed.push('commission')
  }
  if (numberChanged(previous.transportPerM, current.transportPerM)
    || previous.enabledSections.transport !== current.enabledSections.transport) {
    changed.push('transport')
  }
  if (numberChanged(previous.orderQuantityM, current.orderQuantityM)) changed.push('quantity')
  if (previous.overheadMode !== current.overheadMode
    || numberChanged(previous.overheadOverridePerM, current.overheadOverridePerM)
    || numberChanged(previous.monthlyOutputM, current.monthlyOutputM)
    || JSON.stringify(stableValue(previous.overheadItems)) !== JSON.stringify(stableValue(current.overheadItems))) {
    changed.push('overhead')
  }
  if (rowFieldChanged(previousWarp, currentWarp, ['beamEnds', 'calculationMode', 'manualKgPer100m'])
    || rowFieldChanged(previousWeft, currentWeft, ['picks', 'calculationMode', 'manualKgPer100m'])
    || numberChanged(previous.perPickCostPaisa, current.perPickCostPaisa)
    || numberChanged(previous.warpingRatePerKg, current.warpingRatePerKg)
    || numberChanged(previous.sizingRatePerKg, current.sizingRatePerKg)
    || numberChanged(previous.windingRatePerKg, current.windingRatePerKg)
    || numberChanged(previous.processingRatePerM, current.processingRatePerM)
    || numberChanged(previous.finishingRatePerM, current.finishingRatePerM)) {
    changed.push('construction')
  }

  return changed
}
