'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { LegacyOrderSellAndDispatchInput, SellAndDispatchInput, SellAndDispatchResult } from '@/lib/dispatch/sell-and-dispatch-types'
import { ensureReceivableForCommercialEntry } from '@/lib/commercials/receivables'

export async function getSellAndDispatchOptions() {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const [ordersRes, lotsRes] = await Promise.all([
        supabase
            .from('orders')
            .select('id, party_name, quality_label, status, total_target_meters')
            .eq('org_id', profile.org_id)
            .in('status', ['active', 'completed'])
            .order('deadline', { ascending: true }),
        supabase
            .from('fabric_stock_lot_summary')
            .select('stock_lot_id, quality_label, godown, source_type, market_run_id, available_taka_count, available_meters, meters_per_taka, cost_per_meter, order_id, unit_label')
            .eq('org_id', profile.org_id)
            .gt('available_meters', 0)
            .order('created_at', { ascending: false })
    ])

    return {
        orders: ordersRes.data || [],
        lots: lotsRes.data || []
    }
}

function toFiniteNumber(value: unknown) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function normalizeDate(value: string | null | undefined) {
    return value?.trim() || new Date().toISOString().slice(0, 10)
}

function cleanText(value: string | null | undefined) {
    const cleaned = value?.trim()
    return cleaned ? cleaned : null
}

function isMissingColumn(error: { code?: string; message?: string } | null | undefined, column: string) {
    return error?.code === '42703' || (error?.message ?? '').includes(column)
}

export type ConfirmDispatchReceivedInput = {
    dispatchId: string
    receivedMeters: number
    receivedAt: string
    note?: string | null
}

