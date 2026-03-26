'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import {
    QualitySchema,
    YarnBatchSchema,
    CloseBatchSchema,
    OrderSchema,
    AssignOrderSchema,
    UuidSchema,
    PositiveIntSchema,
    AccessCodeSchema,
    safeParse,
} from '@/lib/schemas'

// ─── Access Code ──────────────────────────────────────────────────────────────

export async function generateAccessCode() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Generate a cryptographically random 6-character code
    const code = crypto.randomBytes(3).toString('hex').toUpperCase()
    const hash = crypto.createHash('sha256').update(code).digest('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes

    const { error } = await supabase
        .from('organizations')
        .update({ access_code_hash: hash, access_code_expires_at: expiresAt })
        .eq('id', profile.org_id)

    if (error) {
        console.error('Failed to generate access code:', error)
        return { error: 'Failed to generate access code. Please try again.' }
    }

    return { success: true, code }
}

export async function validateAndRotateAccessCode(orgId: string, inputCode: string): Promise<boolean> {
    const { profile } = await requireRole(['owner', 'supervisor'])

    // Security: Ensure the orgId the client passed matches the server-derived org.
    // This prevents IDOR — a user cannot check codes for another org by passing a different ID.
    if (orgId !== profile.org_id) {
        return false
    }

    // Validate access code format before any DB hit
    const codeParsed = safeParse(AccessCodeSchema, inputCode)
    if ('error' in codeParsed) return false

    const supabase = await createServerClient()

    const { data: org, error } = await supabase
        .from('organizations')
        .select('access_code_hash, access_code_expires_at')
        .eq('id', profile.org_id)
        .single()

    if (error || !org || !org.access_code_hash) return false
    if (new Date(org.access_code_expires_at) < new Date()) return false

    const inputHash = crypto.createHash('sha256').update(codeParsed.data).digest('hex')
    const isValid = crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(org.access_code_hash, 'hex'))
    if (!isValid) return false

    // Valid! Consume the code
    await supabase
        .from('organizations')
        .update({ access_code_hash: null, access_code_expires_at: null })
        .eq('id', profile.org_id)

    return true
}

/**
 * Delete a fixed/salaried worker. Only owners can do this.
 * Requires a one-time access code. orgId is derived server-side.
 */
export async function deleteFixedWorkerWithCode(workerId: number, accessCode: string) {
    const { profile } = await requireRole(['owner'])
    const orgId = profile.org_id

    // Validate inputs before DB interaction
    const workerParsed = safeParse(PositiveIntSchema, workerId)
    if ('error' in workerParsed) return { error: workerParsed.error }

    const codeParsed = safeParse(AccessCodeSchema, accessCode)
    if ('error' in codeParsed) return { error: 'Invalid access code format' }

    const supabase = await createServerClient()

    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('access_code_hash, access_code_expires_at')
        .eq('id', orgId)
        .single()

    if (orgError || !org || !org.access_code_hash) return { error: 'Invalid or expired access code' }
    if (new Date(org.access_code_expires_at) < new Date()) return { error: 'Invalid or expired access code' }

    const inputHash = crypto.createHash('sha256').update(codeParsed.data).digest('hex')
    const isValid = crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(org.access_code_hash, 'hex'))
    if (!isValid) return { error: 'Invalid or expired access code' }

    await supabase
        .from('organizations')
        .update({ access_code_hash: null, access_code_expires_at: null })
        .eq('id', orgId)

    const { error } = await supabase
        .from('fixed_workers')
        .delete()
        .eq('id', workerParsed.data)
        .eq('org_id', orgId)

    if (error) {
        console.error('Error deleting fixed worker:', error)
        return { error: 'Failed to delete worker. Please try again.' }
    }

    return { success: true }
}

// ─── Inventory Actions ────────────────────────────────────────────────────────

export async function addQuality(data: {
    name: string
    target_yield: number
    avg_sale_price_per_m: number
    default_worker_rate_per_m: number
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(QualitySchema, data)
    if ('error' in parsed) return { error: parsed.error }

    const { error } = await supabase
        .from('qualities')
        .insert({ org_id: profile.org_id, ...parsed.data })

    if (error) {
        console.error('Failed to add quality:', error)
        return { error: 'Failed to add quality. Please try again.' }
    }
    return { success: true }
}

export async function addYarnBatch(data: {
    name: string
    quality_id: string
    total_weight_kg: number
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(YarnBatchSchema, data)
    if ('error' in parsed) return { error: parsed.error }

    const { error } = await supabase
        .from('yarn_batches')
        .insert({ org_id: profile.org_id, status: 'active', ...parsed.data })

    if (error) {
        console.error('Failed to add yarn batch:', error)
        return { error: 'Failed to add yarn batch. Please try again.' }
    }
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

    const { error } = await supabase.from('qualities').insert(templates)

    if (error) {
        console.error('Failed to load templates:', error)
        return { error: 'Failed to load quality templates. Please try again.' }
    }
    return { success: true }
}

export async function closeYarnBatch(batchId: string, leftoverWeightKg: number = 0) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(CloseBatchSchema, { batchId, leftoverWeightKg })
    if ('error' in parsed) return { error: parsed.error }

    const { error } = await supabase
        .from('yarn_batches')
        .update({
            status: 'consumed',
            current_machine_id: null,
            leftover_weight_kg: parsed.data.leftoverWeightKg,
        })
        .eq('id', parsed.data.batchId)
        .eq('org_id', profile.org_id)

    if (error) {
        console.error('Failed to close yarn batch:', error)
        return { error: 'Failed to close batch. Please try again.' }
    }
    return { success: true }
}

// ─── Order Actions ────────────────────────────────────────────────────────────

export async function upsertOrder(data: {
    id?: string
    party_name: string
    quality_id: string
    total_target_meters: number
    start_date: string
    deadline: string
    status: 'active' | 'completed' | 'cancelled'
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(OrderSchema, data)
    if ('error' in parsed) return { error: parsed.error }

    const orderData = { org_id: profile.org_id, ...parsed.data }

    const { error } = await supabase.from('orders').upsert(orderData).select()

    if (error) {
        console.error('Failed to upsert order:', error)
        return { error: 'Failed to save order. Please try again.' }
    }

    revalidatePath('/owner/analytics')
    return { success: true }
}

export async function deleteOrder(orderId: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(UuidSchema, orderId)
    if ('error' in parsed) return { error: parsed.error }

    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', parsed.data)
        .eq('org_id', profile.org_id)

    if (error) {
        console.error('Failed to delete order:', error)
        return { error: 'Failed to delete order. Please try again.' }
    }

    revalidatePath('/owner/analytics')
    return { success: true }
}

export async function assignOrderToMachines(orderId: string, machineIds: string[]) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(AssignOrderSchema, { orderId, machineIds })
    if ('error' in parsed) return { error: parsed.error }

    const { error: unlinkError } = await supabase
        .from('machines')
        .update({ current_order_id: null })
        .eq('current_order_id', parsed.data.orderId)
        .eq('org_id', profile.org_id)

    if (unlinkError) {
        console.error('Failed to unlink order from machines:', unlinkError)
        return { error: 'Failed to assign order. Please try again.' }
    }

    if (parsed.data.machineIds.length > 0) {
        const { error: linkError } = await supabase
            .from('machines')
            .update({ current_order_id: parsed.data.orderId })
            .in('id', parsed.data.machineIds)
            .eq('org_id', profile.org_id)

        if (linkError) {
            console.error('Failed to link order to machines:', linkError)
            return { error: 'Failed to assign order. Please try again.' }
        }
    }

    revalidatePath('/owner/analytics')
    return { success: true }
}
