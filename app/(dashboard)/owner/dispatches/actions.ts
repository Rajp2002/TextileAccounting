'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { SellAndDispatchInput, SellAndDispatchResult } from '@/lib/dispatch/sell-and-dispatch-types'
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
            .select('stock_lot_id, quality_label, godown, available_taka_count, available_meters, cost_per_meter, order_id, unit_label')
            .eq('org_id', profile.org_id)
            .gt('available_taka_count', 0)
            .order('created_at', { ascending: false })
    ])

    return {
        orders: ordersRes.data || [],
        lots: lotsRes.data || []
    }
}


export async function sellAndDispatchTakas(input: SellAndDispatchInput): Promise<SellAndDispatchResult> {
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

    revalidatePath('/owner/dispatches')
    revalidatePath('/owner/stock')
    revalidatePath('/owner/orders')
    
    return {
        success: true,
        saleIds,
        dispatchId: dispatchMeta.dispatch_id,
        dispatchNumber: dispatchMeta.dispatch_number,
        trackingUrl: dispatchMeta.tracking_token ? `/track/${dispatchMeta.tracking_token}` : null
    }
}
