import {
    buildCostingResult,
    calcFullTotals,
    type CostingResultSnapshot,
    type EstimateState,
} from './estimator'
import {
    getFirstEstimatorValidationMessage,
    requiresFactoryCapacity,
    validateEstimatorQuoteBoundary,
    validateEstimatorSnapshot,
} from './estimator-validation'

/**
 * What-if margin for a saved costing. The margin is a share of the SELLING
 * price (price = (cost + transport) ÷ (1 − commission − margin)), exactly as the
 * Cost Estimate computes it, so a 10% margin on ₹17.44 of cost sells at ₹19.38,
 * not ₹19.18. Every figure here comes from the same engine the save action uses,
 * so what the owner sees while dragging is what a save would store.
 */

export const MARGIN_STEP = 0.5
export const MARGIN_RANGE_MIN = 0
/** Wide enough for grey-fabric margins; a saved margin above it widens the range. */
export const MARGIN_RANGE_DEFAULT_MAX = 30

/** Two margins closer than this are the same margin (the step is 0.5). */
const MARGIN_EPSILON = 0.005

export type MarginBounds = { min: number; max: number; step: number }

export function marginBounds(savedMarginPct: number, commissionPct: number): MarginBounds {
    const step = MARGIN_STEP
    // Commission and margin together must stay below 100%.
    const ceiling = Math.max(MARGIN_RANGE_MIN, Math.floor((100 - Math.max(0, commissionPct) - step) / step) * step)
    const wanted = Math.max(MARGIN_RANGE_DEFAULT_MAX, Math.ceil(Math.max(0, savedMarginPct) / 5) * 5)
    return { min: MARGIN_RANGE_MIN, max: Math.max(Math.min(wanted, ceiling), savedMarginPct), step }
}

/** The nearest grid value inside the bounds, for a slider position or a typed value. */
export function snapMargin(value: number, bounds: MarginBounds): number {
    if (!Number.isFinite(value)) return bounds.min
    const snapped = Math.round(value / bounds.step) * bounds.step
    // Round away binary noise (0.1 + 0.2) so 12.5 never reads as 12.500000000000002.
    return Math.min(bounds.max, Math.max(bounds.min, Math.round(snapped * 100) / 100))
}

export function marginsDiffer(left: number, right: number): boolean {
    return Math.abs(left - right) >= MARGIN_EPSILON
}

/** The costing as it would be saved with a different margin; cost does not move. */
export function previewMargin(base: EstimateState, marginPct: number): CostingResultSnapshot {
    const next = { ...base, profitPct: marginPct }
    return buildCostingResult(next, calcFullTotals(next))
}

export type MarginAdjustability =
    | { adjustable: true }
    /** The saved inputs no longer reproduce the saved numbers (older engine or an edited rate). */
    | { adjustable: false; reason: 'mismatch' | 'invalid' }

function close(left: number, right: number) {
    return Math.abs(left - right) < MARGIN_EPSILON
}

/**
 * A saved margin can only be adjusted when its stored inputs reproduce its
 * stored cost and price to the paisa, and the edited costing would pass the same
 * checks the save action runs. Otherwise a slider would show prices the saved
 * costing never had, or a save would be refused after the owner had played with it.
 */
export function evaluateMarginAdjustment(base: EstimateState, saved: CostingResultSnapshot): MarginAdjustability {
    const requireCapacity = requiresFactoryCapacity(base, false)
    if (getFirstEstimatorValidationMessage(validateEstimatorSnapshot(base, { requireTapeLength: false, requireCapacity }))) {
        return { adjustable: false, reason: 'invalid' }
    }
    const totals = calcFullTotals(base)
    const result = buildCostingResult(base, totals)
    if (getFirstEstimatorValidationMessage(validateEstimatorQuoteBoundary({
        estimate: base,
        totalProductionCostPerM: result.productionCostPerM,
        quotePricePerM: result.suggestedSellingPricePerM,
        targetMeters: base.orderQuantityM,
        requireTapeLength: false,
        requireCapacity,
        result,
        totals,
    }))) {
        return { adjustable: false, reason: 'invalid' }
    }
    if (
        !close(result.productionCostPerM, saved.productionCostPerM)
        || !close(result.suggestedSellingPricePerM, saved.suggestedSellingPricePerM)
        || !close(base.profitPct, saved.targetMarginPct)
    ) {
        return { adjustable: false, reason: 'mismatch' }
    }
    return { adjustable: true }
}