export async function confirmDispatchReceived(input: ConfirmDispatchReceivedInput): Promise<{
    success: true
    dispatchId: string
    receivedMeters: number
    receiptStatus: 'matched' | 'difference_reported'
    differenceMeters: number
} | { error: string }> {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const receivedMeters = Number(input.receivedMeters)
    if (!input.dispatchId) return { error: 'Dispatch is required' }
    if (!Number.isFinite(receivedMeters) || receivedMeters < 0) {
        return { error: 'Received meters must be zero or more' }
    }
    if (!input.receivedAt?.trim()) {
        return { error: 'Received date is required' }
    }

    const receivedAt = input.receivedAt.trim()
    const note = cleanText(input.note)

    const { data: dispatch, error: dispatchError } = await supabase
        .from('dispatches')
        .select(`
            id,
            org_id,
            order_id,
            stock_sale_id,
            qty_meters_sent,
            party_name,
            dispatched_at,
            orders (
                id,
                market_run_id,
                quality_label
            )
        `)
        .eq('id', input.dispatchId)
        .eq('org_id', profile.org_id)
        .single()

    if (dispatchError || !dispatch) return { error: 'Dispatch not found' }

    const sentMeters = Number(dispatch.qty_meters_sent)
    if (!Number.isFinite(sentMeters)) {
        return { error: 'Dispatched meters are missing for this dispatch' }
    }

    const differenceMeters = Number((receivedMeters - sentMeters).toFixed(2))
    const hasDifference = Math.abs(differenceMeters) > 0.01
    const receiptStatus = hasDifference ? 'difference_reported' : 'matched'

    const { error: updateError } = await supabase
        .from('dispatches')
        .update({
            received_meters: receivedMeters,
            qty_meters_received: receivedMeters,
            received_at: receivedAt,
            received_note: note,
            receipt_status: receiptStatus,
            status: 'delivered',
            receipt_confirmed_by_owner: true,
            receipt_confirmation_note: note,
            receipt_confirmed_by: user.id,
        })
        .eq('id', input.dispatchId)
        .eq('org_id', profile.org_id)

    if (updateError) return { error: updateError.message }

    const order = Array.isArray(dispatch.orders) ? dispatch.orders[0] : dispatch.orders
    let saleContext: {
        stock_lot_id: string | null
        order_id: string | null
        market_run_id: string | null
        quality_label: string | null
    } | null = null

    if (dispatch.stock_sale_id) {
        const { data: sale } = await supabase
            .from('fabric_stock_sales')
            .select(`
                id,
                stock_lot_id,
                fabric_stock_lots (
                    order_id,
                    market_run_id,
                    quality_label
                )
            `)
            .eq('id', dispatch.stock_sale_id)
            .eq('org_id', profile.org_id)
            .maybeSingle()

        const lot = Array.isArray(sale?.fabric_stock_lots) ? sale?.fabric_stock_lots[0] : sale?.fabric_stock_lots
        saleContext = sale ? {
            stock_lot_id: sale.stock_lot_id ?? null,
            order_id: lot?.order_id ?? null,
            market_run_id: lot?.market_run_id ?? null,
            quality_label: lot?.quality_label ?? null,
        } : null
    }

    if (hasDifference) {
        // Compatibility mapping: legacy stock_discrepancies.actual_dispatched_meters stores
        // the confirmed received meters for dispatch receipt nudges. This action does not
        // modify receivable total_amount, payment received, or claim/deduction settlement.
        const discrepancyPayload = {
            org_id: profile.org_id,
            dispatch_id: input.dispatchId,
            stock_lot_id: saleContext?.stock_lot_id ?? null,
            stock_sale_id: dispatch.stock_sale_id ?? null,
            order_id: dispatch.order_id ?? saleContext?.order_id ?? null,
            market_run_id: order?.market_run_id ?? saleContext?.market_run_id ?? null,
            quality_label: order?.quality_label ?? saleContext?.quality_label ?? null,
            expected_meters: sentMeters,
            actual_dispatched_meters: receivedMeters,
            actual_received_meters: receivedMeters,
            difference_meters: differenceMeters,
            discrepancy_type: differenceMeters < 0 ? 'shortage' : 'excess',
            source_reference: 'dispatch_receipt',
            discrepancy_date: receivedAt,
            notes: note ?? (
                differenceMeters < 0
                    ? `Receipt difference reported: ${Math.abs(differenceMeters).toFixed(2)}m short`
                    : `Receipt difference reported: ${differenceMeters.toFixed(2)}m extra`
            ),
            status: 'needs_review',
            created_by: user.id,
        }

        const { data: existing } = await supabase
            .from('stock_discrepancies')
            .select('id')
            .eq('org_id', profile.org_id)
            .eq('dispatch_id', input.dispatchId)
            .eq('source_reference', 'dispatch_receipt')
            .maybeSingle()

        const discrepancyQuery = existing?.id
            ? supabase.from('stock_discrepancies').update(discrepancyPayload).eq('id', existing.id).eq('org_id', profile.org_id)
            : supabase.from('stock_discrepancies').insert(discrepancyPayload)
        const { error: discrepancyError } = await discrepancyQuery

        if (discrepancyError && !isMissingColumn(discrepancyError, 'actual_received_meters')) {
            return { error: discrepancyError.message }
        }
    } else {
        await supabase
            .from('stock_discrepancies')
            .update({
                status: 'reviewed',
                resolved_at: new Date().toISOString(),
                resolved_by: user.id,
                notes: note ?? 'Receipt matched dispatch meters.',
            })
            .eq('org_id', profile.org_id)
            .eq('dispatch_id', input.dispatchId)
            .eq('source_reference', 'dispatch_receipt')
            .eq('status', 'needs_review')
    }

    revalidatePath('/owner/dispatches')
    revalidatePath('/owner/commercials')
    revalidatePath('/owner/today')

    return {
        success: true,
        dispatchId: input.dispatchId,
        receivedMeters,
        receiptStatus,
        differenceMeters,
    }
}

export async function markDiscrepancyReviewed(discrepancyId: string): Promise<{ success: true } | { error: string }> {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    if (!discrepancyId) return { error: 'Discrepancy is required' }

    const { error } = await supabase
        .from('stock_discrepancies')
        .update({
            status: 'reviewed',
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
        })
        .eq('id', discrepancyId)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    revalidatePath('/owner/dispatches')
    revalidatePath('/owner/commercials')
    revalidatePath('/owner/today')
    return { success: true }
}

