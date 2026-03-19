'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/auth'
import { validateAndRotateAccessCode } from '@/app/(dashboard)/owner/actions'

interface AttendanceRecordInput {
    fixed_worker_id: number
    present: boolean
}

/**
 * Save attendance for past dates. Requires a valid one-time owner access code.
 */
export async function savePastAttendance(
    orgId: string,
    date: string,
    records: AttendanceRecordInput[],
    accessCode: string
) {
    const { user } = await requireRole(['owner', 'supervisor'])

    // 1. Validate the one-time access code
    const isCodeValid = await validateAndRotateAccessCode(orgId, accessCode)

    if (!isCodeValid) {
        return { error: 'Invalid or expired access code' }
    }

    // 2. Bypassing RLS requires the service role key, because the DB policy 
    // restricts past-date attendance edits to 'owner' only.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return { error: 'Missing Supabase environment variables' }
    }

    const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    // 3. Upsert the records
    const upsertData = records.map(record => ({
        org_id: orgId,
        fixed_worker_id: record.fixed_worker_id,
        date: date,
        present: record.present,
        marked_by: user.id
    }))

    const { error } = await serviceClient
        .from('attendance')
        .upsert(upsertData, {
            onConflict: 'fixed_worker_id,date'
        })

    if (error) {
        console.error('Error saving past attendance:', error)
        return { error: 'Failed to save attendance records' }
    }

    return { success: true }
}

/**
 * Delete a machine. Requires a valid one-time owner access code.
 */
export async function deleteMachineWithCode(orgId: string, machineId: string, accessCode: string) {
    await requireRole(['supervisor'])

    const isCodeValid = await validateAndRotateAccessCode(orgId, accessCode)
    if (!isCodeValid) {
        return { error: 'Invalid or expired access code' }
    }

    const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await serviceClient
        .from('machines')
        .delete()
        .eq('id', machineId)
        .eq('org_id', orgId)

    if (error) return { error: 'Failed to delete machine' }
    return { success: true }
}

/**
 * Delete a worker. Requires a valid one-time owner access code.
 */
export async function deleteWorkerWithCode(orgId: string, workerId: number, accessCode: string) {
    await requireRole(['supervisor'])

    const isCodeValid = await validateAndRotateAccessCode(orgId, accessCode)
    if (!isCodeValid) {
        return { error: 'Invalid or expired access code' }
    }

    const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await serviceClient
        .from('workers')
        .delete()
        .eq('id', workerId)
        .eq('org_id', orgId)

    if (error) return { error: 'Failed to delete worker' }
    return { success: true }
}

/**
 * Verify an access code without performing a destructive action.
 * Useful for unlocking UI elements for past/saved data.
 */
export async function verifyAccessCode(orgId: string, accessCode: string) {
    await requireRole(['owner', 'supervisor'])

    const isCodeValid = await validateAndRotateAccessCode(orgId, accessCode)
    if (!isCodeValid) {
        return { error: 'Invalid or expired access code' }
    }

    return { success: true }
}

/**
 * Link an active yarn batch to a specific machine ("Start Beam").
 */
export async function startBeam(batchId: string, machineId: string) {
    const { profile } = await requireRole(['owner', 'supervisor'])

    const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Fetch default rate from the batch's quality
    const { data: batchData, error: batchError } = await serviceClient
        .from('yarn_batches')
        .select('org_id, quality_id, qualities(default_worker_rate_per_m)')
        .eq('id', batchId)
        .single()

    if (batchError || !batchData) {
        console.error('Error fetching batch:', batchError)
        return { error: 'Failed to fetch batch data' }
    }

    const defaultRate = (batchData.qualities as any)?.default_worker_rate_per_m || 0

    // 2. Clear other batches from this machine
    await serviceClient
        .from('yarn_batches')
        .update({ current_machine_id: null })
        .eq('current_machine_id', machineId)
        .eq('org_id', profile.org_id)
        .eq('status', 'active')

    // 3. Link this batch to the machine
    const { error: linkError } = await serviceClient
        .from('yarn_batches')
        .update({ current_machine_id: machineId })
        .eq('id', batchId)
        .eq('org_id', profile.org_id)

    if (linkError) {
        console.error('Error linking batch:', linkError)
        return { error: 'Failed to link batch to machine' }
    }

    // 4. Update machine rate (Rate Automation Gap)
    if (defaultRate > 0) {
        await serviceClient
            .from('machines')
            .update({ rate_per_meter: defaultRate })
            .eq('id', machineId)
            .eq('org_id', profile.org_id)
    }

    return { success: true }
}
/**
 * Link an order to a machine.
 */
export async function linkOrderToMachine(orderId: string, machineId: string) {
    const { profile } = await requireRole(['owner', 'supervisor'])

    const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await serviceClient
        .from('machines')
        .update({ current_order_id: orderId })
        .eq('id', machineId)
        .eq('org_id', profile.org_id)

    if (error) {
        console.error('Error linking order:', error)
        return { error: 'Failed to assign order to machine' }
    }

    return { success: true }
}

/**
 * Perform a shift handover by unlinking the current worker from a machine for a specific shift.
 * (Shift Handover Gap)
 */
export async function shiftHandover(orgId: string, machineId: string, shift: 'day' | 'night') {
    await requireRole(['owner', 'supervisor'])

    const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await serviceClient
        .from('machine_assignments')
        .delete()
        .eq('org_id', orgId)
        .eq('machine_id', machineId)
        .eq('shift', shift)

    if (error) {
        console.error('Error in shift handover:', error)
        return { error: 'Failed to perform shift handover' }
    }

    return { success: true }
}

/**
 * Check if a worker has any outstanding advance (Upaad) balance.
 * (Advance vs. Resignation Gap)
 */
export async function getWorkerDebt(orgId: string, workerId: number, workerType: 'meter' | 'fixed' = 'meter') {
    await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('worker_advances')
        .select('amount')
        .eq('org_id', orgId)
        .eq('status', 'pending')
        .eq(workerType === 'meter' ? 'meter_worker_id' : 'fixed_worker_id', workerId)

    if (error) {
        console.error('Error fetching worker debt:', error)
        return { error: 'Failed to fetch worker debt' }
    }

    const balance = data?.reduce((sum, row) => sum + Number(row.amount), 0) || 0
    return { balance }
}
