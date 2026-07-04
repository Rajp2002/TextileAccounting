'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { assertOrgWritable, requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
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
import { getCycleBoundsForDate } from '@/lib/payroll-cycle'
import { validateEntry, VALIDATION_MESSAGES } from '@/lib/production-log-validation'
import { evaluateProductionWorkerAssignmentPolicy } from '@/lib/production-worker-assignment-policy'
import { generateAndStoreAccessCode, validateAndConsumeAccessCode } from '@/lib/access-codes'
import {
    buildProtectedLoomActionError,
    getLoomLifecycleProtectionReasons,
    type LoomLifecycleProtectionInput,
} from '@/lib/master-data-loom-guardrails'

type ShiftType = 'day' | 'night'

interface ProductionLogRow {
    id: number
    machine_id: string
    date: string
    shift: ShiftType
    meters: number
    closing_meter_reading: number | null
    opening_meter_reading: number | null
    counter_was_reset: boolean
    submitted_at: string | null
    zero_meter_reason: string | null
}

type MessageError = { message?: string }
type WorkerIdLogRow = { worker_id: number | null }

type KharchiRpcResult = {
    rolled_over?: boolean
    cycle_start_date?: string
}

type MachineLifecycleSupabase = Awaited<ReturnType<typeof createServerClient>>
type MachineOrderStatusRelation = { status?: string | null } | Array<{ status?: string | null }> | null

// ─── Internal Helpers ──────────────────────────────────────────────────────────

function getMachineOrderStatus(orders: MachineOrderStatusRelation) {
    if (Array.isArray(orders)) return orders[0]?.status ?? null
    return orders?.status ?? null
}

async function getMachineLifecycleProtectionInput(
    supabase: MachineLifecycleSupabase,
    orgId: string,
    machineId: string
): Promise<{ input?: LoomLifecycleProtectionInput; error?: string }> {
    const [machineRes, standingAssignmentsRes, shiftAssignmentsRes, productionLogsRes] = await Promise.all([
        supabase
            .from('machines')
            .select('current_order_id, orders(status)')
            .eq('id', machineId)
            .eq('org_id', orgId)
            .single(),
        supabase
            .from('machine_assignments')
            .select('id')
            .eq('machine_id', machineId)
            .eq('org_id', orgId)
            .limit(1),
        supabase
            .from('shift_assignments')
            .select('id')
            .eq('machine_id', machineId)
            .eq('org_id', orgId)
            .limit(1),
        supabase
            .from('production_logs')
            .select('id')
            .eq('machine_id', machineId)
            .eq('org_id', orgId)
            .limit(1),
    ])

    if (machineRes.error || !machineRes.data) {
        if (machineRes.error) console.error('Failed to verify loom references:', machineRes.error)
        return { error: 'Failed to check loom references. Please try again.' }
    }

    if (standingAssignmentsRes.error || shiftAssignmentsRes.error || productionLogsRes.error) {
        console.error('Failed to verify loom protected references:', {
            standingAssignmentsError: standingAssignmentsRes.error,
            shiftAssignmentsError: shiftAssignmentsRes.error,
            productionLogsError: productionLogsRes.error,
        })
        return { error: 'Failed to check loom references. Please try again.' }
    }

    const machine = machineRes.data as {
        current_order_id: string | null
        orders: MachineOrderStatusRelation
    }

    return {
        input: {
            currentOrderId: machine.current_order_id,
            currentOrderStatus: getMachineOrderStatus(machine.orders),
            standingAssignmentCount: standingAssignmentsRes.data?.length ?? 0,
            shiftAssignmentCount: shiftAssignmentsRes.data?.length ?? 0,
            productionLogCount: productionLogsRes.data?.length ?? 0,
        },
    }
}

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

async function getWritableServiceClient(orgId: string) {
    await assertOrgWritable(orgId)
    return getServiceClient()
}

function getLatestSubmittedAt(logs: Array<{ submitted_at: string | null }>) {
    const validTimestamps = logs
        .map((log) => log.submitted_at)
        .filter((value): value is string => Boolean(value))
        .map((value) => new Date(value).getTime())
        .filter((value) => Number.isFinite(value))

    if (validTimestamps.length === 0) return null
    return new Date(Math.max(...validTimestamps)).toISOString()
}

