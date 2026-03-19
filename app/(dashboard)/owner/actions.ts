'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import crypto from 'crypto'
import { createClient as createServerClient } from '@/lib/supabase/server'



export async function generateAccessCode() {
    const { profile } = await requireRole(['owner'])

    // Generate a random 6-character alphanumeric code
    const code = crypto.randomBytes(3).toString('hex').toUpperCase()

    // Hash it for secure storage
    const hash = crypto.createHash('sha256').update(code).digest('hex')

    // Set expiration to 15 minutes from now
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const supabase = await createServerClient()
    const { error } = await supabase
        .from('organizations')
        .update({
            access_code_hash: hash,
            access_code_expires_at: expiresAt
        })
        .eq('id', profile.org_id)

    if (error) {
        throw new Error('Failed to generate access code')
    }

    revalidatePath('/owner/settings')
    return { code } // Only sent to the client once
}

export async function validateAndRotateAccessCode(orgId: string, inputCode: string): Promise<boolean> {
    await requireRole(['owner', 'supervisor']) // Both can use codes

    const supabase = await createServerClient()

    // 1. Fetch the current hash and expiration
    const { data: org, error } = await supabase
        .from('organizations')
        .select('access_code_hash, access_code_expires_at')
        .eq('id', orgId)
        .single()

    if (error || !org || !org.access_code_hash) {
        return false
    }

    // 2. Check expiration
    if (new Date(org.access_code_expires_at) < new Date()) {
        return false
    }

    // 3. Hash the input and compare
    const inputHash = crypto.createHash('sha256').update(inputCode.trim().toUpperCase()).digest('hex')

    if (inputHash !== org.access_code_hash) {
        return false
    }

    // 4. Valid! Consume the code (auto-rotate to null)
    await supabase
        .from('organizations')
        .update({
            access_code_hash: null,
            access_code_expires_at: null
        })
        .eq('id', orgId)

    return true
}

// ─── INVENTORY ACTIONS ────────────────────────────────────────────────────────

export async function addQuality(data: { 
    name: string; 
    target_yield: number; 
    avg_sale_price_per_m: number;
    default_worker_rate_per_m: number;
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('qualities')
        .insert({
            org_id: profile.org_id,
            ...data
        })

    if (error) return { error: error.message }
    return { success: true }
}

export async function addYarnBatch(data: { name: string; quality_id: string; total_weight_kg: number }) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('yarn_batches')
        .insert({
            org_id: profile.org_id,
            status: 'active',
            ...data
        })

    if (error) return { error: error.message }
    return { success: true }
}

export async function loadSuratQualityTemplates() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const templates = [
        { name: '60g Georgette', target_yield: 9.5, avg_sale_price_per_m: 25.00, default_worker_rate_per_m: 12.00 },
        { name: 'Japan Satin', target_yield: 6.2, avg_sale_price_per_m: 45.00, default_worker_rate_per_m: 15.00 },
        { name: 'Cotton 40s', target_yield: 4.5, avg_sale_price_per_m: 60.00, default_worker_rate_per_m: 18.00 },
        { name: 'Micro Crepe', target_yield: 8.0, avg_sale_price_per_m: 35.00, default_worker_rate_per_m: 14.00 },
        { name: 'Dani Georgette', target_yield: 10.5, avg_sale_price_per_m: 22.00, default_worker_rate_per_m: 10.00 }
    ].map(t => ({ ...t, org_id: profile.org_id }))

    const { error } = await supabase
        .from('qualities')
        .insert(templates)

    if (error) return { error: error.message }
    return { success: true }
}

export async function closeYarnBatch(batchId: string, leftoverWeightKg: number = 0) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Unlink from current machine and mark consumed
    const { error } = await supabase
        .from('yarn_batches')
        .update({
            status: 'consumed',
            current_machine_id: null,
            leftover_weight_kg: leftoverWeightKg
        })
        .eq('id', batchId)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }
    return { success: true }
}
// ─── ORDER ACTIONS ────────────────────────────────────────────────────────────

export async function upsertOrder(data: {
    id?: string;
    party_name: string;
    quality_id: string;
    total_target_meters: number;
    start_date: string;
    deadline: string;
    status: 'active' | 'completed' | 'cancelled';
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const orderData = {
        org_id: profile.org_id,
        ...data
    }

    const { error } = await supabase
        .from('orders')
        .upsert(orderData)
        .select()

    if (error) return { error: error.message }
    
    revalidatePath('/owner/analytics')
    return { success: true }
}

export async function deleteOrder(orderId: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)
        .eq('org_id', profile.org_id)

    if (error) return { error: error.message }
    
    revalidatePath('/owner/analytics')
    return { success: true }
}

export async function assignOrderToMachines(orderId: string, machineIds: string[]) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // 1. Unlink this order from ANY machine that currently has it
    const { error: unlinkError } = await supabase
        .from('machines')
        .update({ current_order_id: null })
        .eq('current_order_id', orderId)
        .eq('org_id', profile.org_id)

    if (unlinkError) return { error: unlinkError.message }

    // 2. Link to the selected machines
    if (machineIds.length > 0) {
        const { error: linkError } = await supabase
            .from('machines')
            .update({ current_order_id: orderId })
            .in('id', machineIds)
            .eq('org_id', profile.org_id)

        if (linkError) return { error: linkError.message }
    }

    revalidatePath('/owner/analytics')
    return { success: true }
}
