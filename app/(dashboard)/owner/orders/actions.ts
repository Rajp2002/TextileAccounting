'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { checkAccessCodeRateLimit, checkAccessCodeLockout, recordAccessCodeFailure, resetAccessCodeFailures } from '@/lib/rate-limit'

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

// ─── Access Code Validation (owner-side) ─────────────────────────────────────

async function validateOwnerAccessCode(userId: string, orgId: string, inputCode: string): Promise<boolean> {
    const isLockedOut = await checkAccessCodeLockout(userId)
    if (isLockedOut) throw new Error('Account temporarily locked due to too many failed attempts. Try again in 1 hour.')

    const rl = await checkAccessCodeRateLimit(userId)
    if (rl) throw new Error(`Too many attempts. Try again in ${Math.ceil(rl / 1000)} seconds.`)

    if (!inputCode || inputCode.length !== 6) {
        await recordAccessCodeFailure(userId)
        return false
    }

    const supabase = await createServerClient()
    const { data: org, error } = await supabase
        .from('organizations')
        .select('access_code_hash, access_code_expires_at')
        .eq('id', orgId)
        .single()

    if (error || !org || !org.access_code_hash) {
        await recordAccessCodeFailure(userId)
        return false
    }

    if (new Date(org.access_code_expires_at) < new Date()) {
        await recordAccessCodeFailure(userId)
        return false
    }

    const inputHash = crypto.createHash('sha256').update(inputCode.toUpperCase()).digest('hex')
    const isValid = crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(org.access_code_hash, 'hex'))
    if (!isValid) {
        await recordAccessCodeFailure(userId)
        return false
    }

    // Consume the code
    await supabase
        .from('organizations')
        .update({ access_code_hash: null, access_code_expires_at: null })
        .eq('id', orgId)

    await resetAccessCodeFailures(userId)
    return true
}

// ─── Request a new access code (owner can call this too) ──────────────────────

export async function requestAccessCodeAsOwner() {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const code = crypto.randomBytes(3).toString('hex').toUpperCase()
    const hash = crypto.createHash('sha256').update(code).digest('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error } = await supabase
        .from('organizations')
        .update({ access_code_hash: hash, access_code_expires_at: expiresAt })
        .eq('id', profile.org_id)

    if (error) return { error: 'Failed to generate code. Please try again.' }

    // Return the code directly to the owner (they are the owner viewing the dashboard)
    return { success: true, code }
}

export async function updateOrderDetails(orderId: string, data: {
    party_name?: string
    quality_label?: string
    warp_instruction?: string
    weft_instruction?: string
    notes?: string
    total_target_meters?: number
    deadline?: string
}, accessCode: string) {
    const { user, profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Validate access code
    let isCodeValid = false
    try {
        isCodeValid = await validateOwnerAccessCode(user.id, profile.org_id, accessCode)
    } catch (e: any) {
        return { error: e.message }
    }
    if (!isCodeValid) return { error: 'Invalid or expired access code' }

    // Fetch current order state before updating
    const { data: currentOrder } = await supabase
        .from('orders')
        .select('status, total_target_meters')
        .eq('id', orderId)
        .eq('org_id', profile.org_id)
        .single()

    const updatePayload: any = { ...data }

    // If target is being increased on a completed order, reactivate it
    if (
        data.total_target_meters !== undefined &&
        currentOrder?.status === 'completed' &&
        data.total_target_meters > Number(currentOrder.total_target_meters)
    ) {
        updatePayload.status = 'active'
    }

    const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }

    revalidatePath('/owner/orders')
    revalidatePath('/owner/analytics')
    return { success: true, reactivated: updatePayload.status === 'active' }
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
