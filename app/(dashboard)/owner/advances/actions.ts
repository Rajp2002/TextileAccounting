'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

/**
 * Create a new advance (upaad) for a worker.
 * Owner-only. Supports both piece-rate and fixed workers.
 */
export async function createAdvance(
    workerType: 'meter' | 'fixed',
    workerId: number,
    amount: number,
    description: string
) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    if (amount <= 0) throw new Error('Advance amount must be positive')

    const record: any = {
        org_id: profile.org_id,
        amount,
        description: description.trim() || null,
        status: 'pending',
        meter_worker_id: workerType === 'meter' ? workerId : null,
        fixed_worker_id: workerType === 'fixed' ? workerId : null,
    }

    const { error } = await supabase
        .from('worker_advances')
        .insert(record)

    if (error) throw new Error(`Failed to create advance: ${error.message}`)

    revalidatePath('/owner/advances')
    revalidatePath('/owner/payroll')
    return { success: true }
}

/**
 * Delete a pending advance. Only pending advances can be deleted.
 * Owner-only.
 */
export async function deleteAdvance(advanceId: number) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    // Verify the advance exists, belongs to this org, and is pending
    const { data: advance, error: fetchErr } = await supabase
        .from('worker_advances')
        .select('id, status')
        .eq('id', advanceId)
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (fetchErr || !advance) throw new Error('Advance not found')
    if (advance.status !== 'pending') throw new Error('Only pending advances can be deleted')

    const { error } = await supabase
        .from('worker_advances')
        .delete()
        .eq('id', advanceId)

    if (error) throw new Error(`Failed to delete advance: ${error.message}`)

    revalidatePath('/owner/advances')
    revalidatePath('/owner/payroll')
    return { success: true }
}

/**
 * Fetch all advances for a specific worker.
 * Available to both owners and supervisors (RLS SELECT is tenant-scoped).
 */
export async function getWorkerAdvances(
    workerType: 'meter' | 'fixed',
    workerId: number,
    statusFilter?: 'pending' | 'deducted'
) {
    const { profile } = await requireRole(['owner', 'supervisor'])
    const supabase = await createServerClient()

    let query = supabase
        .from('worker_advances')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq(workerType === 'meter' ? 'meter_worker_id' : 'fixed_worker_id', workerId)
        .order('created_at', { ascending: false })

    if (statusFilter) {
        query = query.eq('status', statusFilter)
    }

    const { data, error } = await query

    if (error) throw new Error(`Failed to fetch advances: ${error.message}`)

    return data || []
}

/**
 * Fetch summary of pending advances for all workers in an org.
 * Used by the payroll page to show advance deductions.
 */
export async function getPendingAdvancesSummary() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('worker_advances')
        .select('meter_worker_id, fixed_worker_id, amount')
        .eq('org_id', profile.org_id)
        .eq('status', 'pending')

    if (error) throw new Error(`Failed to fetch advances summary: ${error.message}`)

    return data || []
}
