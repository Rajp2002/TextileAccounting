'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { calcFullTotals, calcWorkerRateSnapshot, normalizeCurrencySnapshot, getEffectiveCostingWidthCm, type EstimateState, type FactorySections, type WarpRow, type WeftRow, type OverheadItem } from '@/lib/estimator'
import { getFirstEstimatorValidationMessage, validateEstimatorQuoteBoundary } from '@/lib/estimator-validation'
import crypto from 'crypto'
import { executeQuoteConversion } from '@/lib/quotes/convert-accepted-quote-to-order'
import { getMarketRunDisplayStatus } from '@/lib/market-runs'

/**
 * Generates a 12-character URL-safe tracking token for orders.
 * Uses Node.js crypto (built-in, no ESM issues) — 9 random bytes → base64url → 12 chars.
 * e.g. 'aB3xK9mPqR2w' — non-guessable, safe for WhatsApp without line-wrapping.
 */
function generateTrackingToken(): string {
    return crypto.randomBytes(9).toString('base64url').slice(0, 12)
}

// ─── Factory Cost Profile ─────────────────────────────────────────────────────

export async function getFactoryCostProfile() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('factory_cost_profile')
        .select('*')
        .eq('factory_id', profile.org_id)
        .maybeSingle()

    if (error) return { error: error.message }

    // Auto-create with sensible defaults on first visit
    if (!data) {
        const { data: created, error: createError } = await supabase
            .from('factory_cost_profile')
            .insert({
                factory_id:              profile.org_id,
                warping_rate_per_kg:     2.00,
                sizing_rate_per_kg:      1.50,
                winding_rate_per_kg:     0,
                overhead_pct:            8.00,
                default_commission_pct:  2.00,
                default_transport_per_m: 0,
                loom_count:              0,
                monthly_working_days:    26,
                avg_output_per_loom_per_day: 50,
                enabled_sections: {
                    winding:    false,
                    processing: false,
                    finishing:  false,
                    commission: true,
                    transport:  false,
                },
                is_configured: false,
            })
            .select()
            .single()

            if (createError) return { error: createError.message }
            return { data: created }
        }

    return { data }
}

// ─── Fixed Workers for Overhead ───────────────────────────────────────────────

/**
 * Fetches active fixed-salary workers so the estimator can pre-populate
 * the "Fixed Salary Staff" overhead section with real DB data.
 * Returns light objects; each maps to an OverheadItem with source='fixed_worker_derived'.
 */
export async function getFixedWorkersForOverhead(): Promise<{
    data?: { id: number; name: string; role: string; monthly_salary: number }[]
    error?: string
}> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('fixed_workers')
        .select('id, name, role, monthly_salary')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .order('role', { ascending: true })
        .order('name', { ascending: true })

    if (error) return { error: error.message }
    return { data: data ?? [] }
}

export async function upsertFactoryCostProfile(data: {
    warping_rate_per_kg:     number
    sizing_rate_per_kg:      number
    winding_rate_per_kg:     number
    overhead_pct:            number
    default_commission_pct:  number
    default_transport_per_m: number
    enabled_sections:        FactorySections
    overhead_items?:         OverheadItem[]
    monthly_output_m?:       number
    overhead_override_per_m?: number | null
    loom_count?:             number
    monthly_working_days?:   number
    avg_output_per_loom_per_day?: number
    yarn_shortage_pct?:      number
    warp_crimp_pct?:         number
    is_configured?:          boolean
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('factory_cost_profile')
        .upsert({
            factory_id: profile.org_id,
            ...data,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'factory_id' })

    if (error) return { error: error.message }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    return { success: true }
}

// ─── Estimator Templates ──────────────────────────────────────────────────────

export async function getEstimatorTemplates() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('estimator_templates')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: data ?? [] }
}

