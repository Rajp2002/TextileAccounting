'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import {
    BeamCardSchema,
    YarnLotSchema,
    YarnMovementSchema,
    safeParse,
} from '@/lib/schemas'

export interface InventoryOrderOption {
    id: string
    party_name: string
    quality_label: string
    total_target_meters: number
    deadline: string
}

export interface YarnLotSummary {
    id: string
    supplier: string
    bill_no: string
    bill_date: string
    yarn_type: string
    denier_count: string
    filament_material: string
    received_kg: number
    received_cones: number
    available_kg: number
    available_cones: number
    rate_per_kg: number
    gst_percent: number
    total_cost: number
    notes: string | null
}

export interface BeamCardLotUsage {
    id: string
    yarn_lot_id: string
    usage_type: 'warp' | 'weft'
    issued_kg: number
    issued_cones: number
    label: string
}

export interface BeamCardSummary {
    id: string
    beam_no: string
    order_id: string
    order_party_name: string
    quality_label: string
    beam_ends: number
    tape_length_m: number
    expected_metres: number
    actual_beam_weight_kg: number | null
    sizing_vendor: string | null
    sizing_bill_no: string | null
    notes: string | null
    created_at: string
    warp_lots: BeamCardLotUsage[]
}

export interface OrderVarianceSummary {
    id: string
    order_id: string
    party_name: string
    quality_label: string
    total_target_meters: number
    order_status: string
    warp_required_kg: number
    weft_required_kg: number
    total_required_kg: number
    warp_issued_kg: number
    weft_issued_kg: number
    total_issued_kg: number
    leftover_kg: number
    net_consumed_kg: number
    variance_kg: number
    estimated_beams: number | null
}

export interface MovementSummary {
    id: string
    movement_type: string
    movement_date: string
    quantity_kg: number
    cones: number
    notes: string | null
    adjustment_mode: 'add' | 'subtract' | null
    lot_label: string
    beam_no: string | null
    order_label: string | null
}

export interface InventorySummary {
    total_lot_value: number
    total_available_kg: number
    total_available_cones: number
    open_beams: number
    active_variance_orders: number
}

export interface InventoryModuleData {
    summary: InventorySummary
    activeOrders: InventoryOrderOption[]
    yarnLots: YarnLotSummary[]
    beamCards: BeamCardSummary[]
    orderVariance: OrderVarianceSummary[]
    recentMovements: MovementSummary[]
}

const INVENTORY_PATH = '/owner/inventory'
type DbRow = Record<string, unknown>

function toNumber(value: unknown): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function normaliseOptionalId(value?: string) {
    return value && value.length > 0 ? value : null
}

function movementConsumesStock(movementType: string, adjustmentMode?: string | null) {
    return movementType === 'issue_to_warping'
        || movementType === 'issue_to_sizing'
        || movementType === 'issue_to_loom_weft'
        || (movementType === 'adjustment' && adjustmentMode === 'subtract')
}

function toRow(value: unknown): DbRow | null {
    if (Array.isArray(value)) {
        return value.length > 0 && typeof value[0] === 'object' && value[0] !== null
            ? value[0] as DbRow
            : null
    }

    return typeof value === 'object' && value !== null ? value as DbRow : null
}

function toRowArray(value: unknown): DbRow[] {
    return Array.isArray(value) ? value.filter((item): item is DbRow => typeof item === 'object' && item !== null) : []
}

