'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import {
    CreateAdvanceSchema,
    GetAdvancesSchema,
    PositiveIntSchema,
    safeParse,
} from '@/lib/schemas'

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

    // ── Zod validation ──────────────────────────────────────────────────────
    const parsed = safeParse(CreateAdvanceSchema, { workerType, workerId, amount, description })
    if ('error' in parsed) return { error: parsed.error }
    const data = parsed.data

    const record: any = {
        org_id: profile.org_id,
        amount: data.amount,
        description: data.description || null,
        status: 'pending',
        meter_worker_id: data.workerType === 'meter' ? data.workerId : null,
        fixed_worker_id: data.workerType === 'fixed' ? data.workerId : null,
    }

    const { error } = await supabase
        .from('worker_advances')
        .insert(record)

    if (error) {
        console.error('Failed to create advance:', error)
        return { error: 'Failed to create advance. Please try again.' }
    }

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

    // Validate advanceId is a positive integer
    const parsed = safeParse(PositiveIntSchema, advanceId)
    if ('error' in parsed) return { error: parsed.error }

    // Verify the advance exists, belongs to this org, and is pending
    const { data: advance, error: fetchErr } = await supabase
        .from('worker_advances')
        .select('id, status')
        .eq('id', parsed.data)
        .eq('org_id', profile.org_id)
        .maybeSingle()

    if (fetchErr || !advance) return { error: 'Advance not found' }
    if (advance.status !== 'pending') return { error: 'Only pending advances can be deleted' }

    const { error } = await supabase
        .from('worker_advances')
        .delete()
        .eq('id', parsed.data)

    if (error) {
        console.error('Failed to delete advance:', error)
        return { error: 'Failed to delete advance. Please try again.' }
    }

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

    const parsed = safeParse(GetAdvancesSchema, { workerType, workerId, statusFilter })
    if ('error' in parsed) return []

    let query = supabase
        .from('worker_advances')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq(parsed.data.workerType === 'meter' ? 'meter_worker_id' : 'fixed_worker_id', parsed.data.workerId)
        .order('created_at', { ascending: false })

    if (parsed.data.statusFilter) {
        query = query.eq('status', parsed.data.statusFilter)
    }

    const { data, error } = await query
    if (error) {
        console.error('Failed to fetch advances:', error)
        return []
    }

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

    if (error) {
        console.error('Failed to fetch advances summary:', error)
        return []
    }

    return data || []
}
