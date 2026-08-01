'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole, requireWritableOrg } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { LegacyOrderSellAndDispatchInput, SellAndDispatchInput, SellAndDispatchResult } from '@/lib/dispatch/sell-and-dispatch-types'
import { ensureReceivableForCommercialEntry } from '@/lib/commercials/receivables'
import { getSuratTodayString } from '@/lib/time'
import { isStrictDateOnly } from '@/lib/worker-validation'

export async function getSellAndDispatchOptions() {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const [ordersRes, lotsRes, partiesRes] = await Promise.all([
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
            .order('created_at', { ascending: false }),
        supabase
            .from('parties')
            .select('id, name, phone, gstin, state, default_credit_days')
            .eq('org_id', profile.org_id)
            .eq('is_active', true)
            .order('name', { ascending: true })
    ])

    return {
        orders: ordersRes.data || [],
        lots: lotsRes.data || [],
        parties: partiesRes.data || []
    }
}

function toFiniteNumber(value: unknown) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function normalizeDate(value: string | null | undefined) {
    return value?.trim() || getSuratTodayString()
}

function cleanText(value: string | null | undefined) {
    const cleaned = value?.trim()
    return cleaned ? cleaned : null
}

export async function createPartyStockSaleAndOptionalDispatch(input: SellAndDispatchInput): Promise<SellAndDispatchResult> {
    await requireWritableOrg(['owner'])
    const supabase = await createServerClient()

    const partyName = cleanText(input.partyName)
    const partyId = cleanText(input.partyId)
    const saleDate = normalizeDate(input.saleDate)
    const creditDays = Math.trunc(toFiniteNumber(input.creditDays))
    const soldMeters = toFiniteNumber(input.soldMeters)
    const saleRatePerMeter = toFiniteNumber(input.saleRatePerMeter)
    const requestedDispatchMeters = input.dispatchNow ? toFiniteNumber(input.actualDispatchedMeters) : 0

    if (!input.sourceId || !input.sourceType) {
        return { success: false, stage: 'validation', message: 'Source stock is required' }
    }
    if (!partyName && !partyId) {
        return { success: false, stage: 'validation', message: 'Party name is required' }
    }
    if (soldMeters <= 0) {
        return { success: false, stage: 'validation', message: 'Metres Sold must be greater than 0' }
    }
    if (saleRatePerMeter <= 0) {
        return { success: false, stage: 'validation', message: 'Sale rate must be greater than 0' }
    }
    if (creditDays < 0) {
        return { success: false, stage: 'validation', message: 'Credit days cannot be negative' }
    }
    if (creditDays > 365) {
        return { success: false, stage: 'validation', message: 'Credit days cannot exceed 365 days' }
    }
    if (!isStrictDateOnly(saleDate)) {
        return { success: false, stage: 'validation', message: 'Sale date must be a valid date' }
    }
    if (input.dispatchNow && (requestedDispatchMeters <= 0 || requestedDispatchMeters > soldMeters)) {
        return { success: false, stage: 'validation', message: 'Metres Sent must be greater than 0 and cannot exceed Metres Sold' }
    }
    const dispatchDate = input.dispatchNow ? normalizeDate(input.dispatchDate) : null
    if (input.dispatchNow && (!dispatchDate || !isStrictDateOnly(dispatchDate))) {
        return { success: false, stage: 'validation', message: 'Dispatch date must be a valid date' }
    }
    if (input.dispatchNow && dispatchDate !== null && dispatchDate < saleDate) {
        return { success: false, stage: 'validation', message: 'Dispatch date cannot be before sale date' }
    }
    const hasExplicitSoldTakas = input.soldTakas != null && String(input.soldTakas).trim() !== ''
    const soldTakas = hasExplicitSoldTakas ? toFiniteNumber(input.soldTakas) : null
    if (soldTakas != null && soldTakas <= 0) {
        return { success: false, stage: 'validation', message: 'Taka sold must be greater than 0' }
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
        p_dispatch_date: dispatchDate,
        p_transport_name: cleanText(input.transportName),
        p_vehicle_number: cleanText(input.vehicleNumber),
        p_challan_number: cleanText(input.challanNumber),
        p_notes: cleanText(input.notes),
        p_party_id: partyId,
        p_idempotency_key: cleanText(input.idempotencyKey),
    })

    if (error) {
        const message = error.message || 'Failed to create stock sale'
        const isValidationFailure = /stock|available|sold|party|credit|rate|source|required|greater than|cannot exceed|before sale/i.test(message)
        if (isValidationFailure) {
            return { success: false, stage: 'validation', message }
        }
        if (input.dispatchNow) {
            return {
                success: false,
                stage: 'dispatch',
                message: 'Sale and dispatch were not saved. No stock was changed. Review dispatch details and try again.',
            }
        }
        return { success: false, stage: 'sale', message }
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result?.sale_id) {
        return { success: false, stage: 'sale', message: 'Stock sale was not created' }
    }

    if (input.dispatchNow && (!result.dispatch_id || result.dispatch_status === 'not_dispatched')) {
        return {
            success: false,
            stage: 'dispatch',
            message: 'Sale was saved, but dispatch was not created. The sale is safe under Sold Pending Dispatch; create the dispatch from Dispatches.',
            saleIds: [result.sale_id],
            recoverable: true,
        }
    }

    revalidatePath('/owner/stock')
    revalidatePath('/owner/dispatches')
    revalidatePath('/owner/market-runs')
    revalidatePath('/owner/commercials')
    revalidatePath('/owner/archive')

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
    const { user, profile } = await requireWritableOrg(['owner'])
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
    const dispatchMetersArr: number[] = []
    const dispatchTakasArr: number[] = []
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
        const meters = Number(saleData[0].meters_sold ?? 0)
        expectedDispatchMeters += meters
        dispatchMetersArr.push(meters)
        dispatchTakasArr.push(lotReq.unitsToSell)
        await ensureReceivableForCommercialEntry('fabric_stock_sale', saleData[0].sale_id)
    }

    // 3. Create Dispatch
    const { data: dispatchData, error: dispatchError } = await supabase.rpc('create_stock_sale_dispatch', {
        p_org_id: profile.org_id,
        p_order_id: input.orderId,
        p_sale_ids: saleIds,
        p_dispatch_meters: dispatchMetersArr,
        p_dispatch_takas: dispatchTakasArr,
        p_dispatch_date: input.sale.saleDate,
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
            message: 'Sale was saved, but Dispatch could not be created. The sold Taka remain safe under Sold — Pending Dispatch.',
            saleIds,
            recoverable: true
        }
    }

    const dispatchMeta = Array.isArray(dispatchData) ? dispatchData[0] : dispatchData
    const challanNumber = cleanText(input.dispatch.challanNumber)
    if (challanNumber) {
        const { error: challanError } = await supabase
            .from('dispatches')
            .update({ challan_number: challanNumber })
            .eq('id', dispatchMeta.dispatch_id)
            .eq('org_id', profile.org_id)

        if (challanError) {
            return {
                success: false,
                stage: 'dispatch',
                message: challanError.message || 'Sale was saved, but challan reference could not be recorded.',
                saleIds,
                recoverable: true
            }
        }
    }

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
    revalidatePath('/owner/archive')
    
    return {
        success: true,
        saleIds,
        dispatchId: dispatchMeta.dispatch_id,
        dispatchNumber: dispatchMeta.dispatch_number,
        trackingUrl: null,
        dispatchStatus: 'dispatched',
        pendingDispatchMeters: 0,
    }
}
