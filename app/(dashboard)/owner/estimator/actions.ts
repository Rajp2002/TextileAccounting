'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { EstimateState, FactorySections, WarpRow, WeftRow, OverheadItem } from '@/lib/estimator'
import { nanoid } from 'nanoid'

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
                enabled_sections: {
                    winding:    false,
                    processing: false,
                    finishing:  false,
                    commission: true,
                    transport:  false,
                },
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
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('factory_cost_profile')
        .upsert({
            factory_id: profile.org_id,
            ...data,
            updated_at: new Date().toISOString(),
        })

    if (error) return { error: error.message }

    revalidatePath('/owner/settings')
    revalidatePath('/owner/estimator')
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
    perPickCostPaisa: number
    yarnShortagePct?: number
    overheadOverridePerM?: number | null
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
            yarn_shortage_pct:   data.yarnShortagePct ?? 10,
            overhead_override_per_m: data.overheadOverridePerM ?? null,
            // Legacy display fields — cast to integer to satisfy old column types
            yarn_denier:         Math.round(firstWarp?.calcDenier ?? 75),
            calculated_yarn_denier: firstWarp?.calcDenier ?? 75,
            beam_ends:           firstWarp?.beamEnds ?? 3200,
            ppi:                 Math.round(firstWeft?.picks ?? 68),
            reed_space:          firstWeft?.reedSpace ?? 62,
            weft_denier:         firstWeft?.calcDenier ?? 75,
            default_yarn_rate:   firstWarp?.yarnRate ?? 107,
            gsm:                 80,   // legacy placeholder — not used in V3
            is_active:           true,
        })

    if (error) return { error: error.message }

    revalidatePath('/owner/estimator')
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
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { estimate } = params

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
            // Result snapshots
            landed_cost_per_meter:    params.totalProductionCostPerM,
            quote_price_per_meter:    params.quotePricePerM,
            intended_margin_percent:  estimate.profitPct,
            meters:                   estimate.orderQuantityM ?? 0,
            // Legacy required fields with sane defaults
            ppi:     estimate.weftRows[0]?.picks ?? 68,
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
    total_target_meters: number
    deadline:            string
    estimate?:           EstimateState
    quote_price_per_m?:  number
    totalProductionCostPerM?: number
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // 1. Save quote snapshot if estimate data is present
    let quoteId: string | undefined
    if (data.estimate && data.quote_price_per_m) {
        const quoteRes = await saveEstimatorQuoteV3({
            partyName:               data.party_name,
            qualityLabel:            data.quality_label,
            warpInstruction:         data.warp_instruction,
            weftInstruction:         data.weft_instruction,
            estimate:                data.estimate,
            totalProductionCostPerM: data.totalProductionCostPerM ?? 0,
            quotePricePerM:          data.quote_price_per_m,
        })
        if ('quoteId' in quoteRes && quoteRes.quoteId) quoteId = quoteRes.quoteId
    }

    // 2. Create the flat order
    const { data: order, error } = await supabase
        .from('orders')
        .insert({
            org_id:               profile.org_id,
            party_name:           data.party_name,
            quality_label:        data.quality_label,
            warp_instruction:     data.warp_instruction ?? '',
            weft_instruction:     data.weft_instruction ?? '',
            total_target_meters:  data.total_target_meters,
            start_date:           new Date().toISOString().split('T')[0],
            deadline:             data.deadline,
            status:               'active',
        })
        .select('id')
        .single()

    if (error) return { error: error.message }

    // 3. Link quote → order
    if (quoteId && order?.id) {
        await supabase
            .from('estimator_quotes')
            .update({ order_id: order.id })
            .eq('id', quoteId)
            .eq('org_id', profile.org_id)
    }

    revalidatePath('/owner/orders')
    revalidatePath('/owner/analytics')
    return { success: true, orderId: order?.id }
}