function getErrorMessage(error: unknown, fallback = 'Unexpected error') {
    return error instanceof Error ? error.message : fallback
}

async function supervisorWorkerHasHistory(
    supabase: Awaited<ReturnType<typeof createServerClient>>,
    orgId: string,
    workerId: number
) {
    const [settlementsRes, advancesRes] = await Promise.all([
        supabase.from('payroll_settlements').select('id').eq('org_id', orgId).eq('meter_worker_id', workerId).limit(1),
        supabase.from('worker_advances').select('id').eq('org_id', orgId).eq('meter_worker_id', workerId).limit(1),
    ])

    if (settlementsRes.error) throw settlementsRes.error
    if (advancesRes.error) throw advancesRes.error

    return (settlementsRes.data?.length ?? 0) > 0 || (advancesRes.data?.length ?? 0) > 0
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
    } catch (e) {
        return { error: getErrorMessage(e, 'Invalid or expired access code') }
    }
    if (!isCodeValid) return { error: 'Invalid or expired access code' }

    // 2. Bypass RLS for past-date insert
    let serviceClient
    try {
        serviceClient = await getWritableServiceClient(orgId)
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

    const supabase = await createServerClient()
    const protection = await getMachineLifecycleProtectionInput(supabase, orgId, machineParsed.data)
    if (protection.error) return { error: protection.error }

    const reasons = getLoomLifecycleProtectionReasons(protection.input ?? {})
    if (reasons.length > 0) {
        return { error: buildProtectedLoomActionError('delete', reasons) }
    }

    let isCodeValid = false
    try {
        isCodeValid = await validateAndConsumeAccessCode(user.id, orgId, accessCode)
    } catch (e) {
        return { error: getErrorMessage(e, 'Invalid or expired access code') }
    }
    if (!isCodeValid) return { error: 'Invalid or expired access code' }

    let serviceClient
    try {
        serviceClient = await getWritableServiceClient(orgId)
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
 * Delete a worker with no historical records.
 */
export async function deleteWorker(workerId: number) {
    const { user, profile } = await requireRole(['supervisor'])
    const orgId = profile.org_id

    const workerParsed = safeParse(WorkerIdSchema, workerId)
    if ('error' in workerParsed) return { error: workerParsed.error }

    const supabase = await createServerClient()
    const hasHistory = await supervisorWorkerHasHistory(supabase, orgId, workerParsed.data)
    if (hasHistory) return { error: 'This worker has production history and still requires an access code.' }

    let serviceClient
    try {
        serviceClient = await getWritableServiceClient(orgId)
    } catch {
        return { error: 'A server error occurred. Please try again later.' }
    }

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
    } catch (e) {
        return { error: getErrorMessage(e, 'Invalid or expired access code') }
    }
    if (!isCodeValid) return { error: 'Invalid or expired access code' }

    let serviceClient
    try {
        serviceClient = await getWritableServiceClient(orgId)
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
    } catch (e) {
        return { error: getErrorMessage(e, 'Invalid or expired access code') }
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
        serviceClient = await getWritableServiceClient(orgId)
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
 * Link an order-backed production target to a machine.
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
        serviceClient = await getWritableServiceClient(orgId)
    } catch {
        return { error: 'A server error occurred. Please try again later.' }
    }

    const { data: order, error: orderError } = await serviceClient
        .from('orders')
        .select('id')
        .eq('id', orderParsed.data)
        .eq('org_id', orgId)
        .eq('status', 'active')
        .single()

    if (orderError || !order) {
        if (orderError) console.error('Error verifying active production target:', orderError)
        return { error: 'Only active cost analyses or qualities can be assigned to a machine.' }
    }

    // Set audit actor before service-role DML
    await serviceClient.rpc('set_actor_for_audit', { p_actor_id: user.id })

    const { error } = await serviceClient
        .from('machines')
        .update({ current_order_id: orderParsed.data })
        .eq('id', machineParsed.data)
        .eq('org_id', orgId)

    if (error) {
        console.error('Error linking production target to machine:', error)
        return { error: 'Failed to assign cost analysis to machine. Please try again.' }
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
        serviceClient = await getWritableServiceClient(orgId)
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
        .is('writeoff_at', null)
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
    } catch (e) {
        return { error: getErrorMessage(e, 'Invalid or expired access code') }
    }
    if (!isCodeValid) return { error: 'Invalid or expired access code' }

    let serviceClient
    try {
        serviceClient = await getWritableServiceClient(orgId)
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
    pf_esi_enrolled: boolean
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
            pf_esi_enrolled: data.pf_esi_enrolled,
            pf_esi_eligible: data.pf_esi_enrolled,
            esi_number: data.esi_number,
            pf_number: data.pf_number,
            org_id: profile.org_id
        })
        .select('id')
        .single()
        
    if (error) return { error: error.message }
    return { success: true, workerId: inserted.id as number }
}

