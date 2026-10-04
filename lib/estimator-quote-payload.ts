import { getEffectiveOverheadMode, getEffectiveYarnDenier, type CostingResultSnapshot, type EstimateState } from '@/lib/estimator'

/**
 * Commercial scalars persisted beside the costing snapshot. A paid costing
 * save takes them from the authoritative result; the first costing of a new
 * saved quality takes them from its estimate. Callers state which.
 */
export interface EstimatorQuoteCommercialInputs {
    commissionPct: number | null | undefined
    transportPerM: number | null | undefined
    orderQuantityM: number | null | undefined
    profitPct: number | null | undefined
}

export interface EstimatorQuotePayloadInput {
    orgId: string
    recordKind: string
    partyName: string | null
    qualityLabel: string
    templateId: string | null
    warpInstruction: string | null
    weftInstruction: string | null
    /** The recipe inputs saved with the costing. */
    estimate: EstimateState
    /** The server-computed result for `estimate`. */
    result: CostingResultSnapshot
    commercial: EstimatorQuoteCommercialInputs
    status: string
    clientRequestId: string
    /** Weaver wage rate snapshot; flows downstream to shift assignments. */
    workerRatePerM: number
    costingInputFingerprint: string | null
    factoryProfileUpdatedAt: string | null
    reconciledAt: string
    /** Record-kind specific columns, such as quotation document fields. */
    extra?: Record<string, unknown>
}

/** The warping and overhead modes the engine applied to `estimate`. */
export function buildEstimatorQuoteInputBasis(estimate: EstimateState) {
    return {
        warping_mode: estimate.warpingMode ?? (estimate.warpingRatePerKg > 0 ? 'outsourced' : 'in_house'),
        overhead_mode: getEffectiveOverheadMode(estimate),
    }
}

/** Payload keys added by `20261004120000_estimator_quote_input_basis.sql`. */
export const ESTIMATOR_QUOTE_INPUT_BASIS_KEYS = ['warping_mode', 'overhead_mode'] as const

/**
 * The payload a database without the input-basis migration accepts: the new
 * keys removed and the override kept only in direct mode, as before.
 */
export function toLegacyEstimatorQuotePayload<T extends Record<string, unknown>>(payload: T): Omit<T, typeof ESTIMATOR_QUOTE_INPUT_BASIS_KEYS[number]> {
    const legacy: Record<string, unknown> = { ...payload }
    const directMode = legacy.overhead_mode === 'direct'
    for (const key of ESTIMATOR_QUOTE_INPUT_BASIS_KEYS) delete legacy[key]
    if (!directMode) legacy.overhead_override_per_m = null
    return legacy as Omit<T, typeof ESTIMATOR_QUOTE_INPUT_BASIS_KEYS[number]>
}

/**
 * Builds the `estimator_quotes` row for a saved costing: the full recipe
 * snapshot plus the result columns, from one estimate and its result.
 */
export function buildEstimatorQuotePayload(input: EstimatorQuotePayloadInput) {
    const { estimate, result, commercial } = input
    return {
        org_id: input.orgId,
        record_kind: input.recordKind,
        party_name: input.partyName,
        quality_label: input.qualityLabel,
        template_id: input.templateId,
        warp_instruction: input.warpInstruction,
        weft_instruction: input.weftInstruction,
        // Full recipe snapshot
        warp_rows: estimate.warpRows,
        weft_rows: estimate.weftRows,
        per_pick_cost_paise: estimate.perPickCostPaisa,
        tape_length_m: estimate.tapeLengthM,
        warp_crimp_pct: estimate.warpCrimpPct ?? 0,
        yarn_shortage_pct: estimate.yarnShortagePct ?? 0,
        warping_rate_per_kg: estimate.warpingRatePerKg,
        sizing_rate_per_kg: estimate.sizingRatePerKg,
        winding_rate_per_kg: estimate.windingRatePerKg,
        processing_rate_per_m: estimate.processingRatePerM,
        finishing_rate_per_m: estimate.finishingRatePerM,
        // Overhead V2: store the selected method inputs; no percentage metric is persisted.
        overhead_items: estimate.overheadItems,
        monthly_output_m: estimate.monthlyOutputM,
        // The engine applies a non-null override in either mode, so it is
        // stored whenever it was applied; the explicit modes keep reopening
        // from guessing the basis from what remains.
        overhead_override_per_m: estimate.overheadOverridePerM ?? null,
        overhead_pct: 0,
        commission_pct: commercial.commissionPct,
        transport_per_m: commercial.transportPerM,
        order_quantity_m: commercial.orderQuantityM,
        profit_margin_pct: commercial.profitPct,
        enabled_sections: estimate.enabledSections,
        // Loom type + sizing mode audit trail
        loom_type: estimate.loomType ?? null,
        estimator_rpm: estimate.loomRpm ?? null,
        estimator_power_kw: estimate.loomPowerKw ?? null,
        hours_per_shift: estimate.hoursPerShift,
        sizing_mode: estimate.sizingMode,
        ...buildEstimatorQuoteInputBasis(estimate),
        loom_count: estimate.loomCount,
        monthly_working_days: estimate.monthlyWorkingDays,
        avg_output_per_loom_per_day: estimate.avgOutputPerLoomPerDay,
        // Result snapshot
        calculation_version: result.calculationVersion,
        rounding_policy: result.roundingPolicy,
        production_cost_per_meter: result.productionCostPerM,
        overhead_per_meter: result.overheadPerM,
        commission_cost_per_meter: result.commissionPerM,
        break_even_price_per_meter: result.breakEvenPricePerM,
        expected_profit_per_meter: result.profitPerM,
        expected_profit_total: result.expectedProfitTotal,
        actual_margin_percent: result.actualMarginPct,
        costing_result_snapshot: result,
        reconciliation_status: 'verified',
        reconciliation_note: null,
        reconciled_at: input.reconciledAt,
        landed_cost_per_meter: result.landedCostPerM,
        quote_price_per_meter: result.suggestedSellingPricePerM,
        intended_margin_percent: result.targetMarginPct,
        meters: commercial.orderQuantityM ?? 0,
        status: input.status,
        client_request_id: input.clientRequestId,
        costing_input_fingerprint: input.costingInputFingerprint,
        factory_profile_updated_at: input.factoryProfileUpdatedAt,
        ...input.extra,
        worker_rate_per_m: input.workerRatePerM,
        // Legacy required fields with sane defaults
        ppi: Math.round(estimate.weftRows[0]?.picks ?? 68),
        yarn_denier: Math.round(estimate.warpRows[0] ? getEffectiveYarnDenier(estimate.warpRows[0]) : 75),
        yarn_rate_per_kg: estimate.warpRows[0]?.yarnRate ?? 0,
    }
}
