'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getEstimatorSettings() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('estimator_settings')
        .select('*')
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (error) return { error: error.message }

    // Auto-create settings row if first visit
    if (!data) {
        const { data: created, error: createError } = await supabase
            .from('estimator_settings')
            .insert({
                org_id: profile.org_id,
                machine_rate_per_m: 1.50,
                daily_overhead: 0,
                total_active_machines: 24,
                gst_rate: 5.0,
            })
            .select()
            .single()

        if (createError) return { error: createError.message }
        return { data: created }
    }

    return { data }
}

export async function updateEstimatorSettings(data: {
    machine_rate_per_m: number
    daily_overhead: number
    total_active_machines: number
    gst_rate: number
    is_gst_inclusive: boolean
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('estimator_settings')
        .upsert({
            org_id: profile.org_id,
            ...data,
        })

    if (error) return { error: error.message }

    revalidatePath('/owner/estimator')
    return { success: true }
}

// ─── Templates ───────────────────────────────────────────────────────────────

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
    name: string
    yarn_denier: number
    calculated_yarn_denier: number
    beam_ends: number
    picks_per_cm?: number        // stored as ppi for backward compat
    reed_space_cm?: number       // stored as reed_space
    weft_denier: number
    tape_length_m: number
    shrinkage_pct: number
    machine_rate_per_m: number
    default_yarn_rate: number
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('estimator_templates')
        .insert({
            org_id: profile.org_id,
            name: data.name,
            yarn_denier: data.yarn_denier,
            calculated_yarn_denier: data.calculated_yarn_denier,
            beam_ends: data.beam_ends,
            ppi: data.picks_per_cm ?? 23,
            reed_space: data.reed_space_cm ?? 110,
            weft_denier: data.weft_denier,
            tape_length_m: data.tape_length_m,
            shrinkage_pct: data.shrinkage_pct,
            machine_rate_per_m: data.machine_rate_per_m,
            default_yarn_rate: data.default_yarn_rate,
            is_active: true,
        })

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

// ─── Quotes & Orders ─────────────────────────────────────────────────────────

export async function saveEstimatorQuote(data: {
    party_name: string
    quality_label: string
    warp_instruction?: string
    weft_instruction?: string
    yarn_denier: number
    calculated_yarn_denier: number
    beam_ends: number
    picks_per_cm: number
    reed_space_cm: number
    weft_denier: number
    tape_length_m: number
    shrinkage_pct: number
    yarn_rate_per_kg: number
    machine_rate_per_m: number
    daily_overhead: number
    quote_price_per_m: number
    margin_pct: number
    meters: number
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data: saved, error } = await supabase
        .from('estimator_quotes')
        .insert({
            org_id: profile.org_id,
            party_name: data.party_name,
            quality_label: data.quality_label,
            warp_instruction: data.warp_instruction,
            weft_instruction: data.weft_instruction,
            // Technical snapshot
            yarn_denier: data.yarn_denier,
            beam_ends: data.beam_ends,
            reed_space: data.reed_space_cm,
            shrinkage_pct: data.shrinkage_pct,
            weft_denier: data.weft_denier,
            tape_length_m: data.tape_length_m,
            machine_rate_per_m: data.machine_rate_per_m,
            daily_overhead: data.daily_overhead,
            // Legacy compat fields
            ppi: data.picks_per_cm,
            gsm: null,
            yarn_rate_per_kg: data.yarn_rate_per_kg,
            meters: data.meters,
            quote_price_per_meter: data.quote_price_per_m,
            intended_margin_percent: data.margin_pct,
            landed_cost_per_meter: data.quote_price_per_m / (1 + data.margin_pct / 100),
        })
        .select('id')
        .single()

    if (error) return { error: error.message }

    return { success: true, quoteId: saved.id }
}

export async function convertQuoteToOrder(data: {
    party_name: string
    quality_label: string
    warp_instruction?: string
    weft_instruction?: string
    total_target_meters: number
    deadline: string
    // Quote snapshot fields
    yarn_denier?: number
    calculated_yarn_denier?: number
    beam_ends?: number
    picks_per_cm?: number
    reed_space_cm?: number
    weft_denier?: number
    tape_length_m?: number
    shrinkage_pct?: number
    yarn_rate_per_kg?: number
    machine_rate_per_m?: number
    daily_overhead?: number
    quote_price_per_m?: number
    margin_pct?: number
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // 1. Save the quote snapshot first
    let quoteId: string | undefined
    if (data.yarn_rate_per_kg && data.quote_price_per_m) {
        const quoteRes = await saveEstimatorQuote({
            party_name: data.party_name,
            quality_label: data.quality_label,
            warp_instruction: data.warp_instruction,
            weft_instruction: data.weft_instruction,
            yarn_denier: data.yarn_denier ?? 75,
            calculated_yarn_denier: data.calculated_yarn_denier ?? 75,
            beam_ends: data.beam_ends ?? 3200,
            picks_per_cm: data.picks_per_cm ?? 23,
            reed_space_cm: data.reed_space_cm ?? 110,
            weft_denier: data.weft_denier ?? 75,
            tape_length_m: data.tape_length_m ?? 100,
            shrinkage_pct: data.shrinkage_pct ?? 5,
            yarn_rate_per_kg: data.yarn_rate_per_kg,
            machine_rate_per_m: data.machine_rate_per_m ?? 1.5,
            daily_overhead: data.daily_overhead ?? 0,
            quote_price_per_m: data.quote_price_per_m,
            margin_pct: data.margin_pct ?? 10,
            meters: data.total_target_meters,
        })
        if (quoteRes.quoteId) quoteId = quoteRes.quoteId
    }

    // 2. Create the flat order (no quality_id required)
    const { data: order, error } = await supabase
        .from('orders')
        .insert({
            org_id: profile.org_id,
            party_name: data.party_name,
            quality_label: data.quality_label,
            warp_instruction: data.warp_instruction ?? '',
            weft_instruction: data.weft_instruction ?? '',
            total_target_meters: data.total_target_meters,
            start_date: new Date().toISOString().split('T')[0],
            deadline: data.deadline,
            status: 'active',
            // Link quote if saved
            ...(quoteId ? {} : {}),  // estimator_quotes.order_id will be updated separately
        })
        .select('id')
        .single()

    if (error) return { error: error.message }

    // 3. Link quote to order if we have both IDs
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
