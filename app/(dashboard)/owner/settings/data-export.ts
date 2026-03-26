'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

/**
 * Export all organization data as a structured JSON object.
 * DPDP Act 2023 — Right to Access (Section 11)
 */
export async function exportOrganizationData() {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const orgId = profile.org_id

    // Query all org-scoped tables in parallel
    const [
        { data: workers },
        { data: fixedWorkers },
        { data: machines },
        { data: productionLogs },
        { data: payrollPayments },
        { data: workerAdvances },
        { data: attendance },
        { data: orders },
        { data: fabricQualities },
        { data: yarnBatches },
        { data: beamAssignments },
        { data: yieldAuditReports },
        { data: organization },
        { data: profiles },
    ] = await Promise.all([
        supabase.from('workers').select('*').eq('org_id', orgId),
        supabase.from('fixed_workers').select('*').eq('org_id', orgId),
        supabase.from('machines').select('*').eq('org_id', orgId),
        supabase.from('production_logs').select('*').eq('org_id', orgId).order('date', { ascending: false }),
        supabase.from('payroll_payments').select('*').eq('org_id', orgId),
        supabase.from('worker_advances').select('*').eq('org_id', orgId),
        supabase.from('attendance').select('*').eq('org_id', orgId),
        supabase.from('orders').select('*').eq('org_id', orgId),
        supabase.from('fabric_qualities').select('*').eq('org_id', orgId),
        supabase.from('yarn_batches').select('*').eq('org_id', orgId),
        supabase.from('beam_assignments').select('*').eq('org_id', orgId),
        supabase.from('yield_audit_reports').select('*').eq('org_id', orgId),
        supabase.from('organizations').select('*').eq('id', orgId),
        supabase.from('profiles').select('id, full_name, role, phone').eq('org_id', orgId),
    ])

    return {
        exported_at: new Date().toISOString(),
        organization: organization?.[0] || null,
        profiles: profiles || [],
        workers: workers || [],
        fixed_workers: fixedWorkers || [],
        machines: machines || [],
        production_logs: productionLogs || [],
        payroll_payments: payrollPayments || [],
        worker_advances: workerAdvances || [],
        attendance: attendance || [],
        orders: orders || [],
        fabric_qualities: fabricQualities || [],
        yarn_batches: yarnBatches || [],
        beam_assignments: beamAssignments || [],
        yield_audit_reports: yieldAuditReports || [],
    }
}

/**
 * Permanently delete all organization data and sign the user out.
 * DPDP Act 2023 — Right to Erasure (Section 12)
 * 
 * This is destructive and irreversible.
 * The caller must pass the exact organization name as confirmation.
 */
export async function deleteOrganizationData(confirmationName: string) {
    const { profile, user } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const orgId = profile.org_id

    // Check rate limit for destructive action
    const { getDestructiveLimiter, checkRateLimit } = await import('@/lib/rate-limit')
    const limiter = await checkRateLimit(getDestructiveLimiter, user.id)
    if (!limiter.success) {
        throw new Error(`Too many attempts. Try again in ${Math.ceil(limiter.reset / 1000)} seconds.`)
    }

    // Verify the confirmation name matches the org name
    const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single()

    if (!org || org.name !== confirmationName) {
        throw new Error('Organization name does not match. Deletion cancelled.')
    }

    // Delete in dependency order (children first, parents last)
    // Each delete is scoped to org_id via RLS + explicit filter
    const deletionOrder = [
        'yield_audit_reports',
        'beam_assignments',
        'yarn_batches',
        'fabric_qualities',
        'worker_advances',
        'attendance',
        'payroll_payments',
        'production_logs',
        'orders',
        'workers',
        'fixed_workers',
        'machines',
    ]

    for (const table of deletionOrder) {
        const { error } = await supabase.from(table).delete().eq('org_id', orgId)
        if (error) {
            console.error(`Failed to delete from ${table}:`, error.message)
            // Continue trying other tables even if one fails
        }
    }

    // Revoke sessions for all users in this org instantly
    const { data: orgProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('org_id', orgId)

    if (orgProfiles) {
        const { revokeUserSession } = await import('@/lib/rate-limit')
        await Promise.all(orgProfiles.map(p => revokeUserSession(p.id)))
    }

    // Delete profiles associated with this org
    const { error: profilesError } = await supabase
        .from('profiles')
        .delete()
        .eq('org_id', orgId)

    if (profilesError) {
        console.error('Failed to delete profiles:', profilesError.message)
    }

    // Delete the organization itself
    const { error: orgError } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId)

    if (orgError) {
        console.error('Failed to delete organization:', orgError.message)
    }

    // Sign the user out
    await supabase.auth.signOut()

    return { success: true }
}
