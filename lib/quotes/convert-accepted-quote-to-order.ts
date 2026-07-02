/**
 * lib/quotes/convert-accepted-quote-to-order.ts
 *
 * Shared conversion service used by:
 *   1. convertAcceptedQuoteToOrder (app/owner/estimator/actions.ts) — Quote History path
 *
 * Note: startPartyOrderFromEstimator (Estimator fast path) previously used this
 * service but was refactored in Batch 23 (QUOTE-007) to use the atomic
 * start_party_order_from_estimator RPC directly for transaction-boundary safety.
 *
 * The caller is responsible for auth/role checks and supabase client creation.
 * This service focuses purely on conversion logic and yarn requirement generation.
 */

import {
    calcFullTotals,
    makeDefaultEstimateState,
    type EstimateState,
    type WarpRow,
    type WeftRow,
    type OverheadItem,
    type FactorySections,
} from '@/lib/estimator'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Snapshot Rehydration ─────────────────────────────────────────────────────

/**
 * Reconstructs a full EstimateState from a stored estimator_quotes row.
 * Used to recalculate yarn requirements without needing the original client session.
 */
export function hydrateEstimateStateFromQuote(
    quote: Record<string, unknown>,
    totalTargetMeters: number
): EstimateState {
    const base = makeDefaultEstimateState()

    return {
        ...base,
        warpRows:
            Array.isArray(quote.warp_rows) && (quote.warp_rows as unknown[]).length > 0
                ? (quote.warp_rows as WarpRow[])
                : base.warpRows,
        weftRows:
            Array.isArray(quote.weft_rows) && (quote.weft_rows as unknown[]).length > 0
                ? (quote.weft_rows as WeftRow[])
                : base.weftRows,
        tapeLengthM:          Number(quote.tape_length_m    ?? base.tapeLengthM),
        perPickCostPaisa:     Number(quote.per_pick_cost_paise ?? base.perPickCostPaisa),
        warpingRatePerKg:     Number(quote.warping_rate_per_kg  ?? base.warpingRatePerKg),
        sizingRatePerKg:      Number(quote.sizing_rate_per_kg   ?? base.sizingRatePerKg),
        windingRatePerKg:     Number(quote.winding_rate_per_kg  ?? base.windingRatePerKg),
        processingRatePerM:   Number(quote.processing_rate_per_m ?? base.processingRatePerM),
        finishingRatePerM:    Number(quote.finishing_rate_per_m  ?? base.finishingRatePerM),
        yarnShortagePct:      Number(quote.yarn_shortage_pct ?? base.yarnShortagePct),
        warpCrimpPct:         Number(quote.warp_crimp_pct   ?? base.warpCrimpPct),
        overheadItems:        Array.isArray(quote.overhead_items)
            ? (quote.overhead_items as OverheadItem[])
            : base.overheadItems,
        monthlyOutputM:       Number(quote.monthly_output_m ?? base.monthlyOutputM),
        overheadOverridePerM:
            quote.overhead_override_per_m != null
                ? Number(quote.overhead_override_per_m)
                : base.overheadOverridePerM,
        overheadPct:    Number(quote.overhead_pct    ?? base.overheadPct),
        commissionPct:  Number(quote.commission_pct  ?? base.commissionPct),
        transportPerM:  Number(quote.transport_per_m ?? base.transportPerM),
        profitPct:      Number(quote.profit_margin_pct ?? quote.intended_margin_percent ?? base.profitPct),
        orderQuantityM: totalTargetMeters > 0 ? totalTargetMeters : (Number(quote.meters ?? 0) || null),
        enabledSections: (quote.enabled_sections as FactorySections) ?? base.enabledSections,
        loomType:       (quote.loom_type as EstimateState['loomType']) ?? base.loomType,
        loomRpm:        quote.estimator_rpm != null ? Number(quote.estimator_rpm) : base.loomRpm,
        loomPowerKw:    quote.estimator_power_kw != null ? Number(quote.estimator_power_kw) : base.loomPowerKw,
        loomRpmIsCustomised:    quote.estimator_rpm != null,
        loomPowerKwIsCustomised: quote.estimator_power_kw != null,
        hoursPerShift:  Number(quote.hours_per_shift ?? base.hoursPerShift),
        sizingMode:     (quote.sizing_mode as EstimateState['sizingMode']) ?? base.sizingMode,
        isConfigured:   true,
    }
}

