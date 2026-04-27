'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
    UpdateOrgNameSchema,
    safeParse,
} from '@/lib/schemas'
import { eraseWorkerPII } from './actions/compliance'

// ─── Machine Management (Server Actions) ──────────────────────────────────────
// These run server-side so auth.uid() is always set in the audit trigger,
// giving the owner a complete actor trail for every machine change.

export async function addMachine(name: string, loomType?: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const trimmedName = name.trim()
    if (!trimmedName) return { error: 'Machine name is required.' }

    const insertData: Record<string, any> = { name: trimmedName, org_id: profile.org_id, status: 'active' }
    if (loomType) insertData.loom_type = loomType

    const { error } = await supabase
        .from('machines')
        .insert(insertData)

    if (error) {
        console.error('Failed to add machine:', error)
        return { error: 'Failed to add machine. Please try again.' }
    }

    revalidatePath('/owner/machines')
    return { success: true }
}


export async function updateMachine(machineId: string, name: string, loomType?: string | null) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(UuidSchema, machineId)
    if ('error' in parsed) return { error: parsed.error }

    const trimmedName = name.trim()
    if (!trimmedName) return { error: 'Machine name cannot be empty.' }

    // Build update object — always update name; loom_type only when explicitly passed
    // (undefined = caller didn't touch it; null = caller explicitly cleared it)
    const updateData: Record<string, any> = { name: trimmedName }
    if (loomType !== undefined) updateData.loom_type = loomType ?? null

    const { error } = await supabase
        .from('machines')
        .update(updateData)
        .eq('id', parsed.data)
        .eq('org_id', profile.org_id)

    if (error) {
        console.error('Failed to update machine:', error)
        return { error: 'Failed to update machine. Please try again.' }
    }

    revalidatePath('/owner/machines')
    return { success: true }
}

/** @deprecated Use updateMachine instead */
export const renameMachine = async (machineId: string, name: string) => updateMachine(machineId, name)


export async function toggleMachineStatus(machineId: string, currentStatus: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(UuidSchema, machineId)
    if ('error' in parsed) return { error: parsed.error }

    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

    const { error } = await supabase
        .from('machines')
        .update({ status: newStatus })
        .eq('id', parsed.data)
        .eq('org_id', profile.org_id)

    if (error) {
        console.error('Failed to update machine status:', error)
        return { error: 'Failed to update machine status. Please try again.' }
    }

    revalidatePath('/owner/machines')
    return { success: true }
}

export async function updateMachineAssignment(
    machineId: string,
    workerId: number,
    shift: 'day' | 'night',
    isExisting: boolean
) {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const machineParsed = safeParse(UuidSchema, machineId)
    if ('error' in machineParsed) return { error: machineParsed.error }

    let error: any
    if (isExisting) {
        const { error: updateError } = await supabase
            .from('machine_assignments')
            .update({ worker_id: workerId })
            .eq('machine_id', machineParsed.data)
            .eq('shift', shift)
            .eq('org_id', profile.org_id)
        error = updateError
    } else {
        const { error: insertError } = await supabase
            .from('machine_assignments')
            .insert({
                machine_id: machineParsed.data,
                worker_id: workerId,
                shift,
                org_id: profile.org_id
            })
        error = insertError
    }

    if (error) {
        console.error('Failed to update assignment:', error)
        return { error: 'Failed to update worker assignment. Please try again.' }
    }

    revalidatePath('/owner/machines')
    return { success: true }
}

// ─── Fixed Worker Management ──────────────────────────────────────────────────

export async function upsertFixedWorker(data: {
    id?: number
    name: string
    role: string
    monthly_salary: number
    start_date?: string   // 'YYYY-MM-DD' — used for payroll month filtering
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const name = data.name.trim()
    if (!name || !data.role || !data.monthly_salary) return { error: 'All fields are required.' }

    if (data.id) {
        const updatePayload: Record<string, any> = { name, role: data.role, monthly_salary: data.monthly_salary }
        if (data.start_date) updatePayload.start_date = data.start_date
        const { error } = await supabase
            .from('fixed_workers')
            .update(updatePayload)
            .eq('id', data.id)
            .eq('org_id', profile.org_id)
        if (error) { console.error(error); return { error: 'Failed to update worker.' } }
    } else {
        const insertPayload: Record<string, any> = {
            name,
            role: data.role,
            monthly_salary: data.monthly_salary,
            org_id: profile.org_id,
        }
        // If a start_date is provided use it; otherwise DB default (CURRENT_DATE) applies
        if (data.start_date) insertPayload.start_date = data.start_date
        const { error } = await supabase
            .from('fixed_workers')
            .insert(insertPayload)
        if (error) { console.error(error); return { error: 'Failed to add worker.' } }
    }

    revalidatePath('/owner/fixed-workers')
    return { success: true }
}

export async function updateFixedWorkerSalary(workerId: number, salary: number) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(PositiveIntSchema, workerId)
    if ('error' in parsed) return { error: parsed.error }

    if (!salary || salary <= 0) return { error: 'Invalid salary amount.' }

    const { error } = await supabase
        .from('fixed_workers')
        .update({ monthly_salary: salary })
        .eq('id', parsed.data)
        .eq('org_id', profile.org_id)

    if (error) { console.error(error); return { error: 'Failed to update salary.' } }

    revalidatePath('/owner/analytics')
    revalidatePath('/owner/fixed-workers')
    return { success: true }
}

