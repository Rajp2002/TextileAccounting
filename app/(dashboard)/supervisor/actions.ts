'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import crypto from 'crypto'
import {
    SavePastAttendanceSchema,
    AccessCodeSchema,
    UuidSchema,
    WorkerIdSchema,
    ShiftSchema,
    MachineStatusSchema,
    WorkerTypeSchema,
    PositiveIntSchema,
    safeParse,
} from '@/lib/schemas'

// ─── Internal Helpers ──────────────────────────────────────────────────────────

/**
 * Returns a Supabase service-role client for operations that need to bypass RLS.
 * Only call this AFTER verifying the user is authenticated and authorized via requireRole().
 */
function getServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        console.error('[Security] Service client env vars not configured.')
        throw new Error('SERVER_CONFIG_ERROR')
    }
    return createServiceClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
}

import {
    checkAccessCodeRateLimit,
    checkAccessCodeLockout,
    recordAccessCodeFailure,
    resetAccessCodeFailures,
} from '@/lib/rate-limit'

/**
 * Validate a one-time access code for the given org.
 * orgId MUST be derived server-side (from requireRole()) — never accept from client.
 * On success the code is consumed (cannot be reused).
 */
async function validateAndConsumeAccessCode(userId: string, orgId: string, inputCode: string): Promise<boolean> {
    // 1. Check for strict lockout ban (5 fails = 1 hour)
    const isLockedOut = await checkAccessCodeLockout(userId)
    if (isLockedOut) throw new Error('Account temporarily locked due to too many failed attempts. Try again in 1 hour.')

    // 2. Check sliding window limit (5 attempts per 10 min)
    const rl = await checkAccessCodeRateLimit(userId)
    if (rl) throw new Error(`Too many attempts. Try again in ${Math.ceil(rl / 1000)} seconds.`)

    // Validate format before any DB hit
    const codeParsed = safeParse(AccessCodeSchema, inputCode)
    if ('error' in codeParsed) {
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

    const { createHash, timingSafeEqual } = await import('crypto')
    const inputHash = createHash('sha256').update(codeParsed.data).digest('hex')
    const isValid = timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(org.access_code_hash, 'hex'))
    if (!isValid) {
        await recordAccessCodeFailure(userId)
        return false
    }

    // Valid — consume the code
    await supabase
        .from('organizations')
        .update({ 
            access_code_hash: null, 
            access_code_expires_at: null,
            last_code_plain: null
        })
        .eq('id', orgId)

    // Set PostgreSQL session variable so the audit trigger knows 
    // this action was authorized by an access code.
    await supabase.rpc('set_config', { 
        name: 'app.access_code_used', 
        value: 'true', 
        is_local: true 
    })

    // Clear failure history
    await resetAccessCodeFailures(userId)

    return true
}

// ─── Attendance ───────────────────────────────────────────────────────────────

interface AttendanceRecordInput {
    fixed_worker_id: number
    present: boolean
}

/**
 * Save attendance for past dates. Requires a valid one-time owner access code.
 * orgId is derived server-side — not trusted from client.
 */
export async function savePastAttendance(
    date: string,
    records: AttendanceRecordInput[],
    accessCode: string
) {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const orgId = profile.org_id

    // ── Zod validation ──────────────────────────────────────────────────────
    const parsed = safeParse(SavePastAttendanceSchema, { date, records, accessCode })
    if ('error' in parsed) return { error: parsed.error }

    // 1. Validate the one-time access code (org-scoped, server-derived)
    let isCodeValid = false
    try {
        isCodeValid = await validateAndConsumeAccessCode(user.id, orgId, parsed.data.accessCode)
    } catch (e: any) {
        return { error: e.message }
    }
    if (!isCodeValid) return { error: 'Invalid or expired access code' }

    // 2. Bypass RLS for past-date insert
    let serviceClient
    try {
        serviceClient = getServiceClient()
    } catch {
        return { error: 'A server error occurred. Please try again later.' }
    }

    // 3. Upsert records — org_id is server-derived
    const headerList = await headers()
    const clientIp = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'

    const upsertData = parsed.data.records.map(record => ({
        org_id: orgId,
        fixed_worker_id: record.fixed_worker_id,
        date: parsed.data.date,
        present: record.present,
        marked_by: user.id,
        client_ip: clientIp
    }))

    // Set audit actor before service-role DML
    await serviceClient.rpc('set_actor_for_audit', { p_actor_id: user.id })

    const { error } = await serviceClient
        .from('attendance')
        .upsert(upsertData, { onConflict: 'fixed_worker_id,date' })

    if (error) {
        console.error('Error saving past attendance:', error)
        return { error: 'Failed to save attendance records. Please try again.' }
    }

    return { success: true }
}

