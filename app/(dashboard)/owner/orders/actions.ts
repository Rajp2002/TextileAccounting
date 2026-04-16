'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type OrderStatus = 'active' | 'completed' | 'cancelled'

export interface OrderSummary {
    id: string
    party_name: string
    quality_label: string | null
    quality_id: string | null
    warp_instruction: string | null
    weft_instruction: string | null
    notes: string | null
    total_target_meters: number
    start_date: string
    deadline: string
    status: OrderStatus
    created_at: string
    worker_rate_per_m: number | null
}

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getOrdersWithProgress() {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('order_progress_summary')
        .select('*')
        .eq('org_id', profile.org_id)
        .in('status', ['active', 'completed'])
        .order('deadline', { ascending: true })

    if (error) return { error: error.message }
    return { data: data ?? [] }
}

export async function getActiveOrders() {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('orders')
        .select('id, party_name, quality_label, warp_instruction, weft_instruction, total_target_meters, deadline, status')
        .eq('org_id', profile.org_id)
        .eq('status', 'active')
        .order('deadline', { ascending: true })

    if (error) return { error: error.message }
    return { data: data ?? [] }
}

// ─── Write ─────────────────────────────────────────────────────────────────────



export async function updateOrderStatus(orderId: string, status: OrderStatus) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    // If order is completed, unlink all machines assigned to it
    if (status === 'completed') {
        await supabase
            .from('machines')
            .update({ current_order_id: null })
            .eq('current_order_id', orderId)
            .eq('org_id', profile.org_id)
    }

    revalidatePath('/owner/orders')
    revalidatePath('/owner/analytics')
    return { success: true }
}

export async function updateOrderDetails(orderId: string, data: {
    party_name?: string
    quality_label?: string
    warp_instruction?: string
    weft_instruction?: string
    notes?: string
    total_target_meters?: number
    deadline?: string
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('orders')
        .update(data)
        .eq('id', orderId)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    revalidatePath('/owner/orders')
    return { success: true }
}

export async function deleteOrder(orderId: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    // Unlink all machines assigned to this order
    await supabase
        .from('machines')
        .update({ current_order_id: null })
        .eq('current_order_id', orderId)
        .eq('org_id', profile.org_id)

    revalidatePath('/owner/orders')
    return { success: true }
}

// ─── Order With Quote ─────────────────────────────────────────────────────────

export async function getOrderWithQuote(orderId: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Fetch order progress row
    const { data: order, error: orderError } = await supabase
        .from('order_progress_summary')
        .select('*')
        .eq('order_id', orderId)
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (orderError) return { error: orderError.message }
    if (!order) return { error: 'Order not found' }

    // Fetch linked quote (if any) — joined via estimator_quotes.order_id
    const { data: quote } = await supabase
        .from('estimator_quotes')
        .select(
            'id, quote_price_per_meter, landed_cost_per_meter, intended_margin_percent, meters, ' +
            'warp_rows, weft_rows, overhead_pct, commission_pct, transport_per_m, ' +
            'warping_rate_per_kg, sizing_rate_per_kg, overhead_items, monthly_output_m, worker_rate_per_m'
        )
        .eq('order_id', orderId)
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    // Fetch active machines for assignment
    const { data: machines } = await supabase
        .from('machines')
        .select('id, name, current_order_id, status, linked_order:orders(status)')
        .eq('org_id', profile.org_id)
        .eq('status', 'active')
        .order('name', { ascending: true })

    return { order, quote: quote ?? null, machines: machines ?? [] }
}

export async function getActiveMachinesList() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('machines')
        .select('id, name, current_order_id, status, linked_order:orders(status)')
        .eq('org_id', profile.org_id)
        .eq('status', 'active')
        .order('name', { ascending: true })

    if (error) return { error: error.message }
    return { data: data ?? [] }
}

/** Assign machines to an order */
export async function assignMachinesToOrder(orderId: string, machineIds: string[]) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Unlink all machines currently on this order
    await supabase
        .from('machines')
        .update({ current_order_id: null })
        .eq('current_order_id', orderId)
        .eq('org_id', profile.org_id)

    // Link new machines
    if (machineIds.length > 0) {
        const { error } = await supabase
            .from('machines')
            .update({ current_order_id: orderId })
            .in('id', machineIds)
            .eq('org_id', profile.org_id)

        if (error) return { error: error.message }
    }

    revalidatePath('/owner/orders')
    return { success: true }
}