export async function createPartyStockSaleAndOptionalDispatch(input: SellAndDispatchInput): Promise<SellAndDispatchResult> {
    await requireRole(['owner'])
    const supabase = await createServerClient()

    const partyName = cleanText(input.partyName)
    const saleDate = normalizeDate(input.saleDate)
    const creditDays = Math.trunc(toFiniteNumber(input.creditDays))
    const soldMeters = toFiniteNumber(input.soldMeters)
    const saleRatePerMeter = toFiniteNumber(input.saleRatePerMeter)
    const requestedDispatchMeters = input.dispatchNow ? toFiniteNumber(input.actualDispatchedMeters) : 0

    if (!input.sourceId || !input.sourceType) {
        return { success: false, stage: 'validation', message: 'Source stock is required' }
    }
    if (!partyName) {
        return { success: false, stage: 'validation', message: 'Party name is required' }
    }
    if (soldMeters <= 0) {
        return { success: false, stage: 'validation', message: 'Sold meters must be greater than 0' }
    }
    if (saleRatePerMeter <= 0) {
        return { success: false, stage: 'validation', message: 'Sale rate must be greater than 0' }
    }
    if (creditDays < 0) {
        return { success: false, stage: 'validation', message: 'Credit days cannot be negative' }
    }
    if (input.dispatchNow && (requestedDispatchMeters <= 0 || requestedDispatchMeters > soldMeters)) {
        return { success: false, stage: 'validation', message: 'Dispatched meters must be greater than 0 and not more than sold meters' }
    }
    const hasExplicitSoldTakas = input.soldTakas != null && String(input.soldTakas).trim() !== ''
    const soldTakas = hasExplicitSoldTakas ? toFiniteNumber(input.soldTakas) : null
    if (soldTakas != null && soldTakas <= 0) {
        return { success: false, stage: 'validation', message: 'Sold takas must be greater than 0' }
    }

    const { data, error } = await supabase.rpc('create_party_stock_sale_dispatch_v1', {
        p_source_type: input.sourceType,
        p_source_id: input.sourceId,
        p_party_name: partyName,
        p_party_phone: cleanText(input.partyPhone),
        p_party_city: cleanText(input.partyCity),
        p_party_gstin: cleanText(input.partyGstin),
        p_sold_meters: soldMeters,
        p_sold_takas: soldTakas,
        p_sale_rate_per_meter: saleRatePerMeter,
        p_credit_days: creditDays,
        p_sale_date: saleDate,
        p_dispatch_now: input.dispatchNow,
        p_actual_dispatched_meters: input.dispatchNow ? requestedDispatchMeters : null,
        p_dispatch_date: input.dispatchNow ? normalizeDate(input.dispatchDate) : null,
        p_transport_name: cleanText(input.transportName),
        p_vehicle_number: cleanText(input.vehicleNumber),
        p_challan_number: cleanText(input.challanNumber),
        p_notes: cleanText(input.notes),
    })

    if (error) {
        const message = error.message || 'Failed to create stock sale'
        const stage = /stock|available|sold|party|credit|rate|source|dispatch/i.test(message) ? 'validation' : 'sale'
        return { success: false, stage, message }
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result?.sale_id) {
        return { success: false, stage: 'sale', message: 'Stock sale was not created' }
    }

    revalidatePath('/owner/stock')
    revalidatePath('/owner/dispatches')
    revalidatePath('/owner/market-runs')
    revalidatePath('/owner/commercials')

    return {
        success: true,
        saleIds: [result.sale_id],
        dispatchId: result.dispatch_id ?? null,
        dispatchNumber: result.dispatch_number == null ? null : Number(result.dispatch_number),
        trackingUrl: null,
        dispatchStatus: result.dispatch_status,
        pendingDispatchMeters: Number(result.pending_dispatch_meters ?? 0),
        receivableId: result.receivable_id ?? null,
    }
}