// ─── Machine Management ───────────────────────────────────────────────────────

/**
 * Delete a machine. Requires a valid one-time owner access code.
 */
export async function deleteMachineWithCode(machineId: string, accessCode: string) {
    const { user, profile } = await requireRole(['supervisor'])
    const orgId = profile.org_id

    // Validate inputs
    const machineParsed = safeParse(UuidSchema, machineId)
    if ('error' in machineParsed) return { error: machineParsed.error }

    let isCodeValid = false
    try {
        isCodeValid = await validateAndConsumeAccessCode(user.id, orgId, accessCode)
    } catch (e: any) {
        return { error: e.message }
    }
    if (!isCodeValid) return { error: 'Invalid or expired access code' }

    let serviceClient
    try {
        serviceClient = getServiceClient()
    } catch {
        return { error: 'A server error occurred. Please try again later.' }
    }

    // Set audit actor before service-role DML
    await serviceClient.rpc('set_actor_for_audit', { p_actor_id: user.id })

    const { error } = await serviceClient
        .from('machines')
        .delete()
        .eq('id', machineParsed.data)
        .eq('org_id', orgId)

    if (error) {
        console.error('Error deleting machine:', error)
        return { error: 'Failed to delete machine. Please try again.' }
    }
    return { success: true }
}

// ─── Worker Management ────────────────────────────────────────────────────────

/**
 * Delete a worker. Requires a valid one-time owner access code.
 */
export async function deleteWorkerWithCode(workerId: number, accessCode: string) {
    const { user, profile } = await requireRole(['supervisor'])
    const orgId = profile.org_id

    const workerParsed = safeParse(WorkerIdSchema, workerId)
    if ('error' in workerParsed) return { error: workerParsed.error }

    let isCodeValid = false
    try {
        isCodeValid = await validateAndConsumeAccessCode(user.id, orgId, accessCode)
    } catch (e: any) {
        return { error: e.message }
    }
    if (!isCodeValid) return { error: 'Invalid or expired access code' }

    let serviceClient
    try {
        serviceClient = getServiceClient()
    } catch {
        return { error: 'A server error occurred. Please try again later.' }
    }

    // Set audit actor before service-role DML
    await serviceClient.rpc('set_actor_for_audit', { p_actor_id: user.id })

    const { error } = await serviceClient
        .from('workers')
        .delete()
        .eq('id', workerParsed.data)
        .eq('org_id', orgId)

    if (error) {
        console.error('Error deleting worker:', error)
        return { error: 'Failed to delete worker. Please try again.' }
    }
    return { success: true }
}

// ─── Access Code Verification ─────────────────────────────────────────────────

/**
 * Verify AND consume an access code without performing a destructive action.
 */
export async function verifyAccessCode(accessCode: string) {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const orgId = profile.org_id

    // Format validation first (fail fast, no DB hit)
    const codeParsed = safeParse(AccessCodeSchema, accessCode)
    if ('error' in codeParsed) return { error: 'Invalid access code format' }

    let isCodeValid = false
    try {
        isCodeValid = await validateAndConsumeAccessCode(user.id, orgId, codeParsed.data)
    } catch (e: any) {
        return { error: e.message }
    }
    if (!isCodeValid) return { error: 'Invalid or expired access code' }

    return { success: true }
}

// ─── Beam / Inventory ─────────────────────────────────────────────────────────

/**
 * Link an active yarn batch to a specific machine ("Start Beam").
 */