export async function getInventoryModuleData(): Promise<{ data?: InventoryModuleData; error?: string }> {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const [
        ordersRes,
        lotsRes,
        beamsRes,
        varianceRes,
        movementsRes,
    ] = await Promise.all([
        supabase
            .from('orders')
            .select('id, party_name, quality_label, total_target_meters, deadline')
            .eq('org_id', profile.org_id)
            .eq('status', 'active')
            .order('deadline', { ascending: true }),
        supabase
            .from('yarn_lot_stock_summary')
            .select('*')
            .eq('org_id', profile.org_id)
            .order('bill_date', { ascending: false }),
        supabase
            .from('beam_cards')
            .select(`
                id,
                beam_no,
                order_id,
                quality_label,
                beam_ends,
                tape_length_m,
                expected_metres,
                actual_beam_weight_kg,
                sizing_vendor,
                sizing_bill_no,
                notes,
                created_at,
                orders(id, party_name, quality_label),
                beam_card_lots(
                    id,
                    yarn_lot_id,
                    usage_type,
                    issued_kg,
                    issued_cones,
                    yarn_lots(supplier, bill_no, yarn_type, denier_count, filament_material)
                )
            `)
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false }),
        supabase
            .from('order_yarn_variance_summary')
            .select('*')
            .eq('org_id', profile.org_id)
            .order('updated_at', { ascending: false }),
        supabase
            .from('yarn_movements')
            .select(`
                id,
                movement_type,
                movement_date,
                quantity_kg,
                cones,
                notes,
                adjustment_mode,
                yarn_lots(supplier, bill_no, yarn_type, denier_count),
                beam_cards(beam_no),
                orders(party_name, quality_label)
            `)
            .eq('org_id', profile.org_id)
            .order('movement_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(25),
    ])

    const error = ordersRes.error || lotsRes.error || beamsRes.error || varianceRes.error || movementsRes.error
    if (error) {
        return { error: error.message }
    }

    const activeOrders: InventoryOrderOption[] = ((ordersRes.data ?? []) as DbRow[]).map((row) => ({
        id: String(row.id),
        party_name: String(row.party_name ?? 'Unnamed Party'),
        quality_label: String(row.quality_label ?? 'Unlabelled'),
        total_target_meters: toNumber(row.total_target_meters),
        deadline: String(row.deadline),
    }))

    const yarnLots: YarnLotSummary[] = ((lotsRes.data ?? []) as DbRow[]).map((row) => ({
        id: String(row.id),
        supplier: String(row.supplier),
        bill_no: String(row.bill_no),
        bill_date: String(row.bill_date),
        yarn_type: String(row.yarn_type),
        denier_count: String(row.denier_count),
        filament_material: String(row.filament_material),
        received_kg: toNumber(row.received_kg),
        received_cones: toNumber(row.received_cones),
        available_kg: toNumber(row.available_kg),
        available_cones: toNumber(row.available_cones),
        rate_per_kg: toNumber(row.rate_per_kg),
        gst_percent: toNumber(row.gst_percent),
        total_cost: toNumber(row.total_cost),
        notes: row.notes == null ? null : String(row.notes),
    }))

    const beamCards: BeamCardSummary[] = ((beamsRes.data ?? []) as DbRow[]).map((row) => {
        const order = toRow(row.orders)
        const lotRows = toRowArray(row.beam_card_lots)

        return {
            id: String(row.id),
            beam_no: String(row.beam_no),
            order_id: String(row.order_id),
            order_party_name: String(order?.party_name ?? 'Unknown Order'),
            quality_label: String(row.quality_label ?? order?.quality_label ?? 'Unlabelled'),
            beam_ends: toNumber(row.beam_ends),
            tape_length_m: toNumber(row.tape_length_m),
            expected_metres: toNumber(row.expected_metres),
            actual_beam_weight_kg: row.actual_beam_weight_kg == null ? null : toNumber(row.actual_beam_weight_kg),
            sizing_vendor: row.sizing_vendor == null ? null : String(row.sizing_vendor),
            sizing_bill_no: row.sizing_bill_no == null ? null : String(row.sizing_bill_no),
            notes: row.notes == null ? null : String(row.notes),
            created_at: String(row.created_at),
            warp_lots: lotRows.map((lotRow) => {
                const lot = toRow(lotRow.yarn_lots)
                return {
                    id: String(lotRow.id),
                    yarn_lot_id: String(lotRow.yarn_lot_id),
                    usage_type: String(lotRow.usage_type) as 'warp' | 'weft',
                    issued_kg: toNumber(lotRow.issued_kg),
                    issued_cones: toNumber(lotRow.issued_cones),
                    label: `${lot?.supplier ?? 'Supplier'} · ${lot?.bill_no ?? 'Bill'} · ${lot?.yarn_type ?? ''} ${lot?.denier_count ?? ''}`.trim(),
                }
            }),
        }
    })

    const orderVariance: OrderVarianceSummary[] = ((varianceRes.data ?? []) as DbRow[]).map((row) => ({
        id: String(row.id),
        order_id: String(row.order_id),
        party_name: String(row.party_name ?? 'Unnamed Party'),
        quality_label: String(row.quality_label ?? 'Unlabelled'),
        total_target_meters: toNumber(row.total_target_meters),
        order_status: String(row.order_status ?? 'active'),
        warp_required_kg: toNumber(row.warp_required_kg),
        weft_required_kg: toNumber(row.weft_required_kg),
        total_required_kg: toNumber(row.total_required_kg),
        warp_issued_kg: toNumber(row.warp_issued_kg),
        weft_issued_kg: toNumber(row.weft_issued_kg),
        total_issued_kg: toNumber(row.total_issued_kg),
        leftover_kg: toNumber(row.leftover_kg),
        net_consumed_kg: toNumber(row.net_consumed_kg),
        variance_kg: toNumber(row.variance_kg),
        estimated_beams: row.estimated_beams == null ? null : toNumber(row.estimated_beams),
    }))

    const recentMovements: MovementSummary[] = ((movementsRes.data ?? []) as DbRow[]).map((row) => {
        const lot = toRow(row.yarn_lots)
        const beam = toRow(row.beam_cards)
        const order = toRow(row.orders)
        return {
            id: String(row.id),
            movement_type: String(row.movement_type),
            movement_date: String(row.movement_date),
            quantity_kg: toNumber(row.quantity_kg),
            cones: toNumber(row.cones),
            notes: row.notes == null ? null : String(row.notes),
            adjustment_mode: row.adjustment_mode == null ? null : String(row.adjustment_mode) as 'add' | 'subtract',
            lot_label: `${lot?.supplier ?? 'Supplier'} · ${lot?.bill_no ?? 'Bill'} · ${lot?.yarn_type ?? ''} ${lot?.denier_count ?? ''}`.trim(),
            beam_no: beam?.beam_no == null ? null : String(beam.beam_no),
            order_label: order ? `${order.party_name ?? 'Party'} · ${order.quality_label ?? 'Quality'}` : null,
        }
    })

    const summary: InventorySummary = {
        total_lot_value: yarnLots.reduce((sum, lot) => sum + lot.total_cost, 0),
        total_available_kg: yarnLots.reduce((sum, lot) => sum + lot.available_kg, 0),
        total_available_cones: yarnLots.reduce((sum, lot) => sum + lot.available_cones, 0),
        open_beams: beamCards.length,
        active_variance_orders: orderVariance.filter((row) => row.order_status === 'active').length,
    }

    return {
        data: {
            summary,
            activeOrders,
            yarnLots,
            beamCards,
            orderVariance,
            recentMovements,
        },
    }
}

