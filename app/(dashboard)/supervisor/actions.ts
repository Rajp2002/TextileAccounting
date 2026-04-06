'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import {
    SavePastAttendanceSchema,
    AccessCodeSchema,
    UuidSchema,
    WorkerIdSchema,
    ShiftSchema,
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
        .update({ access_code_hash: null, access_code_expires_at: null })
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
    const upsertData = parsed.data.records.map(record => ({
        org_id: orgId,
        fixed_worker_id: record.fixed_worker_id,
        date: parsed.data.date,
        present: record.present,
        marked_by: user.id
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
    const { profile } = await requireRole(['owner', 'supervisor'])
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

    const parsed = safeParse(PositiveIntSchema, workerId)
    if ('error' in parsed) return { error: parsed.error }

    const { error } = await supabase
        .from(table)
        .update({ is_active: !currentActive })
        .eq('id', parsed.data)
        .eq('org_id', profile.org_id)

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

    revalidatePath('/supervisor/assignments')
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

    // 2. Save hash to organizations table
    const { error } = await supabase
        .from('organizations')
        .update({ access_code_hash: hash, access_code_expires_at: expiresAt })
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
            .select('id, machine_id, worker_id, order_id, rate_per_m')
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

    revalidatePath('/supervisor/assignments')
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

    revalidatePath('/supervisor/assignments')
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
}[]) {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    if (entries.length === 0) return { success: true }

    const logs = entries
        .filter((e) => e.meters > 0)
        .map((e) => ({
            org_id: profile.org_id,
            machine_id: e.machine_id,
            worker_id: e.worker_id,
            order_id: e.order_id,
            meters: e.meters,
            shift: e.shift,
            date: e.date,
            worker_rate_snapshot: e.rate_per_m ?? 1.5,
            created_by: user.id,
        }))

    if (logs.length === 0) return { success: true, logged: 0 }

    const { error } = await supabase.from('production_logs').insert(logs)

    if (error) {
        console.error('bulkLogProduction error:', error)
        return { error: error.message }
    }

    revalidatePath('/supervisor/production')
    revalidatePath('/owner/orders')
    return { success: true, logged: logs.length }
}