export async function saveAsFabricTemplate(data: {
    name:             string
    warpRows:         WarpRow[]
    weftRows:         WeftRow[]
    tapeLengthM:      number
    warpCrimpPct?:    number
    perPickCostPaisa: number
    yarnShortagePct?: number
    overheadOverridePerM?: number | null
    loomType?:        string | null
    loomRpm?:         number | null
    loomPowerKw?:     number | null
    sizingMode?:      'in_house' | 'outsourced'
    hoursPerShift?:   number | null
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Derive legacy flat fields from first row (legacy columns are now nullable,
    // but we still populate them for any older UI that reads them)
    const firstWarp = data.warpRows[0]
    const firstWeft = data.weftRows[0]

    const { error } = await supabase
        .from('estimator_templates')
        .insert({
            org_id:              profile.org_id,
            name:                data.name,
            // V3 recipe arrays (primary store)
            warp_rows:           data.warpRows,
            weft_rows:           data.weftRows,
            per_pick_cost_paise: data.perPickCostPaisa,
            tape_length_m:       data.tapeLengthM,
            warp_crimp_pct:      data.warpCrimpPct ?? 0,
            yarn_shortage_pct:   data.yarnShortagePct ?? 0,
            overhead_override_per_m: data.overheadOverridePerM ?? null,
            // Loom type + sizing mode (new)
            loom_type:           data.loomType ?? null,
            loom_rpm:            data.loomRpm ?? null,
            loom_power_kw:       data.loomPowerKw ?? null,
            sizing_mode:         data.sizingMode ?? 'in_house',
            hours_per_shift:     data.hoursPerShift ?? 12,
            // Legacy display fields — cast to integer to satisfy old column types
            yarn_denier:         Math.round(firstWarp?.calcDenier ?? 75),
            calculated_yarn_denier: firstWarp?.calcDenier ?? 75,
            beam_ends:           firstWarp?.beamEnds ?? 3200,
            ppi:                 Math.round(firstWeft?.picks ?? 68),
            reed_space:          firstWeft ? getEffectiveCostingWidthCm(firstWeft) : 62,
            weft_denier:         firstWeft?.calcDenier ?? 75,
            default_yarn_rate:   firstWarp?.yarnRate ?? 107,
            gsm:                 80,   // legacy placeholder — not used in V3
            is_active:           true,
        })

    if (error) return { error: error.message }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    return { success: true }
}

/**
 * Update an existing template's yarn rates (warp + weft rows).
 * Used when market rates change — owner wants to keep fabric structure
 * but refresh the rate snapshot stored in the template.
 */
export async function updateTemplateRates(data: {
    id:       string
    warpRows: WarpRow[]
    weftRows: WeftRow[]
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const firstWarp = data.warpRows[0]

    const { error } = await supabase
        .from('estimator_templates')
        .update({
            warp_rows:         data.warpRows,
            weft_rows:         data.weftRows,
            // Sync legacy flat field too
            default_yarn_rate: firstWarp?.yarnRate ?? 107,
        })
        .eq('id', data.id)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    return { success: true }
}

/**
 * Full update of a fabric template (recipe + charges + shortages).
 * Used when the user "saves" an active template after making modifications.
 */
export async function updateFabricTemplate(data: {
    id:               string
    name:             string
    warpRows:         WarpRow[]
    weftRows:         WeftRow[]
    tapeLengthM:      number
    warpCrimpPct?:    number
    perPickCostPaisa: number
    yarnShortagePct?: number
    overheadOverridePerM?: number | null
    loomType?:        string | null
    loomRpm?:         number | null
    loomPowerKw?:     number | null
    sizingMode?:      'in_house' | 'outsourced'
    hoursPerShift?:   number | null
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const firstWarp = data.warpRows[0]
    const firstWeft = data.weftRows[0]

    const { error } = await supabase
        .from('estimator_templates')
        .update({
            name:                data.name,
            warp_rows:           data.warpRows,
            weft_rows:           data.weftRows,
            per_pick_cost_paise: data.perPickCostPaisa,
            tape_length_m:       data.tapeLengthM,
            warp_crimp_pct:      data.warpCrimpPct ?? 0,
            yarn_shortage_pct:   data.yarnShortagePct ?? 0,
            overhead_override_per_m: data.overheadOverridePerM ?? null,
            // Loom type + sizing mode (new)
            loom_type:           data.loomType ?? null,
            loom_rpm:            data.loomRpm ?? null,
            loom_power_kw:       data.loomPowerKw ?? null,
            sizing_mode:         data.sizingMode ?? 'in_house',
            hours_per_shift:     data.hoursPerShift ?? 12,
            // Legacy sync
            yarn_denier:         Math.round(firstWarp?.calcDenier ?? 75),
            calculated_yarn_denier: firstWarp?.calcDenier ?? 75,
            beam_ends:           firstWarp?.beamEnds ?? 3200,
            ppi:                 Math.round(firstWeft?.picks ?? 68),
            reed_space:          firstWeft ? getEffectiveCostingWidthCm(firstWeft) : 62,
            weft_denier:         firstWeft?.calcDenier ?? 75,
            default_yarn_rate:   firstWarp?.yarnRate ?? 107,
        })
        .eq('id', data.id)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    return { success: true }
}


/** Rename a template (owner can fix typos without recreating). */
export async function renameTemplate(id: string, name: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('estimator_templates')
        .update({ name: name.trim() })
        .eq('id', id)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    return { success: true }
}

export async function deleteTemplate(id: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('estimator_templates')
        .update({ is_active: false })
        .eq('id', id)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    revalidatePath('/owner/estimator')
    revalidatePath('/owner/settings')
    return { success: true }
}

// ─── Save Quote (V3) ──────────────────────────────────────────────────────────

export async function saveEstimatorQuoteV3(params: {
    partyName:          string
    qualityLabel:       string
    warpInstruction?:   string
    weftInstruction?:   string
    estimate:           EstimateState
    totalProductionCostPerM: number
    quotePricePerM:     number
    status?:            'draft' | 'sent' | 'accepted' | 'rejected'
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { estimate } = params
    const validationError = getFirstEstimatorValidationMessage(validateEstimatorQuoteBoundary({
        estimate,
        totalProductionCostPerM: params.totalProductionCostPerM,
        quotePricePerM: params.quotePricePerM,
        targetMeters: estimate.orderQuantityM,
    }))
    if (validationError) return { error: validationError }

    // Compute loom-worker wage rate: Σ(picks across all weft rows) × perPickCostPaisa
    // e.g. 58 picks × 0.16 = ₹9.28/m — this is what the weaver earns per metre
    const workerRatePerM = calcWorkerRateSnapshot(estimate.weftRows, estimate.perPickCostPaisa ?? 0)

    const { data: saved, error } = await supabase
        .from('estimator_quotes')
        .insert({
            org_id:               profile.org_id,
            party_name:           params.partyName,
            quality_label:        params.qualityLabel,
            warp_instruction:     params.warpInstruction,
            weft_instruction:     params.weftInstruction,
            // V3 full recipe snapshots
            warp_rows:            estimate.warpRows,
            weft_rows:            estimate.weftRows,
            per_pick_cost_paise:  estimate.perPickCostPaisa,
            tape_length_m:        estimate.tapeLengthM,
            warp_crimp_pct:       estimate.warpCrimpPct ?? 0,
            warping_rate_per_kg:  estimate.warpingRatePerKg,
            sizing_rate_per_kg:   estimate.sizingRatePerKg,
            winding_rate_per_kg:  estimate.windingRatePerKg,
            processing_rate_per_m: estimate.processingRatePerM,
            finishing_rate_per_m: estimate.finishingRatePerM,
            // Overhead V2: store both the items snapshot and the computed effective %
            overhead_items:       estimate.overheadItems,
            monthly_output_m:     estimate.monthlyOutputM,
            overhead_override_per_m: estimate.overheadOverridePerM ?? null,
            overhead_pct:         estimate.overheadPct,   // effective % computed by engine
            commission_pct:       estimate.commissionPct,
            transport_per_m:      estimate.transportPerM,
            order_quantity_m:     estimate.orderQuantityM,
            profit_margin_pct:    estimate.profitPct,
            enabled_sections:     estimate.enabledSections,
            // Loom type + sizing mode audit trail (Gap 2 fix)
            loom_type:            estimate.loomType ?? null,
            estimator_rpm:        estimate.loomRpm ?? null,
            estimator_power_kw:   estimate.loomPowerKw ?? null,
            hours_per_shift:      estimate.hoursPerShift,
            sizing_mode:          estimate.sizingMode,
            // Result snapshots
            landed_cost_per_meter:    params.totalProductionCostPerM,
            quote_price_per_meter:    params.quotePricePerM,
            intended_margin_percent:  estimate.profitPct,
            meters:                   estimate.orderQuantityM ?? 0,
            status:                   params.status ?? 'draft',
            // Weaver wage rate snapshot — flows downstream to shift_assignments
            worker_rate_per_m:    workerRatePerM,
            // Legacy required fields with sane defaults
            ppi:     Math.round(estimate.weftRows[0]?.picks ?? 68),
            yarn_denier: Math.round(estimate.warpRows[0]?.calcDenier ?? 75),
            yarn_rate_per_kg: estimate.warpRows[0]?.yarnRate ?? 0,
        })
        .select('id')
        .single()

    if (error) return { error: error.message }
    return { success: true, quoteId: saved.id }
}

// ─── Convert Quote to Order ───────────────────────────────────────────────────

export async function convertQuoteToOrder(data: {
    party_name:          string
    quality_label:       string
    warp_instruction?:   string
    weft_instruction?:   string
    notes?:              string
    total_target_meters: number
    deadline:            string
    estimate?:           EstimateState
    quote_price_per_m?:  number
    totalProductionCostPerM?: number
}) {
    void data
    return {
        error: 'Direct order creation from the estimator has been retired. Save the quote, accept it, then convert it from Quote History.',
    }
}

export async function convertAcceptedQuoteToOrder(data: {
    quoteId: string
    total_target_meters: number
    deadline: string
    notes?: string
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const targetMeters = Number(data.total_target_meters)
    if (!Number.isFinite(targetMeters) || targetMeters <= 0) {
        return { error: 'Order quantity must be greater than 0.' }
    }

    const result = await executeQuoteConversion({
        supabase,
        orgId:         profile.org_id,
        quoteId:       data.quoteId,
        targetMeters,
        deadline:      data.deadline,
        notes:         data.notes,
        trackingToken: generateTrackingToken(),
    })

    if ('error' in result) return result

    revalidatePath('/owner/orders')
    revalidatePath('/owner/analytics')
    revalidatePath('/owner/quotes')
    revalidatePath('/owner/machines')
    revalidatePath('/supervisor/machines')
    return { success: true, orderId: result.orderId }
}

// ─── Start Party Order ────────────────────────────────────────────────────────

export type StartPartyOrderInput = {
    /** Snapshot of the estimator state captured when the dialog opened */
    estimatorState:       EstimateState
    partyName:            string
    qualityLabel:         string
    warpInstruction?:     string | null
    weftInstruction?:     string | null
    targetMeters:         number
    deadline:             string | null
    workerRatePerM?:      number | null
    quotePricePerM:       number
    costPerM:             number
    instructions?:        string | null
    orderNotes?:          string | null
}

/**
 * Creates an accepted estimator quote and immediately converts it to a
 * production order — the "Start Party Order" fast path from the Estimator.
 *
 * Backend flow (Batch 23 — QUOTE-007 atomic transaction boundary):
 *   1. Validate inputs (role-scoped, server-side)
 *   2. Pre-compute yarn requirements from estimator state
 *   3. Call the atomic start_party_order_from_estimator RPC which creates
 *      the accepted quote, active order, quote/order backlinks, and
 *      order_yarn_requirements in a single database transaction.
 *
 * If the RPC fails, no orphaned accepted quote is left behind — all writes
 * are rolled back by PostgreSQL.
 */
export async function startPartyOrderFromEstimator(input: StartPartyOrderInput) {
    await requireRole(['owner'])
    const supabase = await createServerClient()

    // ── Input validation ─────────────────────────────────────────────────────
    if (!input.partyName?.trim())         return { error: 'Add a party name before starting an order.' }
    if (!input.qualityLabel?.trim())      return { error: 'Add a quality label before starting an order.' }

    const targetMeters = Number(input.targetMeters)
    if (!Number.isFinite(targetMeters) || targetMeters <= 0)
        return { error: 'Target meters must be greater than zero.' }

    const costPerM = Number(input.costPerM)
    if (!Number.isFinite(costPerM) || costPerM < 0)
        return { error: 'Complete the estimate before starting an order.' }

    const quotePricePerM = Number(input.quotePricePerM)
    if (!Number.isFinite(quotePricePerM) || quotePricePerM <= 0)
        return { error: 'Quote price is missing. Complete the estimate first.' }

    // Deadline is optional — accept null/empty
    const deadline = input.deadline?.trim() || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

    const { estimatorState } = input
    const validationError = getFirstEstimatorValidationMessage(validateEstimatorQuoteBoundary({
        estimate: estimatorState,
        totalProductionCostPerM: costPerM,
        quotePricePerM,
        targetMeters,
    }))
    if (validationError) return { error: validationError }

    // ── Compute worker rate from estimator state if not explicitly provided ──
    const workerRatePerM = normalizeCurrencySnapshot(
        input.workerRatePerM ??
        calcWorkerRateSnapshot(estimatorState.weftRows, estimatorState.perPickCostPaisa ?? 0)
    )

    // ── Pre-compute yarn requirements (same logic as executeQuoteConversion) ──
    const estimateForOrder = { ...estimatorState, orderQuantityM: targetMeters }
    const totals = calcFullTotals(estimateForOrder)
    const warpRequiredKg  = (totals.totalWarpKgPer100m / 100) * targetMeters
    const weftRequiredKg  = ((totals.totalAllYarnKgPer100m - totals.totalWarpKgPer100m) / 100) * targetMeters
    const totalRequiredKg = warpRequiredKg + weftRequiredKg
    const estimatedBeams  = totals.estimatedBeamCapacityM > 0
        ? Math.max(1, Math.ceil(targetMeters / totals.estimatedBeamCapacityM))
        : null

    // ── Atomic RPC: quote + order + backlinks + yarn requirements ─────────────
    const { data: rpcRows, error: rpcError } = await supabase.rpc(
        'start_party_order_from_estimator',
        {
            // Quote fields
            p_party_name:            input.partyName.trim(),
            p_quality_label:         input.qualityLabel.trim(),
            p_warp_instruction:      input.warpInstruction?.trim() ?? null,
            p_weft_instruction:      input.weftInstruction?.trim() ?? null,
            p_warp_rows:             estimatorState.warpRows,
            p_weft_rows:             estimatorState.weftRows,
            p_per_pick_cost_paise:   estimatorState.perPickCostPaisa,
            p_tape_length_m:         estimatorState.tapeLengthM,
            p_warp_crimp_pct:        estimatorState.warpCrimpPct ?? 0,
            p_warping_rate_per_kg:   estimatorState.warpingRatePerKg,
            p_sizing_rate_per_kg:    estimatorState.sizingRatePerKg,
            p_winding_rate_per_kg:   estimatorState.windingRatePerKg,
            p_processing_rate_per_m: estimatorState.processingRatePerM,
            p_finishing_rate_per_m:  estimatorState.finishingRatePerM,
            p_overhead_items:        estimatorState.overheadItems,
            p_monthly_output_m:      estimatorState.monthlyOutputM,
            p_overhead_override_per_m: estimatorState.overheadOverridePerM ?? null,
            p_overhead_pct:          estimatorState.overheadPct,
            p_commission_pct:        estimatorState.commissionPct,
            p_transport_per_m:       estimatorState.transportPerM,
            p_order_quantity_m:      targetMeters,
            p_profit_margin_pct:     estimatorState.profitPct,
            p_enabled_sections:      estimatorState.enabledSections,
            p_loom_type:             estimatorState.loomType ?? null,
            p_estimator_rpm:         estimatorState.loomRpm ?? null,
            p_estimator_power_kw:    estimatorState.loomPowerKw ?? null,
            p_hours_per_shift:       estimatorState.hoursPerShift,
            p_sizing_mode:           estimatorState.sizingMode,
            p_landed_cost_per_meter: costPerM,
            p_quote_price_per_meter: quotePricePerM,
            p_intended_margin_pct:   estimatorState.profitPct,
            p_worker_rate_per_m:     workerRatePerM,
            p_ppi:                   Math.round(estimatorState.weftRows[0]?.picks ?? 68),
            p_yarn_denier:           Math.round(estimatorState.warpRows[0]?.calcDenier ?? 75),
            p_yarn_rate_per_kg:      estimatorState.warpRows[0]?.yarnRate ?? 0,
            // Order fields
            p_target_meters:         targetMeters,
            p_deadline:              deadline,
            p_notes:                 input.orderNotes?.trim() ?? input.instructions?.trim() ?? '',
            p_tracking_token:        generateTrackingToken(),
            // Pre-computed yarn requirements
            p_warp_required_kg:      Number(warpRequiredKg.toFixed(3)),
            p_weft_required_kg:      Number(weftRequiredKg.toFixed(3)),
            p_total_required_kg:     Number(totalRequiredKg.toFixed(3)),
            p_estimated_beams:       estimatedBeams,
            p_requirement_snapshot:  {
                order_quantity_m:          targetMeters,
                estimated_beam_capacity_m: totals.estimatedBeamCapacityM,
                warp_rows:                 estimateForOrder.warpRows,
                weft_rows:                 estimateForOrder.weftRows,
                warp_crimp_pct:            estimateForOrder.warpCrimpPct ?? 0,
                yarn_shortage_pct:         estimateForOrder.yarnShortagePct ?? 0,
            },
        }
    )

    if (rpcError) {
        return { error: rpcError.message || 'Failed to create order. Please try again.' }
    }

    const rpcResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
    if (!rpcResult?.success || !rpcResult.order_id) {
        return { error: rpcResult?.error ?? 'Failed to create order.' }
    }

    revalidatePath('/owner/orders')
    revalidatePath('/owner/analytics')
    revalidatePath('/owner/quotes')
    revalidatePath('/owner/machines')
    revalidatePath('/supervisor/machines')

    return {
        success: true,
        quoteId: rpcResult.quote_id as string,
        orderId: rpcResult.order_id as string,
    }
}

// ─── Party Rate Memory ────────────────────────────────────────────────────────

/**
 * Returns the most recent quote for a given party name.
 * Used to surface "You last quoted X ₹Y/m for Quality Z on Date" in the estimator.
 * Only fires when partyName is 3+ chars (enforced by the caller).
 */
export async function getLastQuoteForParty(partyName: string): Promise<{
    data?: {
        quality_label:        string
        quote_price_per_meter: number
        landed_cost_per_meter: number
        created_at:            string
        order_id:              string | null
    }
    error?: string
}> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('estimator_quotes')
        .select('quality_label, quote_price_per_meter, landed_cost_per_meter, created_at, order_id')
        .eq('org_id', profile.org_id)
        .ilike('party_name', partyName.trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) return { error: error.message }
    if (!data) return {}
    return { data }
}

// ─── Monthly Output Suggestion ────────────────────────────────────────────────

/**
 * Suggests a monthly output value by summing production_logs metres
 * over the last 30 days, divided by the number of active production days.
 */
export async function getMonthlyOutputSuggestion(): Promise<{
    data?: {
        avg30Days: number
        avg90Days: number
        lastUpdated: string
    }
    error?: string
}> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const now = new Date()
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const since90 = ninetyDaysAgo.toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('production_logs')
        .select('meters, date')
        .eq('org_id', profile.org_id)
        .gte('date', since90)

    if (error) return { error: error.message }
    if (!data || data.length === 0) {
        return { data: { avg30Days: 0, avg90Days: 0, lastUpdated: now.toISOString() } }
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const since30 = thirtyDaysAgo.toISOString().split('T')[0]

    const logs30 = data.filter(r => r.date >= since30)
    const total30 = logs30.reduce((s, r) => s + Number(r.meters ?? 0), 0)
    const days30  = new Set(logs30.map(r => r.date)).size
    const avg30Days = days30 > 0 ? Math.round((total30 / days30) * 26) : 0

    const total90 = data.reduce((s, r) => s + Number(r.meters ?? 0), 0)
    const days90  = new Set(data.map(r => r.date)).size
    const avg90Days = days90 > 0 ? Math.round((total90 / days90) * 26) : 0

    return { 
        data: { 
            avg30Days, 
            avg90Days, 
            lastUpdated: now.toISOString() 
        } 
    }
}

// ─── Quote History ────────────────────────────────────────────────────────────

export async function getEstimatorQuotes(filters?: { status?: string }) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    let query = supabase
        .from('estimator_quotes')
        .select(`
            *,
            orders!estimator_quotes_order_id_fkey ( id, status )
        `)
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

    if (filters?.status) {
        query = query.eq('status', filters.status)
    }

    const { data, error } = await query
    if (error) return { error: error.message }
    return { data }
}

export async function updateQuoteStatus(id: string, status: 'draft' | 'sent' | 'accepted' | 'rejected') {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data: current, error: currentError } = await supabase
        .from('estimator_quotes')
        .select('id, status, order_id')
        .eq('id', id)
        .eq('org_id', profile.org_id)
        .single()

    if (currentError || !current) return { error: currentError?.message ?? 'Quote not found.' }
    if (current.order_id) return { error: 'Converted quotes can no longer change status.' }

    const allowedTransitions: Record<string, string[]> = {
        draft: ['sent'],
        sent: ['accepted', 'rejected'],
        accepted: [],
        rejected: [],
    }

    if (!allowedTransitions[current.status]?.includes(status)) {
        return { error: `Invalid quote transition from "${current.status}" to "${status}".` }
    }

    const { data, error } = await supabase
        .from('estimator_quotes')
        .update({ status })
        .eq('id', id)
        .eq('org_id', profile.org_id)
        .select()
        .single()

    if (error) return { error: error.message }
    
    revalidatePath('/owner/quotes')
    return { success: true, data }
}

// ─── Market Run — Create ──────────────────────────────────────────────────────

/**
 * Creates a Market Run from estimator output.
 * Steps:
 *   1. Save the estimator snapshot as an estimator_quote (market mode)
 *   2. Create the market_runs record with cost anchor
 *   3. Link quote → market_run bidirectionally
 *   4. Create a backing production order (party_name = fabric_label, market_run_id set)
 *   5. Returns { marketRunId } for redirect
 */
export async function createMarketRunFromEstimator(params: {
    fabricLabel:             string
    qualityLabel:            string
    warpInstruction?:        string
    weftInstruction?:        string
    targetMeters:            number
    estimate:                EstimateState
    totalProductionCostPerM: number
    workerRatePerM:          number
    notes?:                  string
    deadline:                string
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const targetMeters = Number(params.targetMeters)
    if (!Number.isFinite(targetMeters) || targetMeters <= 0) {
        return { error: 'Target meters must be greater than 0.' }
    }
    if (!params.fabricLabel.trim()) {
        return { error: 'Fabric label is required.' }
    }

    const { estimate } = params
    const validationError = getFirstEstimatorValidationMessage(validateEstimatorQuoteBoundary({
        estimate,
        totalProductionCostPerM: params.totalProductionCostPerM,
        quotePricePerM: params.totalProductionCostPerM,
        targetMeters,
    }))
    if (validationError) return { error: validationError }

    const workerRatePerM = normalizeCurrencySnapshot(params.workerRatePerM)

    // 1. Save estimator snapshot as a quote (party_name = fabric label for display)
    const { data: savedQuote, error: quoteError } = await supabase
        .from('estimator_quotes')
        .insert({
            org_id:               profile.org_id,
            party_name:           params.fabricLabel.trim(),   // fabric label used as party placeholder
            quality_label:        params.qualityLabel.trim(),
            warp_instruction:     params.warpInstruction?.trim(),
            weft_instruction:     params.weftInstruction?.trim(),
            warp_rows:            estimate.warpRows,
            weft_rows:            estimate.weftRows,
            per_pick_cost_paise:  estimate.perPickCostPaisa,
            tape_length_m:        estimate.tapeLengthM,
            warp_crimp_pct:       estimate.warpCrimpPct ?? 0,
            warping_rate_per_kg:  estimate.warpingRatePerKg,
            sizing_rate_per_kg:   estimate.sizingRatePerKg,
            winding_rate_per_kg:  estimate.windingRatePerKg,
            processing_rate_per_m: estimate.processingRatePerM,
            finishing_rate_per_m: estimate.finishingRatePerM,
            overhead_items:       estimate.overheadItems,
            monthly_output_m:     estimate.monthlyOutputM,
            overhead_override_per_m: estimate.overheadOverridePerM ?? null,
            overhead_pct:         estimate.overheadPct,
            commission_pct:       estimate.commissionPct,
            transport_per_m:      estimate.transportPerM,
            order_quantity_m:     targetMeters,
            profit_margin_pct:    estimate.profitPct,
            enabled_sections:     estimate.enabledSections,
            loom_type:            estimate.loomType ?? null,
            estimator_rpm:        estimate.loomRpm ?? null,
            estimator_power_kw:   estimate.loomPowerKw ?? null,
            hours_per_shift:      estimate.hoursPerShift,
            sizing_mode:          estimate.sizingMode,
            landed_cost_per_meter:    params.totalProductionCostPerM,
            quote_price_per_meter:    params.totalProductionCostPerM,  // cost price = quote price for market runs
            intended_margin_percent:  estimate.profitPct,
            meters:                   targetMeters,
            status:                   'accepted',       // auto-accept — no party negotiation needed
            worker_rate_per_m:        workerRatePerM,
            ppi:     Math.round(estimate.weftRows[0]?.picks ?? 68),
            yarn_denier: Math.round(estimate.warpRows[0]?.calcDenier ?? 75),
            yarn_rate_per_kg: estimate.warpRows[0]?.yarnRate ?? 0,
        })
        .select('id')
        .single()

    if (quoteError || !savedQuote) return { error: quoteError?.message ?? 'Failed to save estimator snapshot.' }

    // 2. Create market_runs record
    const { data: marketRun, error: runError } = await supabase
        .from('market_runs')
        .insert({
            org_id:           profile.org_id,
            fabric_label:     params.fabricLabel.trim(),
            quality_label:    params.qualityLabel.trim() || null,
            warp_instruction: params.warpInstruction?.trim() || null,
            weft_instruction: params.weftInstruction?.trim() || null,
            target_meters:    targetMeters,
            cost_per_meter:   params.totalProductionCostPerM,
            worker_rate_per_m: workerRatePerM,
            quote_id:         savedQuote.id,
            status:           'production',
            notes:            params.notes?.trim() || null,
        })
        .select('id')
        .single()

    if (runError || !marketRun) {
        // Cleanup orphaned quote
        await supabase.from('estimator_quotes').delete().eq('id', savedQuote.id).eq('org_id', profile.org_id)
        return { error: runError?.message ?? 'Failed to create market run.' }
    }

    // 3. Backlink quote → market_run
    await supabase
        .from('estimator_quotes')
        .update({ market_run_id: marketRun.id })
        .eq('id', savedQuote.id)
        .eq('org_id', profile.org_id)

    // 4. Create backing production order (no party_id — market run orders have no external party)
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            org_id:              profile.org_id,
            party_name:          params.fabricLabel.trim(),     // fabric label as display name
            quality_label:       params.qualityLabel.trim() || null,
            warp_instruction:    params.warpInstruction?.trim() ?? '',
            weft_instruction:    params.weftInstruction?.trim() ?? '',
            total_target_meters: targetMeters,
            start_date:          new Date().toISOString().split('T')[0],
            deadline:            params.deadline,
            status:              'active',
            worker_rate_per_m:   workerRatePerM,
            notes:               params.notes?.trim() ?? '',
            tracking_token:      generateTrackingToken(),
            market_run_id:       marketRun.id,
        })
        .select('id')
        .single()

    if (orderError || !order) {
        // Cleanup
        await supabase.from('market_runs').delete().eq('id', marketRun.id).eq('org_id', profile.org_id)
        await supabase.from('estimator_quotes').delete().eq('id', savedQuote.id).eq('org_id', profile.org_id)
        return { error: orderError?.message ?? 'Failed to create production order.' }
    }

    await supabase
        .from('estimator_quotes')
        .update({ order_id: order.id, market_run_id: marketRun.id })
        .eq('id', savedQuote.id)
        .eq('org_id', profile.org_id)

    // 5. Compute and store yarn requirements (same as quote-to-order flow)
    const estimateForOrder = {
        ...estimate,
        orderQuantityM: targetMeters,
    }
    const { calcFullTotals: calc } = await import('@/lib/estimator')
    const totals = calc(estimateForOrder)
    const warpRequiredKg = (totals.totalWarpKgPer100m / 100) * targetMeters
    const weftRequiredKg = ((totals.totalAllYarnKgPer100m - totals.totalWarpKgPer100m) / 100) * targetMeters
    const totalRequiredKg = warpRequiredKg + weftRequiredKg
    const estimatedBeams = totals.estimatedBeamCapacityM > 0
        ? Math.max(1, Math.ceil(targetMeters / totals.estimatedBeamCapacityM))
        : null

    await supabase
        .from('order_yarn_requirements')
        .upsert({
            org_id: profile.org_id,
            order_id: order.id,
            quote_id: savedQuote.id,
            warp_required_kg: Number(warpRequiredKg.toFixed(3)),
            weft_required_kg: Number(weftRequiredKg.toFixed(3)),
            total_required_kg: Number(totalRequiredKg.toFixed(3)),
            estimated_beams: estimatedBeams,
            requirement_snapshot: {
                order_quantity_m: targetMeters,
                estimated_beam_capacity_m: totals.estimatedBeamCapacityM,
                warp_rows: estimate.warpRows,
                weft_rows: estimate.weftRows,
                warp_crimp_pct: estimate.warpCrimpPct ?? 0,
                yarn_shortage_pct: estimate.yarnShortagePct ?? 0,
            },
        }, { onConflict: 'order_id' })

    revalidatePath('/owner/market-runs')
    revalidatePath('/owner/orders')
    revalidatePath('/owner/analytics')
    revalidatePath('/owner/machines')
    revalidatePath('/supervisor/machines')
    return { success: true, marketRunId: marketRun.id }
}

// ─── Market Run — Read ────────────────────────────────────────────────────────

export async function getMarketRuns(options: { includeArchived?: boolean } = {}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('market_run_summary')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    const rows = data ?? []
    if (options.includeArchived) return { data: rows }

    return {
        data: rows.filter((run) => {
            const displayStatus = getMarketRunDisplayStatus({
                storedStatus: run.status,
                producedQuantity: run.total_meters_produced,
                availableQuantity: run.meters_in_godown,
                soldQuantity: run.total_meters_sold,
            })
            return !['sold_out', 'closed'].includes(displayStatus)
        }),
    }
}

export async function getMarketRunDetail(marketRunId: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data: run, error } = await supabase
        .from('market_run_summary')
        .select('*')
        .eq('market_run_id', marketRunId)
        .eq('org_id', profile.org_id)
        .single()

    if (error || !run) return { error: error?.message ?? 'Market run not found.' }

    const { data: quote, error: quoteError } = await supabase
        .from('estimator_quotes')
        .select('*')
        .eq('id', run.quote_id)
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (quoteError) return { error: quoteError.message }

    // Fetch both direct market run sales and stock sales from fabric_stock_sales
    const [salesRes, stockSalesRes] = await Promise.all([
        supabase
            .from('market_run_sales')
            .select(`
                *,
                parties ( id, name, phone )
            `)
            .eq('market_run_id', marketRunId)
            .eq('org_id', profile.org_id),
        supabase
            .from('fabric_stock_sales')
            .select(`
                id,
                sale_date,
                meters_sold,
                price_per_meter,
                cost_per_meter,
                dispatch_status,
                party_name,
                party_phone,
                notes,
                fabric_stock_lots!inner (
                    market_run_id
                )
            `)
            .eq('fabric_stock_lots.market_run_id', marketRunId)
            .eq('org_id', profile.org_id)
    ])

    if (salesRes.error) return { error: salesRes.error.message }
    if (stockSalesRes.error) return { error: stockSalesRes.error.message }

    const directSales = (salesRes.data ?? []).map((s) => ({
        id: s.id,
        market_run_id: marketRunId,
        party_id: s.party_id,
        invoice_id: s.invoice_id,
        meters_sold: Number(s.meters_sold),
        price_per_meter: Number(s.price_per_meter),
        cost_per_meter: Number(s.cost_per_meter),
        status: s.status as 'pending' | 'dispatched' | 'settled',
        sale_date: s.sale_date,
        notes: s.notes,
        parties: Array.isArray(s.parties) ? s.parties[0] : s.parties
    }))

    const stockSalesMapped = (stockSalesRes.data ?? []).map((ss) => ({
        id: ss.id,
        market_run_id: marketRunId,
        party_id: '',
        invoice_id: null,
        meters_sold: Number(ss.meters_sold),
        price_per_meter: Number(ss.price_per_meter),
        cost_per_meter: Number(ss.cost_per_meter),
        status: (ss.dispatch_status === 'received'
            ? 'settled'
            : (ss.dispatch_status === 'dispatched' || ss.dispatch_status === 'discrepancy')
                ? 'dispatched'
                : 'pending') as 'pending' | 'dispatched' | 'settled',
        sale_date: ss.sale_date,
        notes: ss.notes,
        parties: {
            id: '',
            name: ss.party_name || 'Stock Sale',
            phone: ss.party_phone,
        }
    }))

    const combinedSales = [...directSales, ...stockSalesMapped].sort(
        (a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()
    )

    return { data: { run, quote: quote ?? null, sales: combinedSales } }
}

// ─── Market Run — Record a Sale ───────────────────────────────────────────────

export async function createMarketRunSaleAction(params: {
    marketRunId:   string
    partyId:       string
    metersSold:    number
    pricePerMeter: number
    saleDate:      string
    invoiceNumber: string
    dueDays?:      number     // days from sale date → due date
    notes?:        string
}) {
    await requireRole(['owner'])
    void params
    return {
        error: 'Direct market-run sale is disabled. Sell from Godown Stock so the sale creates exactly one commercial receivable.',
    }
}

// ─── Market Run — Update Status ───────────────────────────────────────────────

export async function updateMarketRunStatus(
    marketRunId: string,
    status: 'production' | 'in_godown' | 'partially_sold' | 'sold_out' | 'closed'
) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('market_runs')
        .update({ status })
        .eq('id', marketRunId)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    if (status === 'closed') {
        const { data: backingOrders } = await supabase
            .from('orders')
            .select('id')
            .eq('market_run_id', marketRunId)
            .eq('org_id', profile.org_id)

        if (backingOrders && backingOrders.length > 0) {
            const orderIds = backingOrders.map(o => o.id)

            // Set backing orders to completed
            await supabase
                .from('orders')
                .update({ status: 'completed' })
                .in('id', orderIds)
                .eq('org_id', profile.org_id)

            // Unlink all machines assigned to these orders and set them to inactive
            await supabase
                .from('machines')
                .update({ current_order_id: null, status: 'inactive' })
                .in('current_order_id', orderIds)
                .eq('org_id', profile.org_id)
        }
    }

    revalidatePath(`/owner/market-runs/${marketRunId}`)
    revalidatePath('/owner/market-runs')
    revalidatePath('/owner/archive')
    revalidatePath('/owner/stock')
    revalidatePath('/owner/machines')
    revalidatePath('/supervisor/machines')
    return { success: true }
}
