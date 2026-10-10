import { parseCostingResultSnapshot, type CostingReconciliationStatus } from './estimator'

export const COSTING_RECONCILIATION_TOLERANCE = 0.01

export type HistoricalCostingAuditRow = {
  id: string
  org_id: string
  calculation_version?: string | null
  rounding_policy?: string | null
  production_cost_per_meter?: number | null
  overhead_per_meter?: number | null
  commission_cost_per_meter?: number | null
  break_even_price_per_meter?: number | null
  expected_profit_per_meter?: number | null
  expected_profit_total?: number | null
  actual_margin_percent?: number | null
  costing_result_snapshot?: unknown
  landed_cost_per_meter?: number | null
  quote_price_per_meter?: number | null
  intended_margin_percent?: number | null
  warp_rows?: unknown
  weft_rows?: unknown
  overhead_items?: unknown
  commission_pct?: number | null
  transport_per_m?: number | null
}

export type CostingAuditResult = {
  status: Exclude<CostingReconciliationStatus, 'unreviewed'>
  reasons: string[]
  variances: Record<string, number>
}

function finiteOrNull(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isCompleteRecipe(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

function compareStoredValue(
  variances: Record<string, number>,
  label: string,
  stored: unknown,
  expected: unknown,
) {
  const storedValue = finiteOrNull(stored)
  const expectedValue = finiteOrNull(expected)
  if (storedValue == null || expectedValue == null) return false
  const variance = storedValue - expectedValue
  if (Math.abs(variance) > COSTING_RECONCILIATION_TOLERANCE) {
    variances[label] = variance
    return true
  }
  return false
}

/**
 * Classifies a saved costing without rewriting it. The audit is intentionally
 * conservative: a missing assumption is never silently reconstructed from
 * today's factory profile or today's recipe.
 */
export function auditHistoricalCosting(row: HistoricalCostingAuditRow): CostingAuditResult {
  const reasons: string[] = []
  const variances: Record<string, number> = {}
  const snapshot = parseCostingResultSnapshot(row.costing_result_snapshot)

  if (snapshot) {
    const storedPairs: Array<[string, unknown, unknown]> = [
      ['production_cost_per_meter', row.production_cost_per_meter, snapshot.productionCostPerM],
      ['overhead_per_meter', row.overhead_per_meter, snapshot.overheadPerM],
      ['commission_cost_per_meter', row.commission_cost_per_meter, snapshot.commissionPerM],
      ['break_even_price_per_meter', row.break_even_price_per_meter, snapshot.breakEvenPricePerM],
      ['expected_profit_per_meter', row.expected_profit_per_meter, snapshot.profitPerM],
      ['expected_profit_total', row.expected_profit_total, snapshot.expectedProfitTotal],
      ['actual_margin_percent', row.actual_margin_percent, snapshot.actualMarginPct],
      ['landed_cost_per_meter', row.landed_cost_per_meter, snapshot.landedCostPerM],
      ['quote_price_per_meter', row.quote_price_per_meter, snapshot.suggestedSellingPricePerM],
      ['intended_margin_percent', row.intended_margin_percent, snapshot.targetMarginPct],
    ]
    const missingStoredFields = storedPairs
      .filter(([, stored, expected]) => expected != null && finiteOrNull(stored) == null)
      .map(([label]) => label)
    if (missingStoredFields.length > 0) {
      reasons.push(`Some saved numbers are missing: ${missingStoredFields.join(', ')}.`)
      return { status: 'needs_review', reasons, variances }
    }

    const mismatched = [
      compareStoredValue(variances, 'production_cost_per_meter', row.production_cost_per_meter, snapshot.productionCostPerM),
      compareStoredValue(variances, 'overhead_per_meter', row.overhead_per_meter, snapshot.overheadPerM),
      compareStoredValue(variances, 'commission_cost_per_meter', row.commission_cost_per_meter, snapshot.commissionPerM),
      compareStoredValue(variances, 'break_even_price_per_meter', row.break_even_price_per_meter, snapshot.breakEvenPricePerM),
      compareStoredValue(variances, 'expected_profit_per_meter', row.expected_profit_per_meter, snapshot.profitPerM),
      compareStoredValue(variances, 'expected_profit_total', row.expected_profit_total, snapshot.expectedProfitTotal),
      compareStoredValue(variances, 'actual_margin_percent', row.actual_margin_percent, snapshot.actualMarginPct),
      compareStoredValue(variances, 'landed_cost_per_meter', row.landed_cost_per_meter, snapshot.landedCostPerM),
      compareStoredValue(variances, 'quote_price_per_meter', row.quote_price_per_meter, snapshot.suggestedSellingPricePerM),
      compareStoredValue(variances, 'intended_margin_percent', row.intended_margin_percent, snapshot.targetMarginPct),
    ].some(Boolean)

    if (mismatched) {
      reasons.push('The saved totals do not match the saved breakdown (difference above ₹0.01).')
      return { status: 'needs_review', reasons, variances }
    }
    if (!row.calculation_version || !row.rounding_policy) {
      reasons.push('The result is complete, but it does not record which calculation method was used.')
      return { status: 'legacy', reasons, variances }
    }
    return { status: 'verified', reasons, variances }
  }

  if (!isCompleteRecipe(row.warp_rows) || !isCompleteRecipe(row.weft_rows)) {
    reasons.push('Warp or weft recipe rows are missing, so the historical production cost cannot be reconstructed safely.')
    return { status: 'unreconstructable', reasons, variances }
  }
  if (finiteOrNull(row.landed_cost_per_meter) == null || finiteOrNull(row.quote_price_per_meter) == null) {
    reasons.push('Saved landed cost or quoted price is missing.')
    return { status: 'unreconstructable', reasons, variances }
  }
  if (row.overhead_items == null || row.commission_pct == null || row.transport_per_m == null) {
    reasons.push('Historical overhead, commission, or transport assumptions are incomplete.')
    return { status: 'unreconstructable', reasons, variances }
  }

  reasons.push('This costing was saved before this check existed. Check it before sending it to a customer.')
  return { status: 'legacy', reasons, variances }
}

export function isWithinCostingTolerance(actual: unknown, expected: unknown): boolean {
  const actualValue = finiteOrNull(actual)
  const expectedValue = finiteOrNull(expected)
  return actualValue != null
    && expectedValue != null
    && Math.abs(actualValue - expectedValue) <= COSTING_RECONCILIATION_TOLERANCE
}