export async function startBeam(batchId: string, machineId: string) {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const orgId = profile.org_id

    // Validate both UUIDs
    const batchParsed = safeParse(UuidSchema, batchId)
    if ('error' in batchParsed) return { error: batchParsed.error }

    const machineParsed = safeParse(UuidSchema, machineId)
    if ('error' in machineParsed) return { error: machineParsed.error }

    let serviceClient
    try {
        serviceClient = getServiceClient()
    } catch {
        return { error: 'A server error occurred. Please try again later.' }
    }

    const { data: batchData, error: batchError } = await serviceClient
        .from('yarn_batches')
        .select('org_id, quality_id, qualities(default_worker_rate_per_m)')
        .eq('id', batchParsed.data)
        .eq('org_id', orgId)
        .single()

    if (batchError || !batchData) {
        console.error('Error fetching batch:', batchError)
        return { error: 'Failed to fetch batch data. Please try again.' }
    }

    const qualityData = Array.isArray(batchData.qualities) ? batchData.qualities[0] : batchData.qualities
    const defaultRate = (qualityData as any)?.default_worker_rate_per_m || 0

    // Set audit actor before service-role DML
    await serviceClient.rpc('set_actor_for_audit', { p_actor_id: user.id })

    await serviceClient
        .from('yarn_batches')
        .update({ current_machine_id: null })
        .eq('current_machine_id', machineParsed.data)
        .eq('org_id', orgId)
        .eq('status', 'active')

    const { error: linkError } = await serviceClient
        .from('yarn_batches')
        .update({ current_machine_id: machineParsed.data })
        .eq('id', batchParsed.data)
        .eq('org_id', orgId)

    if (linkError) {
        console.error('Error linking batch to machine:', linkError)
        return { error: 'Failed to start beam. Please try again.' }
    }

    return { success: true }
}

/**
 * Link an order to a machine.
 */
export async function linkOrderToMachine(orderId: string, machineId: string) {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const orgId = profile.org_id

    const orderParsed = safeParse(UuidSchema, orderId)
    if ('error' in orderParsed) return { error: orderParsed.error }

    const machineParsed = safeParse(UuidSchema, machineId)
    if ('error' in machineParsed) return { error: machineParsed.error }

    let serviceClient
    try {
        serviceClient = getServiceClient()
    } catch {
        return { error: 'A server error occurred. Please try again later.' }
    }

    // Set audit actor before service-role DML
    await serviceClient.rpc('set_actor_for_audit', { p_actor_id: user.id })

    const { error } = await serviceClient
        .from('machines')
        .update({ current_order_id: orderParsed.data })
        .eq('id', machineParsed.data)
        .eq('org_id', orgId)

    if (error) {
        console.error('Error linking order to machine:', error)
        return { error: 'Failed to assign order to machine. Please try again.' }
    }

    return { success: true }
}

// ─── Shift Handover ───────────────────────────────────────────────────────────

/**
 * Perform a shift handover by unlinking the current worker from a machine.
 */
export async function shiftHandover(machineId: string, shift: 'day' | 'night') {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const orgId = profile.org_id

    const machineParsed = safeParse(UuidSchema, machineId)
    if ('error' in machineParsed) return { error: machineParsed.error }

    const shiftParsed = safeParse(ShiftSchema, shift)
    if ('error' in shiftParsed) return { error: shiftParsed.error }

    let serviceClient
    try {
        serviceClient = getServiceClient()
    } catch {
        return { error: 'A server error occurred. Please try again later.' }
    }

    // Set audit actor before service-role DML
    await serviceClient.rpc('set_actor_for_audit', { p_actor_id: user.id })

    const { error } = await serviceClient
        .from('machine_assignments')
        .delete()
        .eq('org_id', orgId)
        .eq('machine_id', machineParsed.data)
        .eq('shift', shiftParsed.data)

    if (error) {
        console.error('Error in shift handover:', error)
        return { error: 'Failed to perform shift handover. Please try again.' }
    }

    return { success: true }
}

// ─── Worker Debt ──────────────────────────────────────────────────────────────

/**
 * Check if a worker has any outstanding advance (Upaad) balance.
 */
