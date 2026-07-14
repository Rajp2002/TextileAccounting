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

    const record = {
        org_id: profile.org_id,
        amount: data.amount,
        description: data.description || null,
        status: 'pending',
        meter_worker_id: data.workerType === 'meter' ? data.workerId : null,
        fixed_worker_id: data.workerType === 'fixed' ? data.workerId : null,
    }

    const { data: inserted, error } = await supabase
        .from('worker_advances')
        .insert(record)
        .select('id')
        .single()

    if (error) {
        console.error('Failed to create advance:', error)
        return { error: 'Failed to create advance. Please try again.' }
    }

    const notification: { attempted: boolean; sent: boolean; reason: string; balance?: number } = { attempted: false, sent: false, reason: "unknown" }
    
    if (inserted?.id) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        
        if (supabaseUrl && serviceRoleKey) {
            notification.attempted = true
            
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 3000)
            
            try {
                const res = await fetch(`${supabaseUrl}/functions/v1/send-advance-receipt`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        org_id: profile.org_id,
                        advance_id: inserted.id,
                        worker_id: data.workerId,
                        worker_type: data.workerType,
                    }),
                    signal: controller.signal
                })
                clearTimeout(timeoutId)
                
                const result = await res.json().catch(() => ({}))
                
                if (res.ok) {
                    if (result.skipped) {
                        notification.reason = result.reason === "missing_phone"
                            ? "no_phone"
                            : result.reason === "phone_mismatch"
                                ? "phone_mismatch"
                                : result.reason === "missing_consent"
                                    ? "missing_consent"
                                    : "opted_out"
                    } else if (result.success) {
                        notification.sent = true
                        notification.reason = "success"
                        notification.balance = result.balance
                    } else {
                        notification.reason = "provider_error"
                    }
                } else {
                    notification.reason = "provider_error"
                }
            } catch (err) {
                clearTimeout(timeoutId)
                if (err instanceof Error && err.name === 'AbortError') {
                    notification.reason = "timeout"
                } else {
                    notification.reason = "provider_error"
                    console.error('[advance-receipt] Notification failed:', err)
                }
            }
        } else {
            notification.reason = "missing_env"
        }
    }
    
    revalidatePath('/owner/advances')
    revalidatePath('/owner/payroll')
    
    return { 
        success: true, 
        advance: { id: inserted?.id, amount: data.amount, description: data.description },
        notification 
    }
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
        .eq('org_id', profile.org_id)

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
        .is('writeoff_at', null)

    if (error) {
        console.error('Failed to fetch advances summary:', error)
        return []
    }

    return data || []
}