/**
 * Bulk-add piece-rate workers in a single roundtrip.
 * Used by the onboarding checklist to avoid N parallel server-action calls.
 * Returns all inserted worker IDs for subsequent phone-number saves.
 */
export async function addMeterWorkersBulk(
    workers: { name: string; pf_esi_enrolled: boolean }[]
) {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    if (!workers.length) return { error: 'No workers to add.' }
    if (workers.length > 100) return { error: 'Cannot add more than 100 workers at once.' }

    // Validate all names upfront
    const rows = workers.map(w => {
        const name = w.name.trim()
        if (!name) return null
        return {
            name,
            is_active: true,
            pf_esi_enrolled: w.pf_esi_enrolled,
            pf_esi_eligible: w.pf_esi_enrolled,
            org_id: profile.org_id,
        }
    })

    if (rows.some(r => r === null)) {
        return { error: 'All workers must have a name.' }
    }

    const { data: inserted, error } = await supabase
        .from('workers')
        .insert(rows as NonNullable<(typeof rows)[number]>[])
        .select('id')

    if (error) {
        console.error('Failed to bulk-add workers:', error)
        return { error: 'Failed to add workers. Please try again.' }
    }

    return {
        success: true,
        workerIds: (inserted ?? []).map(r => r.id as number),
    }
}

export async function addFixedWorker(data: {
    name: string
    role: string
    monthly_salary: number
    pf_esi_enrolled: boolean
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
            pf_esi_enrolled: data.pf_esi_enrolled,
            pf_esi_eligible: data.pf_esi_enrolled,
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

    let error: MessageError | null = null
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

    let generated: Awaited<ReturnType<typeof generateAndStoreAccessCode>>
    try {
        generated = await generateAndStoreAccessCode(profile.org_id)
    } catch (error) {
        console.error('[requestAccessCode] DB Update failed:', error)
        return { error: error instanceof Error ? error.message : 'Failed to generate request. Please try again.' }
    }

    // Fire-and-forget: send notification to owner via Edge Function.
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
                code: generated.code,
                expires_at: generated.expiresAt,
                requested_by: requester?.name || 'Supervisor'
            }),
        }).catch((err) => console.error('[request-access-code] Notification failed:', err))
    }

    return { success: true }
}

// ─── Shift Assignments (Module 3) ─────────────────────────────────────────────

/**
 * Get all data needed for the shift setup screen for a given date + shift.
 * Returns machines, active production targets, active workers, and any existing assignments.
 */