export async function getWorkerDebt(workerId: number, workerType: 'meter' | 'fixed' = 'meter') {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const orgId = profile.org_id

    const workerParsed = safeParse(PositiveIntSchema, workerId)
    if ('error' in workerParsed) return { error: workerParsed.error }

    const typeParsed = safeParse(WorkerTypeSchema, workerType)
    if ('error' in typeParsed) return { error: typeParsed.error }

    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('worker_advances')
        .select('amount')
        .eq('org_id', orgId)
        .eq('status', 'pending')
        .eq(typeParsed.data === 'meter' ? 'meter_worker_id' : 'fixed_worker_id', workerParsed.data)

    if (error) {
        console.error('Error fetching worker debt:', error)
        return { error: 'Failed to fetch worker balance. Please try again.' }
    }

    const balance = data?.reduce((sum, row) => sum + Number(row.amount), 0) || 0
    return { balance }
}

/**
 * Un-consume a yarn batch. Requires a valid one-time owner access code.
 */
export async function unconsumeBatchWithCode(batchId: string, accessCode: string) {
    const { user, profile } = await requireRole(['supervisor', 'owner'])
    const orgId = profile.org_id

    const batchParsed = safeParse(UuidSchema, batchId)
    if ('error' in batchParsed) return { error: batchParsed.error }

    let isCodeValid = false
    try {
        isCodeValid = await validateAndConsumeAccessCode(user.id, orgId, accessCode)
    } catch (e: any) {
        return { error: e.message }
    }
    if (!isCodeValid) return { error: 'Invalid or expired access code' }

    let serviceClient
    try {
        serviceClient = getServiceClient()
    } catch {
        return { error: 'A server error occurred. Please try again later.' }
    }

    // Set audit actor before service-role DML
    await serviceClient.rpc('set_actor_for_audit', { p_actor_id: user.id })

    const { error } = await serviceClient
        .from('yarn_batches')
        .update({ 
            status: 'active',
            audit_status: 'pending',
            leakage_alert: false
        })
        .eq('id', batchParsed.data)
        .eq('org_id', orgId)

    if (error) {
        console.error('Error un-consuming batch:', error)
        return { error: 'Failed to un-consume batch. Please try again.' }
    }
    return { success: true }
}

// ─── Worker Management ───────────────────────────────────────────────────────

export async function addMeterWorker(data: {
    name: string
    pf_esi_eligible: boolean
    esi_number?: string | null
    pf_number?: string | null
}) {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()
    
    // Set actor context so the audit trigger captures the ID instead of NULL since we are using requireRole which sets the user JWT natively
    // We don't need service role here, so we shouldn't necessarily need set_actor_for_audit unless it's a service client,
    // BUT requiring it provides a full guarantee. Actually, createServerClient() includes the user JWT.
    
    // Wait, the regular createServerClient() sets the JWT, so auth.uid() is available.
    const { data: inserted, error } = await supabase
        .from('workers')
        .insert({
            name: data.name,
            is_active: true,
            pf_esi_eligible: data.pf_esi_eligible,
            esi_number: data.esi_number,
            pf_number: data.pf_number,
            org_id: profile.org_id
        })
        .select('id')
        .single()
        
    if (error) return { error: error.message }
    return { success: true, workerId: inserted.id as number }
}

export async function addFixedWorker(data: {
    name: string
    role: string
    monthly_salary: number
    pf_esi_eligible: boolean
    esi_number?: string | null
    pf_number?: string | null
}) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    
    const { data: inserted, error } = await supabase
        .from('fixed_workers')
        .insert({
            name: data.name,
            role: data.role,
            monthly_salary: data.monthly_salary,
            is_active: true,
            pf_esi_eligible: data.pf_esi_eligible,
            esi_number: data.esi_number,
            pf_number: data.pf_number,
            org_id: profile.org_id
        })
        .select('id')
        .single()
        
    if (error) return { error: error.message }
    return { success: true, workerId: inserted.id as number }
}

export async function toggleWorkerActive(workerId: number, currentActive: boolean, table: 'workers' | 'fixed_workers') {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    if (table === 'fixed_workers' && profile.role !== 'owner') {
        return { error: 'Unauthorized: Supervisors cannot manage fixed staff status.' }
    }

    const parsed = safeParse(PositiveIntSchema, workerId)
    if ('error' in parsed) return { error: parsed.error }

    const { error } = await supabase
        .from(table)
        .update({ is_active: !currentActive })
        .eq('id', parsed.data)
        .eq('org_id', profile.role === 'owner' ? profile.org_id : profile.org_id) // profile.org_id is same, just being explicit if needed but it's fine

    if (error) {
        console.error('Failed to update worker status:', error)
        return { error: 'Failed to update worker status. Please try again.' }
    }

    revalidatePath('/supervisor/workers')
    return { success: true }
}

