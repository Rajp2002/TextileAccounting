'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { calcFullTotals, makeDefaultEstimateState, type EstimateState, type FactorySections, type WarpRow, type WeftRow, type OverheadItem } from '@/lib/estimator'
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
    loomType?:        string | null
    loomRpm?:         number | null
    loomPowerKw?:     number | null
    sizingMode?:      'in_house' | 'outsourced'
    hoursPerShift?:   number
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
    loomType?:        string | null
    loomRpm?:         number | null
    loomPowerKw?:     number | null
    sizingMode?:      'in_house' | 'outsourced'
    hoursPerShift?:   number
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
    status?:            'draft' | 'sent' | 'accepted' | 'rejected'
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
    void data
    return {
        error: 'Direct order creation from the estimator has been retired. Save the quote, accept it, then convert it from Quote History.',
    }
}

function hydrateEstimateStateFromQuote(quote: Record<string, unknown>, totalTargetMeters: number): EstimateState {
    const base = makeDefaultEstimateState()

    return {
        ...base,
        warpRows: Array.isArray(quote.warp_rows) && quote.warp_rows.length > 0 ? (quote.warp_rows as WarpRow[]) : base.warpRows,
        weftRows: Array.isArray(quote.weft_rows) && quote.weft_rows.length > 0 ? (quote.weft_rows as WeftRow[]) : base.weftRows,
        tapeLengthM: Number(quote.tape_length_m ?? base.tapeLengthM),
        perPickCostPaisa: Number(quote.per_pick_cost_paise ?? base.perPickCostPaisa),
        warpingRatePerKg: Number(quote.warping_rate_per_kg ?? base.warpingRatePerKg),
        sizingRatePerKg: Number(quote.sizing_rate_per_kg ?? base.sizingRatePerKg),
        windingRatePerKg: Number(quote.winding_rate_per_kg ?? base.windingRatePerKg),
        processingRatePerM: Number(quote.processing_rate_per_m ?? base.processingRatePerM),
        finishingRatePerM: Number(quote.finishing_rate_per_m ?? base.finishingRatePerM),
        yarnShortagePct: Number(quote.yarn_shortage_pct ?? base.yarnShortagePct),
        warpCrimpPct: Number(quote.warp_crimp_pct ?? base.warpCrimpPct),
        overheadItems: Array.isArray(quote.overhead_items) ? (quote.overhead_items as OverheadItem[]) : base.overheadItems,
        monthlyOutputM: Number(quote.monthly_output_m ?? base.monthlyOutputM),
        overheadOverridePerM: quote.overhead_override_per_m != null ? Number(quote.overhead_override_per_m) : base.overheadOverridePerM,
        overheadPct: Number(quote.overhead_pct ?? base.overheadPct),
        commissionPct: Number(quote.commission_pct ?? base.commissionPct),
        transportPerM: Number(quote.transport_per_m ?? base.transportPerM),
        profitPct: Number(quote.profit_margin_pct ?? quote.intended_margin_percent ?? base.profitPct),
        orderQuantityM: totalTargetMeters > 0 ? totalTargetMeters : (Number(quote.meters ?? 0) || null),
        enabledSections: (quote.enabled_sections as FactorySections) ?? base.enabledSections,
        loomType: (quote.loom_type as EstimateState['loomType']) ?? base.loomType,
        loomRpm: quote.estimator_rpm != null ? Number(quote.estimator_rpm) : base.loomRpm,
        loomPowerKw: quote.estimator_power_kw != null ? Number(quote.estimator_power_kw) : base.loomPowerKw,
        loomRpmIsCustomised: quote.estimator_rpm != null,
        loomPowerKwIsCustomised: quote.estimator_power_kw != null,
        hoursPerShift: Number(quote.hours_per_shift ?? base.hoursPerShift),
        sizingMode: (quote.sizing_mode as EstimateState['sizingMode']) ?? base.sizingMode,
        isConfigured: true,
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

    const { data: quote, error: quoteError } = await supabase
        .from('estimator_quotes')
        .select('*')
        .eq('id', data.quoteId)
        .eq('org_id', profile.org_id)
        .single()

    if (quoteError || !quote) return { error: 'Quote not found.' }
    if (quote.status !== 'accepted') return { error: 'Only accepted quotes can be converted into orders.' }
    if (quote.order_id) return { error: 'This quote has already been converted into an order.' }

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            org_id: profile.org_id,
            party_name: quote.party_name,
            quality_label: quote.quality_label,
            warp_instruction: quote.warp_instruction ?? '',
            weft_instruction: quote.weft_instruction ?? '',
            total_target_meters: targetMeters,
            start_date: new Date().toISOString().split('T')[0],
            deadline: data.deadline,
            status: 'active',
            worker_rate_per_m: quote.worker_rate_per_m ?? null,
            notes: data.notes?.trim() ?? '',
            tracking_token: generateTrackingToken(),
        })
        .select('id')
        .single()

    if (orderError || !order) return { error: orderError?.message ?? 'Failed to create order.' }

    const { error: linkError } = await supabase
        .from('estimator_quotes')
        .update({ order_id: order.id })
        .eq('id', quote.id)
        .eq('org_id', profile.org_id)
        .is('order_id', null)

    if (linkError) {
        await supabase
            .from('orders')
            .delete()
            .eq('id', order.id)
            .eq('org_id', profile.org_id)

        return { error: linkError.message }
    }

    const estimateForOrder = hydrateEstimateStateFromQuote(quote, targetMeters)
    const totals = calcFullTotals(estimateForOrder)
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
            quote_id: quote.id,
            warp_required_kg: Number(warpRequiredKg.toFixed(3)),
            weft_required_kg: Number(weftRequiredKg.toFixed(3)),
            total_required_kg: Number(totalRequiredKg.toFixed(3)),
            estimated_beams: estimatedBeams,
            requirement_snapshot: {
                order_quantity_m: targetMeters,
                estimated_beam_capacity_m: totals.estimatedBeamCapacityM,
                warp_rows: estimateForOrder.warpRows,
                weft_rows: estimateForOrder.weftRows,
                warp_crimp_pct: estimateForOrder.warpCrimpPct ?? 0,
                yarn_shortage_pct: estimateForOrder.yarnShortagePct ?? 0,
            },
        }, { onConflict: 'order_id' })

    revalidatePath('/owner/orders')
    revalidatePath('/owner/analytics')
    revalidatePath('/owner/quotes')
    return { success: true, orderId: order.id }
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
            worker_rate_per_m:        params.workerRatePerM,
            ppi:     estimate.weftRows[0]?.picks ?? 68,
            yarn_denier: estimate.warpRows[0]?.calcDenier ?? 75,
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
            worker_rate_per_m: params.workerRatePerM,
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
            worker_rate_per_m:   params.workerRatePerM,
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
    return { success: true, marketRunId: marketRun.id }
}