export async function createYarnLot(input: {
    supplier: string
    bill_no: string
    bill_date: string
    yarn_type: string
    denier_count: string
    filament_material: string
    received_kg: number
    received_cones: number
    rate_per_kg: number
    gst_percent: number
    total_cost: number
    notes?: string
}) {
    const { profile, user } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(YarnLotSchema, input)
    if ('error' in parsed) return { error: parsed.error }

    const { data: lot, error } = await supabase
        .from('yarn_lots')
        .insert({
            org_id: profile.org_id,
            ...parsed.data,
            notes: parsed.data.notes || null,
        })
        .select('id')
        .single()

    if (error || !lot) return { error: error?.message ?? 'Failed to create yarn lot' }

    const { error: movementError } = await supabase
        .from('yarn_movements')
        .insert({
            org_id: profile.org_id,
            yarn_lot_id: lot.id,
            movement_type: 'purchase',
            movement_date: parsed.data.bill_date,
            quantity_kg: parsed.data.received_kg,
            cones: parsed.data.received_cones,
            notes: parsed.data.notes || `Purchase from ${parsed.data.supplier}`,
            created_by: user.id,
        })

    if (movementError) return { error: movementError.message }

    revalidatePath(INVENTORY_PATH)
    return { success: true }
}

export async function createBeamCard(input: {
    beam_no: string
    order_id: string
    quality_label: string
    beam_ends: number
    tape_length_m: number
    expected_metres: number
    actual_beam_weight_kg?: number | null
    sizing_vendor?: string
    sizing_bill_no?: string
    notes?: string
}) {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const parsed = safeParse(BeamCardSchema, input)
    if ('error' in parsed) return { error: parsed.error }

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, quality_label')
        .eq('id', parsed.data.order_id)
        .eq('org_id', profile.org_id)
        .single()

    if (orderError || !order) return { error: orderError?.message ?? 'Order not found for this organization' }

    const { error } = await supabase
        .from('beam_cards')
        .insert({
            org_id: profile.org_id,
            ...parsed.data,
            quality_label: parsed.data.quality_label || order.quality_label || 'Unlabelled',
            sizing_vendor: parsed.data.sizing_vendor || null,
            sizing_bill_no: parsed.data.sizing_bill_no || null,
            notes: parsed.data.notes || null,
        })

    if (error) return { error: error.message }

    revalidatePath(INVENTORY_PATH)
    return { success: true }
}