export async function assignWorker(
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
        return { error: 'Failed to assign worker. Please try again.' }
    }

    return { success: true }
}

/**
 * Request a new access code from the owner.
 * Generated code is sent to the owner's WhatsApp, mentioning who requested it.
 */
export async function requestAccessCode() {
    const { user, profile } = await requireRole(['supervisor', 'owner'])
    const supabase = await createServerClient()

    // 1. Generate random 6-character code
    const code = crypto.randomBytes(3).toString('hex').toUpperCase()
    const hash = crypto.createHash('sha256').update(code).digest('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes

    // 2. Save hash and plain code to organizations table
    const { error } = await supabase
        .from('organizations')
        .update({ 
            access_code_hash: hash, 
            access_code_expires_at: expiresAt,
            last_code_plain: code
        })
        .eq('id', profile.org_id)

    if (error) {
        console.error('[requestAccessCode] DB Update failed:', error)
        return { error: 'Failed to generate request. Please try again.' }
    }

    // 3. Fire-and-forget: send notification to owner via Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Get requester name for the notification
    const { data: requester } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()

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
                requested_by: requester?.name || 'Supervisor'
            }),
        }).catch((err) => console.error('[request-access-code] Notification failed:', err))
    }

    return { success: true }
}

// ─── Shift Assignments (Module 3) ─────────────────────────────────────────────

/**
 * Get all data needed for the shift setup screen for a given date + shift.
 * Returns machines, active orders, active workers, and any existing assignments.
 */
export async function getShiftSetupData(date: string, shift: 'day' | 'night') {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const orgId = profile.org_id
    const supabase = await createServerClient()

    const [machinesRes, ordersRes, workersRes, assignmentsRes] = await Promise.all([
        supabase
            .from('machines')
            .select('id, name, status, default_rate_per_m, current_order_id')
            .eq('org_id', orgId)
            .eq('status', 'active')
            .order('name'),
        supabase
            .from('orders')
            .select('id, quality_label, party_name, warp_instruction, weft_instruction, total_target_meters, deadline, status, worker_rate_per_m')
            .eq('org_id', orgId)
            .eq('status', 'active')
            .order('deadline'),
        supabase
            .from('workers')
            .select('id, name')
            .eq('org_id', orgId)
            .eq('is_active', true)
            .order('name'),
        supabase
            .from('shift_assignments')
            .select('id, machine_id, worker_id, order_id, rate_per_m, breakdown_category, breakdown_notes')
            .eq('org_id', orgId)
            .eq('date', date)
            .eq('shift', shift),
    ])

    return {
        machines: machinesRes.data ?? [],
        orders: ordersRes.data ?? [],
        workers: workersRes.data ?? [],
        assignments: assignmentsRes.data ?? [],
    }
}

/**
 * Upsert a single shift assignment for a machine.
 */
export async function upsertShiftAssignment(data: {
    date: string
    shift: 'day' | 'night'
    machine_id: string
    worker_id: number | null
    order_id: string | null
    rate_per_m: number
}) {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { error } = await supabase
        .from('shift_assignments')
        .upsert(
            {
                org_id: profile.org_id,
                date: data.date,
                shift: data.shift,
                machine_id: data.machine_id,
                worker_id: data.worker_id,
                order_id: data.order_id,
                rate_per_m: data.rate_per_m,
                created_by: user.id,
            },
            { onConflict: 'org_id,date,shift,machine_id' }
        )

    if (error) {
        console.error('upsertShiftAssignment error:', error)
        return { error: error.message }
    }

    return { success: true }
}

/**
 * Copy all assignments from a previous shift to the current date/shift.
 */
export async function copyPreviousShiftAction(
    targetDate: string,
    targetShift: 'day' | 'night',
    sourceDate: string,
    sourceShift: 'day' | 'night'
) {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('copy_previous_shift', {
        p_date: targetDate,
        p_shift: targetShift,
        p_source_date: sourceDate,
        p_source_shift: sourceShift,
    })

    if (error) {
        console.error('copyPreviousShiftAction error:', error)
        return { error: error.message }
    }

    return { success: true, copied: data as number }
}

