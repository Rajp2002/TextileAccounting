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

    // Use the RPC we created to handle the linking safely
    const { error } = await serviceClient.rpc('link_batch_to_machine', {
        p_batch_id: batchId,
        p_machine_id: machineId
    })

    if (error) {
        console.error('Error linking beam to machine:', error)
        return { error: 'Failed to start beam on machine' }
    }

    return { success: true }
}