// ─── Piece Rate Worker Management ────────────────────────────────────────────

/**
 * Update a piece-rate (meter) worker's name and optionally their WhatsApp details.
 * Owner-only.
 */
export async function updateMeterWorker(data: {
    id: number
    name: string
    phone?: string
    language?: 'en' | 'hi' | 'gu'
    consentGiven?: boolean
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(PositiveIntSchema, data.id)
    if ('error' in parsed) return { error: parsed.error }

    const name = data.name.trim()
    if (!name) return { error: 'Worker name is required.' }

    const updatePayload: Record<string, any> = { name }

    // Only update WhatsApp fields if phone provided and consent given
    if (data.phone !== undefined) {
        const cleanPhone = data.phone.replace(/\D/g, '')
        if (cleanPhone && cleanPhone.length !== 10) {
            return { error: 'Please enter a valid 10-digit mobile number.' }
        }
        if (cleanPhone && !data.consentGiven) {
            return { error: 'Worker consent must be confirmed before saving WhatsApp number.' }
        }
        updatePayload.whatsapp_number = cleanPhone || null
        if (data.language) updatePayload.whatsapp_language = data.language
    }

    const { error } = await supabase
        .from('workers')
        .update(updatePayload)
        .eq('id', parsed.data)
        .eq('org_id', profile.org_id)

    if (error) {
        console.error('Failed to update meter worker:', error)
        return { error: 'Failed to update worker. Please try again.' }
    }

    revalidatePath('/owner/fixed-workers')
    revalidatePath('/owner/payroll')
    return { success: true }
}

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
        .update({ 
            access_code_hash: hash, 
            access_code_expires_at: expiresAt,
            last_code_plain: code
        })
        .eq('id', profile.org_id)

    if (error) {
        console.error('Failed to generate access code:', error)
        return { error: 'Failed to generate access code. Please try again.' }
    }

    // ── Fire-and-forget: send code to owner's WhatsApp ───────────────────────
    // Non-blocking — code display in UI is not gated on notification.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceRoleKey) {
        fetch(`${supabaseUrl}/functions/v1/send-access-code`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                org_id: profile.org_id,
                code,
                expires_at: expiresAt,
            }),
        }).catch((err) => console.error('[send-access-code] Notification failed:', err))
    }

    return { success: true, code }
}

export async function updateOrganizationName(newName: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const parsed = safeParse(UpdateOrgNameSchema, { name: newName })
    if ('error' in parsed) return { error: parsed.error }

    const { error } = await supabase
        .from('organizations')
        .update({ name: parsed.data.name })
        .eq('id', profile.org_id)

    if (error) {
        console.error('Failed to update organization name:', error)
        return { error: 'Failed to update factory name. Please try again.' }
    }

    revalidatePath('/owner/settings')
    return { success: true }
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
        .update({ 
            access_code_hash: null, 
            access_code_expires_at: null,
            last_code_plain: null
        })
        .eq('id', profile.org_id)

    return true
}

/**
 * Delete a fixed/salaried worker. Only owners can do this.
 * Requires a one-time access code. orgId is derived server-side.
 */