/**
 * Bulk-log production at end of shift.
 * For each entry, looks up the shift assignment rate → falls back to machine.default_rate_per_m → falls back to provided default.
 */
export async function bulkLogProduction(entries: {
    machine_id: string
    worker_id: number
    order_id: string | null
    meters: number
    shift: 'day' | 'night'
    date: string
    rate_per_m?: number
}[], accessCode?: string) {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()
    const orgId = profile.org_id

    if (entries.length === 0) return { success: true }

    const headerList = await headers()
    const clientIp = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'

    // ── Guard: Ensure every machine with meters has an order assigned ──
    const invalidEntry = entries.find(e => e.meters > 0 && !e.order_id)
    if (invalidEntry) {
        return { error: 'ORDER_MISSING', message: 'All machines with production must have an assigned order.' }
    }

    const logs = entries
        .filter((e) => e.meters > 0) // We already know e.order_id exists from the guard above
        .map((e) => ({
            org_id: orgId,
            machine_id: e.machine_id,
            worker_id: e.worker_id,
            order_id: e.order_id!,
            meters: e.meters,
            shift: e.shift,
            date: e.date,
            worker_rate_snapshot: e.rate_per_m ?? 1.5,
            created_by: user.id,
            client_ip: clientIp
        }))

    if (logs.length === 0) return { success: true, logged: 0 }

    // ── Guard: check for existing logs for the same machine, date, and shift ──
    const machineIds = [...new Set(logs.map((l) => l.machine_id))]
    const logDate = logs[0].date
    const logShift = logs[0].shift

    const { data: existingLogs } = await supabase
        .from('production_logs')
        .select('machine_id')
        .eq('org_id', orgId)
        .eq('date', logDate)
        .eq('shift', logShift)
        .in('machine_id', machineIds)

    if (existingLogs && existingLogs.length > 0) {
        if (!accessCode) {
            return {
                error: 'DUPLICATE_LOG_DETECTED',
                message: 'Production logs already exist for some machines on this shift. This requires an owner access code to overwrite.',
                duplicateMachines: existingLogs.map((l) => l.machine_id),
            }
        }

        // Validate the access code
        let isCodeValid = false
        try {
            isCodeValid = await validateAndConsumeAccessCode(user.id, orgId, accessCode)
        } catch (e: any) {
            return { error: e.message }
        }

        if (!isCodeValid) return { error: 'Invalid or expired access code' }

        // If code is valid, delete existing logs for these machines/date/shift before inserting new ones
        // We use the service client because supervisors don't have DELETE permission on production_logs
        const serviceClient = getServiceClient()
        const { error: deleteError } = await serviceClient
            .from('production_logs')
            .delete()
            .eq('org_id', orgId)
            .eq('date', logDate)
            .eq('shift', logShift)
            .in('machine_id', machineIds)

        if (deleteError) {
            console.error('bulkLogProduction – delete error:', deleteError)
            return { error: 'Failed to clear old logs. Please try again.' }
        }
    }

    // ── Guard: production date must not be before the order's start date ──
    const orderIds = [...new Set(logs.map((l) => l.order_id).filter(Boolean))] as string[]
    if (orderIds.length > 0) {
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('id, created_at')
            .in('id', orderIds)
            .eq('org_id', orgId)

        if (ordersError) {
            console.error('bulkLogProduction – order lookup error:', ordersError)
            return { error: 'Failed to validate order dates. Please try again.' }
        }

        const orderStartMap = new Map(
            (orders ?? []).map((o) => [o.id, o.created_at.split('T')[0]])
        )

        for (const log of logs) {
            if (!log.order_id) continue
            const orderStart = orderStartMap.get(log.order_id)
            if (orderStart && log.date < orderStart) {
                return {
                    error: `Production date (${log.date}) cannot be before the order's start date (${orderStart}).`,
                }
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────

    const { error } = await supabase.from('production_logs').insert(logs)

    if (error) {
        console.error('bulkLogProduction error:', error)
        return { error: error.message }
    }

    revalidatePath('/supervisor/production')
    revalidatePath('/owner/orders')
    return { success: true, logged: logs.length }
}

export async function packProductionIntoBulkPackages(entries: {
    machine_id: string
    worker_id: number
    order_id: string | null
    meters: number
    shift: 'day' | 'night'
    date: string
}[]) {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const validEntries = entries.filter((entry) => entry.order_id && entry.meters > 0)
    if (validEntries.length === 0) return { error: 'No production entries available to pack' }

    const grouped = new Map<string, { metres: number; date: string; shift: 'day' | 'night' }>()
    for (const entry of validEntries) {
        const key = entry.order_id as string
        const existing = grouped.get(key)
        if (existing) {
            existing.metres += Number(entry.meters)
        } else {
            grouped.set(key, {
                metres: Number(entry.meters),
                date: entry.date,
                shift: entry.shift,
            })
        }
    }

    const orderIds = Array.from(grouped.keys())
    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .eq('org_id', profile.org_id)
        .in('id', orderIds)

    if (orderError) return { error: orderError.message }
    const orderSet = new Set((orders ?? []).map((order) => order.id))

    const inserts = Array.from(grouped.entries())
        .filter(([orderId, meta]) => orderSet.has(orderId) && meta.metres > 0)
        .map(([orderId, meta]) => ({
            org_id: profile.org_id,
            order_id: orderId,
            package_type: 'bulk',
            units_count: 1,
            metres: Number(meta.metres.toFixed(2)),
            grade: 'A',
            inspection_status: 'pending',
            stock_state: 'uninspected',
            location: 'Grey Floor',
            source_date: meta.date,
            source_shift: meta.shift,
            source_reference: `Packed from ${meta.shift} shift production`,
            created_by: user.id,
        }))

    if (inserts.length === 0) return { error: 'No valid orders available to pack' }

    const { error } = await supabase
        .from('fabric_packages')
        .insert(inserts)

    if (error) return { error: error.message }

    revalidatePath('/owner/stock')
    revalidatePath('/owner/orders')
    revalidatePath('/owner/dispatches')
    return {
        success: true,
        packages_created: inserts.length,
        metres_packed: inserts.reduce((sum, item) => sum + Number(item.metres), 0),
    }
}

// ─── Payroll & Float Management (Module 5) ────────────────────────────────────

/**
 * recordKharchi — Supervisor-facing action to disperse small cash stipends.
 * Implementation of Task 3.1: Late-sync aware advance recording.
 */
export async function recordKharchi(params: {
    workerType: 'meter' | 'fixed'
    workerId: number
    amount: number
    description: string
}) {
    const { user, profile } = await requireRole(['supervisor', 'owner'])
    const supabase = await createServerClient()

    // 1. Get Cycle Config
    const { data: config } = await supabase
        .from('payroll_configs')
        .select('cycle_start_day')
        .eq('org_id', profile.org_id)
        .maybeSingle()

    const cycleStartDay = config?.cycle_start_day || 1

    // 2. Derive Current Cycle Start Date (Postgres Helper)
    const { data: bounds, error: boundsErr } = await supabase
        .rpc('get_cycle_bounds', {
            p_date: new Date().toISOString().split('T')[0],
            p_cycle_start_day: cycleStartDay,
        })
        .single()

    if (boundsErr) {
        console.error('Failed to get cycle bounds:', boundsErr)
        return { error: 'Failed to determine payroll cycle.' }
    }

    let cycleStartDate = (bounds as any).cycle_start

    // 3. Late Sync Check: Is this specific worker's cycle already settled?
    const { data: existingSettlement } = await supabase
        .from('payroll_settlements')
        .select('id, status')
        .eq('org_id', profile.org_id)
        .eq('cycle_start_date', cycleStartDate)
        .eq(params.workerType === 'meter' ? 'meter_worker_id' : 'fixed_worker_id', params.workerId)
        .maybeSingle()

    let wasLateSync = false
    if (existingSettlement && existingSettlement.status === 'paid') {
        // Already paid! Roll to NEXT cycle
        const { data: nextBounds } = await supabase
            .rpc('get_cycle_bounds', {
                p_date: new Date(new Date(cycleStartDate).getTime() + 32 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split('T')[0],
                p_cycle_start_day: cycleStartDay,
            })
            .single()
        cycleStartDate = (nextBounds as any).cycle_start
        wasLateSync = true
    }

    // 4. Record advance
    const { data: advance, error: advErr } = await supabase
        .from('worker_advances')
        .insert({
            org_id: profile.org_id,
            meter_worker_id: params.workerType === 'meter' ? params.workerId : null,
            fixed_worker_id: params.workerType === 'fixed' ? params.workerId : null,
            amount: params.amount,
            description: params.description,
            type: 'kharchi',
            cycle_start_date: cycleStartDate,
            status: 'pending',
        })
        .select('id')
        .single()

    if (advErr) {
        console.error('Failed to record kharchi advance:', advErr)
        return { error: 'Failed to record entry.' }
    }

    // 5. Log Float Disbursement
    const { error: floatErr } = await supabase.from('supervisor_float_transactions').insert({
        org_id: profile.org_id,
        supervisor_id: user.id,
        type: 'disbursement',
        amount: params.amount,
        worker_advance_id: advance.id,
    })

    if (floatErr) {
        console.error('Failed to log float transaction:', floatErr)
    }

    revalidatePath('/owner/advances')
    revalidatePath('/owner/payroll')
    revalidatePath('/supervisor')

    return {
        success: true,
        rolledOver: wasLateSync,
        cycleStartDate,
    }
}

/**
 * refillSupervisorFloat — Owner-facing action to recharge a supervisor's cash float.
 */
export async function refillSupervisorFloat(supervisorId: string, amount: number) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { error } = await supabase.from('supervisor_float_transactions').insert({
        org_id: profile.org_id,
        supervisor_id: supervisorId,
        type: 'refill',
        amount: amount,
    })

    if (error) {
        console.error('Failed to refill float:', error)
        return { error: 'Failed to refill float.' }
    }

    revalidatePath('/owner/settings')
    revalidatePath('/supervisor')
    return { success: true }
}

/**
 * getSupervisorBalance — Derives the current balance from the transaction ledger.
 */
export async function getSupervisorBalance(supervisorId: string) {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('supervisor_float_transactions')
        .select('type, amount')
        .eq('org_id', profile.org_id)
        .eq('supervisor_id', supervisorId)

    if (error) return 0

    const credits = data.filter((t) => t.type === 'refill').reduce((acc, t) => acc + Number(t.amount), 0)
    const debits = data
        .filter((t) => t.type === 'disbursement')
        .reduce((acc, t) => acc + Number(t.amount), 0)

    return credits - debits
}

/**
 * Update the machine_status column in the machines table.
 * Used for the high-contrast status badges on the supervisor dashboard.
 */
export async function updateMachineStatus(machineId: string, status: 'running' | 'idle' | 'maintenance') {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const machineParsed = safeParse(UuidSchema, machineId)
    if ('error' in machineParsed) return { error: machineParsed.error }

    const statusParsed = safeParse(MachineStatusSchema, status)
    if ('error' in statusParsed) return { error: statusParsed.error }

    const { error } = await supabase
        .from('machines')
        .update({ machine_status: statusParsed.data })
        .eq('id', machineParsed.data)
        .eq('org_id', profile.org_id)

    if (error) {
        console.error('Failed to update machine status:', error)
        return { error: 'Failed to update machine status. Please try again.' }
    }

    revalidatePath('/supervisor/production')
    return { success: true }
}

/**
 * Update breakdown categories and notes for a machine shift.
 * Persists data to the shift_assignments table.
 */
export async function updateMachineBreakdown(params: {
    machineId: string
    date: string
    shift: 'day' | 'night'
    category: string | null
    notes: string
}) {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const machineParsed = safeParse(UuidSchema, params.machineId)
    if ('error' in machineParsed) return { error: machineParsed.error }

    const { error } = await supabase
        .from('shift_assignments')
        .update({
            breakdown_category: params.category,
            breakdown_notes: params.notes
        })
        .eq('machine_id', machineParsed.data)
        .eq('date', params.date)
        .eq('shift', params.shift)
        .eq('org_id', profile.org_id)

    if (error) {
        console.error('Failed to update machine breakdown:', error)
        return { error: 'Failed to save breakdown details.' }
    }

    revalidatePath('/supervisor/dashboard')
    return { success: true }
}