// ─── Market Run — Read ────────────────────────────────────────────────────────

export async function getMarketRuns() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('market_run_summary')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: data ?? [] }
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

    // Fetch sales with party name
    const { data: sales, error: salesError } = await supabase
        .from('market_run_sales')
        .select(`
            *,
            parties ( id, name, phone )
        `)
        .eq('market_run_id', marketRunId)
        .eq('org_id', profile.org_id)
        .order('sale_date', { ascending: false })

    if (salesError) return { error: salesError.message }

    return { data: { run, sales: sales ?? [] } }
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
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const metersSold = Number(params.metersSold)
    const price = Number(params.pricePerMeter)

    if (!Number.isFinite(metersSold) || metersSold <= 0) return { error: 'Meters sold must be greater than 0.' }
    if (!Number.isFinite(price) || price < 0) return { error: 'Price per meter must be 0 or greater.' }
    if (!params.invoiceNumber.trim()) return { error: 'Invoice number is required.' }

    const saleDate = params.saleDate || new Date().toISOString().split('T')[0]
    const dueDays  = params.dueDays ?? 30
    const dueDate  = new Date(new Date(saleDate).getTime() + dueDays * 86400000).toISOString().split('T')[0]

    const { data, error } = await supabase.rpc('create_market_run_sale', {
        p_market_run_id:   params.marketRunId,
        p_party_id:        params.partyId,
        p_meters_sold:     metersSold,
        p_price_per_meter: price,
        p_sale_date:       saleDate,
        p_notes:           params.notes?.trim() ?? null,
        p_invoice_number:  params.invoiceNumber.trim(),
        p_due_date:        dueDate,
    })

    if (error) return { error: error.message }

    revalidatePath(`/owner/market-runs/${params.marketRunId}`)
    revalidatePath('/owner/market-runs')
    return { success: true, result: data?.[0] ?? null }
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

    revalidatePath(`/owner/market-runs/${marketRunId}`)
    revalidatePath('/owner/market-runs')
    return { success: true }
}