export async function recordYarnMovement(input: {
    yarn_lot_id: string
    movement_type: 'purchase' | 'issue_to_warping' | 'issue_to_sizing' | 'issue_to_loom_weft' | 'return_leftover' | 'adjustment'
    movement_date: string
    quantity_kg: number
    cones: number
    order_id?: string
    beam_card_id?: string
    adjustment_mode?: 'add' | 'subtract'
    notes?: string
}) {
    const { profile, user } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const parsed = safeParse(YarnMovementSchema, input)
    if ('error' in parsed) return { error: parsed.error }
    if (parsed.data.movement_type === 'purchase') {
        return { error: 'Create a yarn lot for purchases instead of a standalone purchase movement.' }
    }

    const { data: yarnLot, error: yarnLotError } = await supabase
        .from('yarn_lots')
        .select('id')
        .eq('id', parsed.data.yarn_lot_id)
        .eq('org_id', profile.org_id)
        .single()

    if (yarnLotError || !yarnLot) return { error: yarnLotError?.message ?? 'Yarn lot not found for this organization' }

    let resolvedOrderId = normaliseOptionalId(parsed.data.order_id)
    const resolvedBeamCardId = normaliseOptionalId(parsed.data.beam_card_id)

    if (resolvedBeamCardId) {
        const { data: beamCard, error: beamError } = await supabase
            .from('beam_cards')
            .select('id, order_id')
            .eq('id', resolvedBeamCardId)
            .eq('org_id', profile.org_id)
            .single()

        if (beamError || !beamCard) return { error: beamError?.message ?? 'Beam card not found' }
        resolvedOrderId = beamCard.order_id
    }

    if (resolvedOrderId) {
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id')
            .eq('id', resolvedOrderId)
            .eq('org_id', profile.org_id)
            .single()

        if (orderError || !order) return { error: orderError?.message ?? 'Order not found for this organization' }
    }

    if (movementConsumesStock(parsed.data.movement_type, parsed.data.adjustment_mode)) {
        const { data: stockRow, error: stockError } = await supabase
            .from('yarn_lot_stock_summary')
            .select('available_kg, available_cones')
            .eq('id', parsed.data.yarn_lot_id)
            .eq('org_id', profile.org_id)
            .single()

        if (stockError || !stockRow) return { error: stockError?.message ?? 'Unable to verify yarn stock' }

        if (toNumber(stockRow.available_kg) < parsed.data.quantity_kg) {
            return { error: 'Not enough kg available in this yarn lot.' }
        }

        if (toNumber(stockRow.available_cones) < parsed.data.cones) {
            return { error: 'Not enough cones available in this yarn lot.' }
        }
    }

    const { error } = await supabase
        .from('yarn_movements')
        .insert({
            org_id: profile.org_id,
            yarn_lot_id: parsed.data.yarn_lot_id,
            order_id: resolvedOrderId,
            beam_card_id: resolvedBeamCardId,
            movement_type: parsed.data.movement_type,
            adjustment_mode: parsed.data.adjustment_mode ?? null,
            movement_date: parsed.data.movement_date,
            quantity_kg: parsed.data.quantity_kg,
            cones: parsed.data.cones,
            notes: parsed.data.notes || null,
            created_by: user.id,
        })

    if (error) return { error: error.message }

    if (
        resolvedBeamCardId
        && ['issue_to_warping', 'issue_to_sizing', 'issue_to_loom_weft'].includes(parsed.data.movement_type)
    ) {
        const usageType = parsed.data.movement_type === 'issue_to_loom_weft' ? 'weft' : 'warp'
        const { data: existing, error: existingError } = await supabase
            .from('beam_card_lots')
            .select('id, issued_kg, issued_cones')
            .eq('org_id', profile.org_id)
            .eq('beam_card_id', resolvedBeamCardId)
            .eq('yarn_lot_id', parsed.data.yarn_lot_id)
            .eq('usage_type', usageType)
            .maybeSingle()

        if (existingError) return { error: existingError.message }

        if (existing?.id) {
            const { error: updateError } = await supabase
                .from('beam_card_lots')
                .update({
                    issued_kg: toNumber(existing.issued_kg) + parsed.data.quantity_kg,
                    issued_cones: toNumber(existing.issued_cones) + parsed.data.cones,
                })
                .eq('id', existing.id)
                .eq('org_id', profile.org_id)

            if (updateError) return { error: updateError.message }
        } else {
            const { error: insertError } = await supabase
                .from('beam_card_lots')
                .insert({
                    org_id: profile.org_id,
                    beam_card_id: resolvedBeamCardId,
                    yarn_lot_id: parsed.data.yarn_lot_id,
                    usage_type: usageType,
                    issued_kg: parsed.data.quantity_kg,
                    issued_cones: parsed.data.cones,
                })

            if (insertError) return { error: insertError.message }
        }
    }

    revalidatePath(INVENTORY_PATH)
    return { success: true }
}