export async function getShiftSetupData(date: string, shift: 'day' | 'night') {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const orgId = profile.org_id
    const supabase = await createServerClient()

    const [machinesRes, ordersRes, workersRes, assignmentsRes, standingAssignmentsRes] = await Promise.all([
        supabase
            .from('machines')
            .select('id, name, status, machine_status, default_rate_per_m, current_order_id')
            .eq('org_id', orgId)
            .eq('status', 'active')
            .order('name'),
        supabase
            .from('orders')
            .select('id, quality_label, party_name, warp_instruction, weft_instruction, total_target_meters, deadline, status, worker_rate_per_m, market_run_id')
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
        supabase
            .from('machine_assignments')
            .select('machine_id, worker_id, shift')
            .eq('org_id', orgId)
    ])

    const activeOrderIds = new Set((ordersRes.data ?? []).map((order) => order.id))
    const activeWorkerIds = new Set((workersRes.data ?? []).map((worker) => worker.id))
    const standingAssignmentsByMachineId = new Map<string, { day?: number; night?: number }>()
    for (const assignment of standingAssignmentsRes.data ?? []) {
        if (!activeWorkerIds.has(assignment.worker_id)) continue
        const current = standingAssignmentsByMachineId.get(assignment.machine_id) ?? {}
        current[assignment.shift as 'day' | 'night'] = assignment.worker_id
        standingAssignmentsByMachineId.set(assignment.machine_id, current)
    }

    const eligibleMachines = (machinesRes.data ?? []).filter((machine) => (
        Boolean(machine.current_order_id && activeOrderIds.has(machine.current_order_id))
    ))

    const machineIds = eligibleMachines.map((machine) => machine.id)
    const orderIds = (ordersRes.data ?? []).map((order) => order.id)
    const orderRateById = new Map((ordersRes.data ?? []).map((order) => [order.id, Number(order.worker_rate_per_m)]))
    const datedAssignmentByMachineId = new Map(
        (assignmentsRes.data ?? []).map((assignment) => [assignment.machine_id, assignment])
    )
    const assignments = eligibleMachines.flatMap((machine) => {
        const existing = datedAssignmentByMachineId.get(machine.id)
        const standingAssignments = standingAssignmentsByMachineId.get(machine.id)
        const workerId = standingAssignments?.[shift] ?? null
        const orderId = machine.current_order_id ?? null

        if (existing) {
            const mergedOrderId = existing.order_id ?? orderId

            return [{
                ...existing,
                worker_id: workerId,
                order_id: mergedOrderId,
                rate_per_m: existing.rate_per_m
                    ?? (mergedOrderId ? (orderRateById.get(mergedOrderId) ?? machine.default_rate_per_m ?? 1.5) : (machine.default_rate_per_m ?? 1.5)),
            }]
        }

        return [{
            id: null,
            machine_id: machine.id,
            worker_id: workerId,
            order_id: orderId,
            rate_per_m: orderId ? (orderRateById.get(orderId) ?? machine.default_rate_per_m ?? 1.5) : (machine.default_rate_per_m ?? 1.5),
            breakdown_category: null,
            breakdown_notes: null,
        }]
    })

    const [currentLogsRes, orderProductionRes] = await Promise.all([
        machineIds.length === 0
            ? Promise.resolve({ data: [] as ProductionLogRow[] })
            : supabase
                  .from('production_logs')
                  .select('id, machine_id, date, shift, meters, opening_meter_reading, closing_meter_reading, counter_was_reset, submitted_at, zero_meter_reason')
                  .eq('org_id', orgId)
                  .eq('date', date)
                  .eq('shift', shift)
                  .in('machine_id', machineIds),
        orderIds.length === 0
            ? Promise.resolve({ data: [] as Array<{ order_id: string; meters: number | null }> })
            : supabase
                  .from('production_logs')
                  .select('order_id, meters')
                  .eq('org_id', orgId)
                  .in('order_id', orderIds),
    ])

    const producedMetersByOrderId = new Map<string, number>()
    for (const row of orderProductionRes.data ?? []) {
        if (!row.order_id) continue
        producedMetersByOrderId.set(
            row.order_id,
            (producedMetersByOrderId.get(row.order_id) ?? 0) + Number(row.meters ?? 0)
        )
    }

    return {
        machines: eligibleMachines,
        orders: (ordersRes.data ?? []).map((order) => ({
            ...order,
            produced_meters: producedMetersByOrderId.get(order.id) ?? 0,
            remaining_meters: Math.max(
                Number(order.total_target_meters ?? 0) - (producedMetersByOrderId.get(order.id) ?? 0),
                0
            ),
        })),
        workers: workersRes.data ?? [],
        assignments,
        existingLogs: currentLogsRes.data ?? [],
        latestSubmittedAt: getLatestSubmittedAt((currentLogsRes.data ?? []) as Array<{ submitted_at: string | null }>),
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

    const [machineParsed, shiftParsed] = [
        safeParse(UuidSchema, data.machine_id),
        safeParse(ShiftSchema, data.shift),
    ]
    if ('error' in machineParsed) return { error: machineParsed.error }
    if ('error' in shiftParsed) return { error: shiftParsed.error }

    if (data.order_id !== null) {
        const orderParsed = safeParse(UuidSchema, data.order_id)
        if ('error' in orderParsed) return { error: orderParsed.error }

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id')
            .eq('id', orderParsed.data)
            .eq('org_id', profile.org_id)
            .eq('status', 'active')
            .single()

        if (orderError || !order) {
            if (orderError) console.error('upsertShiftAssignment active production target check error:', orderError)
            return { error: 'Only active cost analyses or qualities can be assigned to a loom.' }
        }
    }

    const { error } = await supabase
        .from('shift_assignments')
        .upsert(
            {
                org_id: profile.org_id,
                date: data.date,
                shift: data.shift,
                machine_id: machineParsed.data,
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

    if (data.worker_id) {
        const { error: standingWorkerError } = await supabase
            .from('machine_assignments')
            .upsert(
                {
                    org_id: profile.org_id,
                    machine_id: machineParsed.data,
                    shift: shiftParsed.data,
                    worker_id: data.worker_id,
                },
                { onConflict: 'org_id,machine_id,shift' }
            )

        if (standingWorkerError) {
            console.error('standing machine assignment error:', standingWorkerError)
            return { error: standingWorkerError.message }
        }
    }

    if (data.order_id !== null) {
        const { error: standingOrderError } = await supabase
            .from('machines')
            .update({ current_order_id: data.order_id })
            .eq('id', machineParsed.data)
            .eq('org_id', profile.org_id)

        if (standingOrderError) {
            console.error('standing machine order error:', standingOrderError)
            return { error: standingOrderError.message }
        }
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
    await requireRole(['owner', 'supervisor'])
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
 *
 * Strictness rules:
 *   meters > 0  → require worker + quality/work anchor (order_id) + rate > 0
 *   meters === 0 → require zero_meter_reason; worker/order/rate are optional
 */
export async function bulkLogProduction(entries: {
    machine_id: string
    worker_id: number | null
    order_id: string | null
    meters: number
    opening_meter_reading: number
    closing_meter_reading: number
    counter_was_reset?: boolean
    shift: 'day' | 'night'
    date: string
    rate_per_m?: number | null
    zero_meter_reason?: string | null
    zero_meter_note?: string | null
}[], accessCode?: string) {
    const { user, profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()
    const orgId = profile.org_id

    if (entries.length === 0) return { success: true }

    const headerList = await headers()
    const clientIp = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown'

    // ── Strictness / Forgiveness validation ──────────────────────────────
    for (const entry of entries) {
        // Skip entries that will be filtered out (0m without reason)
        if (entry.meters === 0 && !entry.zero_meter_reason?.trim()) continue

        const validation = validateEntry({
            machine_id: entry.machine_id,
            meters: entry.meters,
            worker_id: entry.worker_id,
            order_id: entry.order_id,
            rate_per_m: entry.rate_per_m,
            zero_meter_reason: entry.zero_meter_reason,
            zero_meter_note: entry.zero_meter_note,
        })

        if (!validation.valid) {
            const nonWorkerErrors = validation.errors.filter((error) => error !== VALIDATION_MESSAGES.WORKER_REQUIRED)
            if (entry.meters > 0 && !entry.worker_id && nonWorkerErrors.length === 0) {
                continue
            }
            return { error: validation.errors[0], message: validation.errors[0] }
        }
    }

    const negativeEntry = entries.find(e => !e.counter_was_reset && (e.closing_meter_reading < e.opening_meter_reading || e.meters < 0))
    if (negativeEntry) {
        return { error: VALIDATION_MESSAGES.NEGATIVE_METERS }
    }

    const logs = entries
        .filter((e) => e.meters > 0 || Boolean(e.zero_meter_reason?.trim()))
        .map((e) => {
            const isProduction = e.meters > 0
            const resolvedMeters = e.counter_was_reset ? e.closing_meter_reading : e.meters
            // Build the reason string: for status logs, combine reason + note
            let zeroReason: string | null = null
            if (!isProduction && e.zero_meter_reason?.trim()) {
                const parts = [e.zero_meter_reason.trim()]
                if (e.zero_meter_note?.trim()) parts.push(e.zero_meter_note.trim())
                zeroReason = parts.join(': ')
            }

            return {
                org_id: orgId,
                machine_id: e.machine_id,
                worker_id: isProduction ? e.worker_id : (e.worker_id || null),
                order_id: isProduction ? e.order_id! : (e.order_id || null),
                meters: resolvedMeters,
                opening_meter_reading: e.counter_was_reset ? 0 : e.opening_meter_reading,
                closing_meter_reading: e.closing_meter_reading,
                counter_was_reset: e.counter_was_reset ?? false,
                shift: e.shift,
                date: e.date,
                worker_rate_snapshot: isProduction ? e.rate_per_m! : 0,
                created_by: user.id,
                updated_by: user.id,
                submitted_at: new Date().toISOString(),
                client_ip: clientIp,
                zero_meter_reason: zeroReason,
            }
        })

    if (logs.length === 0) return { success: true, logged: 0 }

    const machineIds = [...new Set(logs.map((l) => l.machine_id))]
    const logDate = logs[0].date
    const logShift = logs[0].shift

    // ── Guard: production can only be saved for looms that are fully active ──
    const [machinesRes, standingAssignmentsRes] = await Promise.all([
        supabase
            .from('machines')
            .select('id, name, status, current_order_id, orders(status)')
            .eq('org_id', orgId)
            .in('id', machineIds),
        supabase
            .from('machine_assignments')
            .select('machine_id, worker_id, shift')
            .eq('org_id', orgId)
            .in('machine_id', machineIds)
            .in('shift', ['day', 'night']),
    ])

    if (machinesRes.error) {
        console.error('bulkLogProduction – machine eligibility lookup error:', machinesRes.error)
        return { error: 'Failed to validate loom setup. Please try again.' }
    }

    if (standingAssignmentsRes.error) {
        console.error('bulkLogProduction – standing assignment lookup error:', standingAssignmentsRes.error)
        return { error: 'Failed to validate worker assignments. Please try again.' }
    }

    const workerIds = [...new Set((standingAssignmentsRes.data ?? []).map((assignment) => assignment.worker_id))]
    const activeWorkerIds = new Set<number>()
    if (workerIds.length > 0) {
        const { data: activeWorkers, error: activeWorkersError } = await supabase
            .from('workers')
            .select('id')
            .eq('org_id', orgId)
            .eq('is_active', true)
            .in('id', workerIds)

        if (activeWorkersError) {
            console.error('bulkLogProduction – active worker lookup error:', activeWorkersError)
            return { error: 'Failed to validate worker assignments. Please try again.' }
        }

        for (const worker of activeWorkers ?? []) activeWorkerIds.add(worker.id)
    }

    const machineById = new Map((machinesRes.data ?? []).map((machine) => [machine.id, machine]))
    const standingByMachineId = new Map<string, { day?: number; night?: number }>()
    for (const assignment of standingAssignmentsRes.data ?? []) {
        if (!activeWorkerIds.has(assignment.worker_id)) continue
        const current = standingByMachineId.get(assignment.machine_id) ?? {}
        current[assignment.shift as 'day' | 'night'] = assignment.worker_id
        standingByMachineId.set(assignment.machine_id, current)
    }

    for (const log of logs) {
        // Downtime / status logs (0m with reason) bypass loom setup checks
        if (log.meters === 0 && log.zero_meter_reason) continue

        const machine = machineById.get(log.machine_id)
        const activeOrder = Array.isArray(machine?.orders) ? machine?.orders[0] : machine?.orders
        const standingAssignments = standingByMachineId.get(log.machine_id)
        const policyResult = evaluateProductionWorkerAssignmentPolicy({
            machineName: machine?.name,
            machineStatus: machine?.status,
            currentOrderId: machine?.current_order_id,
            logOrderId: log.order_id,
            activeOrderStatus: activeOrder?.status,
            shift: log.shift,
            logWorkerId: log.worker_id,
            standingAssignments,
        })

        if (!policyResult.ok) {
            return { error: policyResult.code, message: policyResult.message }
        }
    }

    // ── Guard: check for existing logs for the same machine, date, and shift ──
    const { data: existingLogs } = await supabase
        .from('production_logs')
        .select('id, machine_id, worker_id, date, shift, meters, opening_meter_reading, closing_meter_reading, counter_was_reset, submitted_at')
        .eq('org_id', orgId)
        .eq('date', logDate)
        .eq('shift', logShift)
        .in('machine_id', machineIds)

    const hasExistingLogs = Boolean(existingLogs && existingLogs.length > 0)
    let accessCodeUsedForOverwrite = false

    if (hasExistingLogs) {
        const now = Date.now()
        const correctionWindowOpenForAll = existingLogs!.every((log) => {
            if (!log.submitted_at) return false
            return now - new Date(log.submitted_at).getTime() < 30 * 60 * 1000
        })

        if (!correctionWindowOpenForAll) {
            if (!accessCode) {
                return {
                    error: 'DUPLICATE_LOG_DETECTED',
                    message: 'Production logs already exist for some machines on this shift. This requires an owner access code to overwrite.',
                    duplicateMachines: existingLogs!.map((l) => l.machine_id),
                }
            }

            // Validate the access code
            let isCodeValid = false
            try {
                isCodeValid = await validateAndConsumeAccessCode(user.id, orgId, accessCode)
            } catch (e: unknown) {
                return { error: e instanceof Error ? e.message : 'Invalid or expired access code' }
            }

            if (!isCodeValid) return { error: 'Invalid or expired access code' }
            accessCodeUsedForOverwrite = true
        }
    }

    // ── Guard: check if payroll is already settled for this period ──
    const { data: payrollConfig } = await supabase
        .from('payroll_configs')
        .select('cycle_start_day')
        .eq('org_id', orgId)
        .maybeSingle()

    const cycleStartDay = payrollConfig?.cycle_start_day || 1

    const bounds = getCycleBoundsForDate(logDate, cycleStartDay)
    const cycleStart = bounds.cycle_start

    if (cycleStart) {
        const payrollWorkerIds = [...new Set([
            ...logs.map((l) => l.worker_id),
            ...(existingLogs?.map((l) => (l as WorkerIdLogRow).worker_id) || [])
        ])].filter((id): id is number => id != null)

        if (payrollWorkerIds.length > 0) {
            const { data: settlements } = await supabase
                .from('payroll_settlements')
                .select('id')
                .eq('org_id', orgId)
                .eq('cycle_start_date', cycleStart)
                .in('meter_worker_id', payrollWorkerIds)
                .eq('status', 'paid')

            if (settlements && settlements.length > 0) {
                return {
                    error: 'PAYROLL_ALREADY_SETTLED',
                    message: 'Production logs cannot be modified because payroll for this period is already settled for one or more workers.',
                }
            }
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

    const { data: replaceRows, error } = await supabase.rpc('replace_shift_production_logs', {
        p_logs: logs,
        p_allow_overwrite: hasExistingLogs,
        p_access_code_used: accessCodeUsedForOverwrite,
    })

    if (error) {
        if (error.message.includes('DUPLICATE_LOG_DETECTED')) {
            return {
                error: 'DUPLICATE_LOG_DETECTED',
                message: 'Production logs already exist for some machines on this shift. Please refresh before overwriting.',
                duplicateMachines: machineIds,
            }
        }

        console.error('bulkLogProduction error:', error)
        return { error: error.message }
    }

    const replaceResult = Array.isArray(replaceRows) ? replaceRows[0] : replaceRows
    const loggedCount = Number(replaceResult?.inserted_count ?? logs.length)

    revalidatePath('/supervisor/production')
    revalidatePath('/owner/today')
    revalidatePath('/owner/analytics')
    revalidatePath('/owner/orders')
    revalidatePath('/owner/market-runs')
    revalidatePath('/owner/stock')
    revalidatePath('/owner/payroll')
    return {
        success: true,
        logged: loggedCount,
        correctionWindowExpiresAt: logs[0]?.submitted_at
            ? new Date(new Date(logs[0].submitted_at).getTime() + 30 * 60 * 1000).toISOString()
            : null,
    }
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
    await requireRole(['supervisor', 'owner'])
    const supabase = await createServerClient()

    if (!Number.isFinite(params.amount) || params.amount <= 0) {
        return { error: 'Kharchi amount must be greater than zero.' }
    }

    const { data, error } = await supabase.rpc('record_supervisor_kharchi', {
        p_worker_type: params.workerType,
        p_worker_id: params.workerId,
        p_amount: params.amount,
        p_description: params.description?.trim() ?? '',
    })

    if (error) {
        console.error('Failed to record kharchi atomically:', error)
        return { error: error.message || 'Failed to record entry.' }
    }

    const result = data as KharchiRpcResult | null

    revalidatePath('/owner/advances')
    revalidatePath('/owner/payroll')
    revalidatePath('/supervisor')

    return {
        success: true,
        rolledOver: Boolean(result?.rolled_over),
        cycleStartDate: result?.cycle_start_date ?? null,
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
