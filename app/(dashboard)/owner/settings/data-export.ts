'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth'

/**
 * Export all organization data as a structured JSON object.
 * DPDP Act 2023 — Right to Access (Section 11)
 */
export async function exportOrganizationData() {
    const { profile } = await requireRole(['owner'])
    const supabase = createAdminClient()
    const orgId = profile.org_id

    // Query all org-scoped tables in parallel
    const [
        { data: workers },
        { data: fixedWorkers },
        { data: machines },
        { data: productionLogs },
        { data: payrollPayments },
        { data: payrollSettlements },
        { data: payrollAdjustments },
        { data: workerAdvances },
        { data: supervisorFloatTransactions },
        { data: attendance },
        { data: orders },
        { data: qualities },
        { data: yarnBatches },
        { data: dispatches },
        { data: estimatorQuotes },
        { data: estimatorTemplates },
        { data: factoryCostProfile },
        { data: payrollConfigs },
        { data: workerConsentArtifacts },
        { data: languageRequests },
        { data: grievances },
        { data: organizationDpas },
        { data: organization },
        { data: profiles },
    ] = await Promise.all([
        supabase.from('workers').select('*').eq('org_id', orgId),
        supabase.from('fixed_workers').select('*').eq('org_id', orgId),
        supabase.from('machines').select('*').eq('org_id', orgId),
        supabase.from('production_logs').select('*').eq('org_id', orgId).order('date', { ascending: false }),
        supabase.from('payroll_payments').select('*').eq('org_id', orgId),
        supabase.from('payroll_settlements').select('*').eq('org_id', orgId),
        supabase.from('payroll_adjustments').select('*').eq('org_id', orgId),
        supabase.from('worker_advances').select('*').eq('org_id', orgId),
        supabase.from('supervisor_float_transactions').select('*').eq('org_id', orgId),
        supabase.from('attendance').select('*').eq('org_id', orgId),
        supabase.from('orders').select('*').eq('org_id', orgId),
        supabase.from('qualities').select('*').eq('org_id', orgId),
        supabase.from('yarn_batches').select('*').eq('org_id', orgId),
        supabase.from('dispatches').select('*').eq('org_id', orgId),
        supabase.from('estimator_quotes').select('*').eq('org_id', orgId),
        supabase.from('estimator_templates').select('*').eq('org_id', orgId),
        supabase.from('factory_cost_profile').select('*').eq('factory_id', orgId),
        supabase.from('payroll_configs').select('*').eq('org_id', orgId),
        supabase.from('worker_consent_artifacts').select('*').eq('org_id', orgId),
        supabase.from('language_requests').select('*').eq('org_id', orgId),
        supabase.from('grievances').select('*').eq('org_id', orgId),
        supabase.from('organization_dpas').select('*').eq('org_id', orgId),
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
        payroll_settlements: payrollSettlements || [],
        payroll_adjustments: payrollAdjustments || [],
        worker_advances: workerAdvances || [],
        supervisor_float_transactions: supervisorFloatTransactions || [],
        attendance: attendance || [],
        orders: orders || [],
        qualities: qualities || [],
        yarn_batches: yarnBatches || [],
        dispatches: dispatches || [],
        estimator_quotes: estimatorQuotes || [],
        estimator_templates: estimatorTemplates || [],
        factory_cost_profile: factoryCostProfile || [],
        payroll_configs: payrollConfigs || [],
        worker_consent_artifacts: workerConsentArtifacts || [],
        language_requests: languageRequests || [],
        grievances: grievances || [],
        organization_dpas: organizationDpas || [],
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
    const admin = createAdminClient()
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
        'dispatches',
        'payroll_adjustments',
        'supervisor_float_transactions',
        'worker_advances',
        'payroll_settlements',
        'attendance',
        'payroll_payments',
        'production_logs',
        'estimator_quotes',
        'estimator_templates',
        'factory_cost_profile',
        'payroll_configs',
        'worker_consent_artifacts',
        'language_requests',
        'grievances',
        'organization_dpas',
        'yarn_batches',
        'orders',
        'qualities',
        'workers',
        'fixed_workers',
        'machines',
    ]

    for (const table of deletionOrder) {
        const orgColumn = table === 'factory_cost_profile' ? 'factory_id' : 'org_id'
        const { error } = await admin.from(table).delete().eq(orgColumn, orgId)
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
    const { error: profilesError } = await admin
        .from('profiles')
        .delete()
        .eq('org_id', orgId)

    if (profilesError) {
        console.error('Failed to delete profiles:', profilesError.message)
    }

    // Delete the organization itself
    const { error: orgError } = await admin
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