export async function deleteFixedWorkerWithCode(workerId: number, accessCode: string, erasePII: boolean = false) {
    const { profile } = await requireRole(['owner'])
    const orgId = profile.org_id

    // Validate inputs
    const workerParsed = safeParse(PositiveIntSchema, workerId)
    if ('error' in workerParsed) return { error: workerParsed.error }

    const codeParsed = safeParse(AccessCodeSchema, accessCode)
    if ('error' in codeParsed) return { error: 'Invalid access code format' }

    const supabase = await createServerClient()

    // ... (access code validation) ...
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
        .update({ 
            access_code_hash: null, 
            access_code_expires_at: null,
            last_code_plain: null
        })
        .eq('id', orgId)

    if (erasePII) {
        // DPDP 2026: Anonymize instead of delete
        return await eraseWorkerPII(workerParsed.data, 'fixed')
    }

    const { error } = await supabase
        .from('fixed_workers')
        .delete()
        .eq('id', workerParsed.data)
        .eq('org_id', orgId)

    if (error) {
        console.error('Error deleting fixed worker:', error)
        return { error: 'Failed to delete worker. Please try again.' }
    }

    revalidatePath('/owner/fixed-workers')
    return { success: true }
}

/**
 * Delete a piece-rate (meter) worker. Only owners can do this.
 * Requires a one-time access code. orgId is derived server-side.
 */
