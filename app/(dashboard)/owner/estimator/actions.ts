'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { EstimateState, FactorySections, WarpRow, WeftRow, OverheadItem } from '@/lib/estimator'
import crypto from 'crypto'

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
    warpCrimpPct?:    number
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
            warp_crimp_pct:      data.warpCrimpPct ?? 0,
            yarn_shortage_pct:   data.yarnShortagePct ?? 0,
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
            // Legacy sync
            yarn_denier:         Math.round(firstWarp?.calcDenier ?? 75),
            calculated_yarn_denier: firstWarp?.calcDenier ?? 75,
            beam_ends:           firstWarp?.beamEnds ?? 3200,
            ppi:                 Math.round(firstWeft?.picks ?? 68),
            reed_space:          firstWeft?.reedSpace ?? 62,
            weft_denier:         firstWeft?.calcDenier ?? 75,
            default_yarn_rate:   firstWarp?.yarnRate ?? 107,
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

    // Compute loom-worker wage rate: Σ(picks across all weft rows) × perPickCostPaisa
    // e.g. 58 picks × 0.16 = ₹9.28/m — this is what the weaver earns per metre
    const workerRatePerM =
        estimate.weftRows.reduce((sum, r) => sum + (r.picks ?? 0), 0)
        * (estimate.perPickCostPaisa ?? 0)

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
            // Result snapshots
            landed_cost_per_meter:    params.totalProductionCostPerM,
            quote_price_per_meter:    params.quotePricePerM,
            intended_margin_percent:  estimate.profitPct,
            meters:                   estimate.orderQuantityM ?? 0,
            // Weaver wage rate snapshot — flows downstream to shift_assignments
            worker_rate_per_m:    workerRatePerM,
            // Legacy required fields with sane defaults
            ppi:     estimate.weftRows[0]?.picks ?? 68,
            yarn_denier: estimate.warpRows[0]?.calcDenier ?? 75,
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
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // 1. Save quote snapshot whenever estimate data is present
    // Note: quote_price_per_m may be 0 when no order qty is set, but we still save
    // so it appears in Quote History. Use totalProductionCostPerM as minimum fallback.
    let quoteId: string | undefined
    if (data.estimate) {
        const effectiveQuotePrice = (data.quote_price_per_m && data.quote_price_per_m > 0)
            ? data.quote_price_per_m
            : (data.totalProductionCostPerM ?? 0)
        const quoteRes = await saveEstimatorQuoteV3({
            partyName:               data.party_name,
            qualityLabel:            data.quality_label,
            warpInstruction:         data.warp_instruction,
            weftInstruction:         data.weft_instruction,
            estimate:                data.estimate,
            totalProductionCostPerM: data.totalProductionCostPerM ?? 0,
            quotePricePerM:          effectiveQuotePrice,
        })
        if (quoteRes.error) {
            console.error('Failed to save estimator quote:', quoteRes.error)
            // Don't block order creation if quote save fails — log and continue
            console.warn('Continuing with order creation despite quote save failure')
        } else if (quoteRes.quoteId) {
            quoteId = quoteRes.quoteId
        }
    }

    // 2. Compute worker rate from estimate (if present) — same formula as saveEstimatorQuoteV3
    let orderWorkerRatePerM: number | undefined
    if (data.estimate) {
        orderWorkerRatePerM =
            data.estimate.weftRows.reduce((sum, r) => sum + (r.picks ?? 0), 0)
            * (data.estimate.perPickCostPaisa ?? 0)
    }

    // 3. Create the order
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
            // Weaver wage rate snapshot from quote — supervisors see this on shift setup
            worker_rate_per_m:    orderWorkerRatePerM ?? null,
            notes:                data.notes ?? '',
            // Dispatch Bridge: unique 12-char tracking token for the Trader portal
            tracking_token:       generateTrackingToken(),
        })
        .select('id, tracking_token')
        .single()

    if (error) return { error: error.message }

    // 4. Link quote → order
    if (quoteId && order?.id) {
        await supabase
            .from('estimator_quotes')
            .update({ order_id: order.id })
            .eq('id', quoteId)
            .eq('org_id', profile.org_id)
    }

    revalidatePath('/owner/orders')
    revalidatePath('/owner/analytics')
    revalidatePath('/owner/quotes')
    return { success: true, orderId: order?.id }
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
            orders ( id, status )
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