export async function sellAndDispatchTakas(input: LegacyOrderSellAndDispatchInput): Promise<SellAndDispatchResult> {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    
    // 1. Validation
    if (!input.orderId) {
        return { success: false, stage: 'validation', message: 'Order is required' }
    }
    
    if (!input.selectedLots || input.selectedLots.length === 0) {
        return { success: false, stage: 'validation', message: 'No stock lots selected' }
    }

    if (input.sale.saleRatePerMeter <= 0) {
        return { success: false, stage: 'validation', message: 'Sale rate must be greater than 0' }
    }

    // Validate Order
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, quality_label, status')
        .eq('id', input.orderId)
        .eq('org_id', profile.org_id)
        .single()
        
    if (orderError || !order) {
        return { success: false, stage: 'validation', message: 'Order not found or invalid' }
    }

    if (order.status !== 'active' && order.status !== 'completed') {
        return { success: false, stage: 'validation', message: 'Can only dispatch against active or completed orders' }
    }

    // Validate Stock Lots
    const lotIds = input.selectedLots.map(l => l.stockLotId)
    const { data: lots, error: lotsError } = await supabase
        .from('fabric_stock_lot_summary')
        .select('stock_lot_id, available_taka_count, order_id, quality_label')
        .eq('org_id', profile.org_id)
        .in('stock_lot_id', lotIds)

    if (lotsError || !lots || lots.length !== lotIds.length) {
        return { success: false, stage: 'validation', message: 'One or more stock lots are invalid or inaccessible' }
    }

    for (const lotReq of input.selectedLots) {
        if (lotReq.unitsToSell <= 0) {
            return { success: false, stage: 'validation', message: 'Sale units must be greater than 0' }
        }
        
        const lotInfo = lots.find(l => l.stock_lot_id === lotReq.stockLotId)
        if (!lotInfo) {
            return { success: false, stage: 'validation', message: 'Lot not found' }
        }
        
        if (lotReq.unitsToSell > Number(lotInfo.available_taka_count)) {
            return { success: false, stage: 'validation', message: `Cannot sell more takas than available for lot ${lotInfo.quality_label}` }
        }
    }

    // 2. Perform Sales sequentially to avoid partial state ambiguity in case of RPC crash midway
    const saleIds: string[] = []
    let expectedDispatchMeters = 0
    for (const lotReq of input.selectedLots) {
        const { data: saleData, error: saleError } = await supabase.rpc('record_fabric_stock_sale', {
            p_stock_lot_id: lotReq.stockLotId,
            p_taka_sold: lotReq.unitsToSell,
            p_price_per_meter: input.sale.saleRatePerMeter,
            p_sale_date: input.sale.saleDate,
            p_notes: input.sale.notes || null,
        })

        if (saleError || !saleData || !saleData[0]?.sale_id) {
            return { 
                success: false, 
                stage: 'sale', 
                message: saleError?.message || 'Failed to record sale. Try again.',
                saleIds,
                recoverable: saleIds.length > 0 
            }
        }
        
        saleIds.push(saleData[0].sale_id)
        expectedDispatchMeters += Number(saleData[0].meters_sold ?? 0)
        await ensureReceivableForCommercialEntry('fabric_stock_sale', saleData[0].sale_id)
    }

    // 3. Create Dispatch
    const { data: dispatchData, error: dispatchError } = await supabase.rpc('create_stock_sale_dispatch', {
        p_org_id: profile.org_id,
        p_order_id: input.orderId,
        p_sale_ids: saleIds,
        p_notes: input.dispatch.notes || null,
        p_eway_bill_number: input.dispatch.ewayBillNumber || null,
        p_vehicle_number: input.dispatch.vehicleNumber || null,
        p_transporter_name: input.dispatch.transporterName || null,
        p_transporter_id: null,
        p_approximate_distance_km: input.dispatch.approximateDistanceKm ?? null,
        p_eway_bill_generated_at: input.dispatch.ewayBillDate || null,
        p_created_by: user.id,
    })

    if (dispatchError || !dispatchData || !dispatchData[0]?.dispatch_id) {
        return {
            success: false,
            stage: 'dispatch',
            message: 'Sale was saved, but dispatch could not be created. The sold takas are safe and appear under Sold Not Dispatched.',
            saleIds,
            recoverable: true
        }
    }

    const dispatchMeta = Array.isArray(dispatchData) ? dispatchData[0] : dispatchData
    const actualDispatchedMeters = Number(input.dispatch.actualDispatchedMeters ?? expectedDispatchMeters)
    const differenceMeters = actualDispatchedMeters - expectedDispatchMeters

    if (Number.isFinite(actualDispatchedMeters) && Math.abs(differenceMeters) > 0.01) {
        await supabase
            .from('stock_discrepancies')
            .insert({
                org_id: profile.org_id,
                dispatch_id: dispatchMeta.dispatch_id,
                quality_label: order.quality_label || null,
                expected_meters: expectedDispatchMeters,
                actual_dispatched_meters: actualDispatchedMeters,
                difference_meters: differenceMeters,
                discrepancy_type: differenceMeters < 0 ? 'shortage' : 'excess',
                status: 'needs_review',
                notes: input.dispatch.notes || input.sale.notes || null,
                created_by: user.id,
            })
    }

    revalidatePath('/owner/dispatches')
    revalidatePath('/owner/stock')
    revalidatePath('/owner/orders')
    
    return {
        success: true,
        saleIds,
        dispatchId: dispatchMeta.dispatch_id,
        dispatchNumber: dispatchMeta.dispatch_number,
        trackingUrl: dispatchMeta.tracking_token ? `/track/${dispatchMeta.tracking_token}` : null,
        dispatchStatus: 'dispatched',
        pendingDispatchMeters: 0,
    }
}