export async function deleteMeterWorkerWithCode(workerId: number, accessCode: string, erasePII: boolean = false) {
    const { profile } = await requireRole(['owner'])
    const orgId = profile.org_id

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
        .update({ 
            access_code_hash: null, 
            access_code_expires_at: null,
            last_code_plain: null
        })
        .eq('id', orgId)

    if (erasePII) {
        // DPDP 2026: Anonymize instead of delete
        return await eraseWorkerPII(workerParsed.data, 'meter')
    }

    const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', workerParsed.data)
        .eq('org_id', orgId)

    if (error) {
        console.error('Error deleting meter worker:', error)
        return { error: 'Failed to delete worker. Please try again.' }
    }

    revalidatePath('/owner/workers')
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

export async function updateQuality(id: string, data: {
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
        .update(parsed.data)
        .eq('id', id)
        .eq('org_id', profile.org_id)

    if (error) {
        console.error('Failed to update quality:', error)
        return { error: 'Failed to update quality. Please try again.' }
    }
    return { success: true }
}

export async function deleteQuality(id: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Check for active batches using this quality
    const { count, error: countError } = await supabase
        .from('yarn_batches')
        .select('*', { count: 'exact', head: true })
        .eq('quality_id', id)
        .eq('status', 'active')
        .eq('org_id', profile.org_id)

    if (countError) {
        console.error('Failed to check active batches for quality:', countError)
        return { error: 'Failed to verify quality dependencies.' }
    }

    if (count && count > 0) {
        return { error: 'Quality in use by active batches' }
    }

    const { error } = await supabase
        .from('qualities')
        .delete()
        .eq('id', id)
        .eq('org_id', profile.org_id)

    if (error) {
        console.error('Failed to delete quality:', error)
        // If there's an FK error (e.g. from consumed batches) handle it gracefully
        if (error.code === '23503') {
             return { error: 'Cannot delete quality because it is referenced by past production records or consumed batches.' }
        }
        return { error: 'Failed to delete quality. Please try again.' }
    }
    return { success: true }
}

export async function addYarnBatch(data: {
    name: string
    quality_id: string
    total_weight_kg: number
}) {
    const { profile } = await requireRole(['owner', 'supervisor'])
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

// closeYarnBatch and settleBatchAudit: still used by supervisor production page
// to mark beams as consumed. send-yield-alert fire-and-forget has been removed
// (yarn yield alerts are no longer in scope after the lean pivot).

export async function closeYarnBatch(batchId: string, leftoverWeightKg: number = 0) {
    const { profile } = await requireRole(['owner', 'supervisor'])
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

export async function settleBatchAudit(batchId: string, status: 'settled' | 'dismissed') {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .rpc('settle_batch_audit', {
            p_batch_id: batchId,
            p_status: status
        })

    if (error) {
        console.error('Failed to settle audit:', error)
        return { error: 'Failed to update audit status.' }
    }

    revalidatePath('/owner/inventory')
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

// ─── WhatsApp Preferences ─────────────────────────────────────────────────────

/**
 * Save owner's WhatsApp opt-in preference.
 * Owner-only. Validates 10-digit Indian mobile number.
 */
export async function saveWhatsAppPreferences(
    phone: string,
    optedIn: boolean
) {
    const { user } = await requireRole(['owner'])

    const cleanPhone = phone.replace(/\D/g, '')
    if (optedIn && cleanPhone.length !== 10) {
        return { error: 'Please enter a valid 10-digit Indian mobile number.' }
    }

    const updateData: Record<string, any> = {
        whatsapp_opted_in: optedIn,
    }

    if (optedIn) {
        updateData.whatsapp_number = cleanPhone
        updateData.whatsapp_opted_in_at = new Date().toISOString()
    } else {
        updateData.whatsapp_opted_in_at = null
    }

    // Use admin client (service_role) to bypass RLS.
    // Auth + authorization already verified by requireRole above.
    const admin = createAdminClient()
    const { error } = await admin
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)

    if (error) {
        console.error('Failed to save WhatsApp preferences:', error)
        return { error: 'Failed to save preferences. Please try again.' }
    }

    revalidatePath('/owner/settings')
    return { success: true }
}

/**
 * Save WhatsApp number + language for a piece-rate or fixed worker.
 * Requires explicit consent flag from the owner (legal defensibility).
 * Owner-only.
 */
export async function saveWorkerWhatsApp(data: {
    workerId: number
    workerType: 'meter' | 'fixed'
    phone: string
    language: 'en' | 'hi' | 'gu'
    consentGiven: boolean
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Hard block if consent not explicitly confirmed
    if (!data.consentGiven) {
        return { error: 'Worker consent must be confirmed before saving WhatsApp number.' }
    }

    const cleanPhone = data.phone.replace(/\D/g, '')
    if (cleanPhone && cleanPhone.length !== 10) {
        return { error: 'Please enter a valid 10-digit mobile number.' }
    }

    const table = data.workerType === 'meter' ? 'workers' : 'fixed_workers'

    const parsedId = safeParse(PositiveIntSchema, data.workerId)
    if ('error' in parsedId) return { error: parsedId.error }

    const { error } = await supabase
        .from(table)
        .update({
            whatsapp_number: cleanPhone || null,
            whatsapp_language: data.language,
        })
        .eq('id', parsedId.data)
        .eq('org_id', profile.org_id)

    if (error) {
        console.error('Failed to save worker WhatsApp:', error)
        return { error: 'Failed to save worker WhatsApp details.' }
    }

    revalidatePath('/owner/payroll')
    revalidatePath('/owner/advances')
    return { success: true }
}

export async function retryWhatsAppMessage(logId: string) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // 1. Verify the log belongs to this organization
    const { data: log, error: checkError } = await supabase
        .from('whatsapp_delivery_log')
        .select('id, status')
        .eq('id', logId)
        .eq('org_id', profile.org_id)
        .single()

    if (checkError || !log) {
        return { error: 'Message log not found or unauthorized.' }
    }

    if (log.status !== 'failed') {
        return { error: 'Only failed messages can be retried.' }
    }

    // 2. Reset the log to make it eligible for immediate retry
    // The cron filters by sent_at > NOW() - 24h, status = 'failed', retry_count < 3
    const { error: resetError } = await supabase
        .from('whatsapp_delivery_log')
        .update({
            retry_count: 0,
            sent_at: new Date().toISOString(),
        })
        .eq('id', logId)

    if (resetError) {
        console.error('Failed to reset message log:', resetError)
        return { error: 'Failed to queue message for retry.' }
    }

    // 3. Immediately invoke the retry Edge Function so we don't wait for the top of the hour
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        
        // ping the robust retry edge function. It will process all pending retries (including this one)
        const fetchRes = await fetch(`${supabaseUrl}/functions/v1/retry-failed-messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json'
            }
        })
        
        if (!fetchRes.ok) {
            console.warn('Edge function retry trigger failed, message will still send at next hour', await fetchRes.text())
        }
    } catch (e) {
        console.warn('Network err triggering retry edge function:', e)
    }

    revalidatePath('/owner/system-health')
    return { success: true }
}

export async function getReferralStatsAction() {
    const { profile } = await requireRole(['owner']);
    const { getReferralStats } = await import('@/lib/referral');
    if (!profile.org_id) return { code: null, total: 0, converted: 0, activeWindows: [], currentDiscountPct: 0 };
    return await getReferralStats(profile.org_id);
}

export async function getOrCreateReferralCodeAction() {
    const { profile } = await requireRole(['owner']);
    const { getOrCreateReferralCode } = await import('@/lib/referral');
    if (!profile.org_id) throw new Error('Organization not found');
    return await getOrCreateReferralCode(profile.org_id);
}

export async function assignMachineOrder(machineId: string, orderId: string | null) {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('machines')
        .update({ current_order_id: orderId })
        .eq('id', machineId)
        .eq('org_id', profile.org_id)

    if (error) {
        console.error('Failed to assign machine order:', error)
        return { error: 'Failed to assign order. Please try again.' }
    }

    revalidatePath('/owner/machines')
    revalidatePath('/owner/analytics')
    return { success: true }
}