// ─── Core Conversion ──────────────────────────────────────────────────────────

export type ExecuteQuoteConversionInput = {
    supabase:      SupabaseClient
    orgId:         string
    quoteId:       string
    targetMeters:  number
    deadline:      string
    notes?:        string
    trackingToken: string
}

export type ExecuteQuoteConversionResult =
    | { success: true; orderId: string }
    | { error: string }

/**
 * Core conversion logic: verifies quote ownership and accepted status,
 * calls the existing `convert_accepted_quote_to_order` Supabase RPC,
 * rehydrates the estimator snapshot, and upserts `order_yarn_requirements`.
 *
 * Auth/role checks are the CALLER's responsibility (keep this service pure).
 */
export async function executeQuoteConversion(
    input: ExecuteQuoteConversionInput
): Promise<ExecuteQuoteConversionResult> {
    const { supabase, orgId, quoteId, targetMeters, deadline, notes, trackingToken } = input

    // 1. Fetch and validate the quote (ownership + status guard)
    const { data: quote, error: quoteError } = await supabase
        .from('estimator_quotes')
        .select('*')
        .eq('id', quoteId)
        .eq('org_id', orgId)
        .single()

    if (quoteError || !quote) return { error: 'Quote not found.' }
    if (quote.status !== 'accepted')
        return { error: 'Only accepted quotes can be converted into orders.' }
    if (quote.order_id)
        return { error: 'This quote has already been converted into an order.' }

    // 2. Call the Supabase RPC (atomic: creates order + links quote)
    const { data: conversionRows, error: conversionError } = await supabase.rpc(
        'convert_accepted_quote_to_order',
        {
            p_quote_id:            quoteId,
            p_total_target_meters: targetMeters,
            p_deadline:            deadline,
            p_notes:               notes?.trim() ?? '',
            p_tracking_token:      trackingToken,
        }
    )

    if (conversionError) {
        const message = conversionError.message.includes('already been converted')
            ? 'This quote has already been converted into an order.'
            : conversionError.message
        return { error: message }
    }

    const conversionResult = Array.isArray(conversionRows) ? conversionRows[0] : conversionRows
    if (!conversionResult?.success || !conversionResult.order_id) {
        return { error: conversionResult?.error ?? 'Failed to create order.' }
    }

    const orderId = conversionResult.order_id as string

    // 3. Rehydrate estimate and compute yarn requirements
    const estimateForOrder = hydrateEstimateStateFromQuote(quote, targetMeters)
    const totals            = calcFullTotals(estimateForOrder)
    const warpRequiredKg    = (totals.totalWarpKgPer100m / 100) * targetMeters
    const weftRequiredKg    = ((totals.totalAllYarnKgPer100m - totals.totalWarpKgPer100m) / 100) * targetMeters
    const totalRequiredKg   = warpRequiredKg + weftRequiredKg
    const estimatedBeams    = totals.estimatedBeamCapacityM > 0
        ? Math.max(1, Math.ceil(targetMeters / totals.estimatedBeamCapacityM))
        : null

    // 4. Upsert order_yarn_requirements (same shape as Quote History path)
    await supabase
        .from('order_yarn_requirements')
        .upsert({
            org_id:            orgId,
            order_id:          orderId,
            quote_id:          quoteId,
            warp_required_kg:  Number(warpRequiredKg.toFixed(3)),
            weft_required_kg:  Number(weftRequiredKg.toFixed(3)),
            total_required_kg: Number(totalRequiredKg.toFixed(3)),
            estimated_beams:   estimatedBeams,
            requirement_snapshot: {
                order_quantity_m:          targetMeters,
                estimated_beam_capacity_m: totals.estimatedBeamCapacityM,
                warp_rows:                 estimateForOrder.warpRows,
                weft_rows:                 estimateForOrder.weftRows,
                warp_crimp_pct:            estimateForOrder.warpCrimpPct ?? 0,
                yarn_shortage_pct:         estimateForOrder.yarnShortagePct ?? 0,
            },
        }, { onConflict: 'order_id' })

    return { success: true, orderId }
}
