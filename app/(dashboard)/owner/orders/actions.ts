'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type OrderStatus = 'active' | 'completed' | 'cancelled'

export interface FlatOrder {
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

export async function createFlatOrder(data: {
    party_name: string
    quality_label: string
    warp_instruction?: string
    weft_instruction?: string
    notes?: string
    total_target_meters: number
    start_date: string
    deadline: string
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    if (!data.party_name.trim()) return { error: 'Party name is required' }
    if (!data.quality_label.trim()) return { error: 'Quality label is required' }
    if (!data.total_target_meters || data.total_target_meters <= 0)
        return { error: 'Target meters must be greater than 0' }
    if (!data.deadline) return { error: 'Deadline is required' }

    const { data: order, error } = await supabase
        .from('orders')
        .insert({
            org_id: profile.org_id,
            party_name: data.party_name.trim(),
            quality_label: data.quality_label.trim(),
            warp_instruction: data.warp_instruction?.trim() || null,
            weft_instruction: data.weft_instruction?.trim() || null,
            notes: data.notes?.trim() || null,
            total_target_meters: data.total_target_meters,
            start_date: data.start_date,
            deadline: data.deadline,
            status: 'active',
        })
        .select('id')
        .single()

    if (error) {
        console.error('createFlatOrder error:', error)
        return { error: 'Failed to create order. Please try again.' }
    }

    revalidatePath('/owner/orders')
    revalidatePath('/owner/analytics')
    return { success: true, orderId: order.id }
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

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

    revalidatePath('/owner/orders')
    return { success: true }
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
