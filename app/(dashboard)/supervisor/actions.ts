'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/auth'
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
    const { profile } = await requireRole(['owner', 'supervisor'])
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
    const { profile } = await requireRole(['owner', 'supervisor'])
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
    const { profile } = await requireRole(['owner', 'supervisor'])
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
