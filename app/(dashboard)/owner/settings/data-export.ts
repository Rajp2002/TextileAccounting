'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth'
import { UX012_DISTINCTIONS, UX012_EXPORT_LABELS, UX012_PRIORITY_HELPERS, UX012_TERMS } from '@/lib/terminology'

const REDACTED = '[REDACTED]'
const SENSITIVE_EXPORT_FIELD_NAMES = new Set([
    'access_code_hash',
    'authorization',
    'client_ip',
    'cookie',
    'esi_number',
    'join_code',
    'last_code_plain',
    'password',
    'pf_number',
    'phone',
    'recipient_phone',
    'service_role_key',
    'test_password',
    'tracking_token',
    'whatsapp_number',
])

type ExportRecord = Record<string, unknown>

function isSensitiveExportField(field: string) {
    const normalized = field.toLowerCase()
    return SENSITIVE_EXPORT_FIELD_NAMES.has(normalized)
        || normalized.includes('secret')
        || normalized.includes('token')
        || normalized.includes('password')
}

function redactSensitiveFields(row: ExportRecord): ExportRecord {
    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
            key,
            isSensitiveExportField(key) && value != null ? REDACTED : value,
        ])
    )
}

function redactRows(rows: ExportRecord[] | null | undefined) {
    return (rows ?? []).map(redactSensitiveFields)
}

/**
 * Export all organization data as a structured JSON object.
 * DPDP Act 2023 — Right to Access (Section 11)
 */
export async function exportOrganizationData() {
    const { user, profile } = await requireRole(['owner'])
    const supabase = createAdminClient()
    const orgId = profile.org_id
    const exportedAt = new Date().toISOString()

    // Query all org-scoped tables in parallel
    const queryResults = await Promise.all([
        supabase.from('workers').select('id, org_id, name, is_active, start_date, pf_esi_eligible, pf_esi_enrolled').eq('org_id', orgId),
        supabase.from('fixed_workers').select('id, org_id, name, role, monthly_salary, is_active, start_date, pf_esi_eligible, pf_esi_enrolled').eq('org_id', orgId),
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
        supabase.from('yarn_lots').select('*').eq('org_id', orgId),
        supabase.from('yarn_movements').select('*').eq('org_id', orgId),
        supabase.from('beam_cards').select('*').eq('org_id', orgId),
        supabase.from('beam_card_lots').select('*').eq('org_id', orgId),
        supabase.from('order_yarn_requirements').select('*').eq('org_id', orgId),
        supabase.from('dispatches').select('*').eq('org_id', orgId),
        supabase.from('estimator_quotes').select('*').eq('org_id', orgId),
        supabase.from('estimator_templates').select('*').eq('org_id', orgId),
        supabase.from('factory_cost_profile').select('*').eq('factory_id', orgId),
        supabase.from('cost_rate_book').select('*').eq('org_id', orgId),
        supabase.from('cost_rate_history').select('*').eq('org_id', orgId),
        supabase.from('payroll_configs').select('*').eq('org_id', orgId),
        supabase.from('worker_consent_artifacts').select('*').eq('org_id', orgId),
        supabase.from('language_requests').select('*').eq('org_id', orgId),
        supabase.from('grievances').select('*').eq('org_id', orgId),
        supabase.from('organization_dpas').select('*').eq('org_id', orgId),
        supabase.from('organizations').select('*').eq('id', orgId),
        supabase.from('profiles').select('id, full_name, role').eq('org_id', orgId),
    ])
    const failedQuery = queryResults.find(result => result.error)
    if (failedQuery?.error) {
        console.error('Organization export query failed', { code: failedQuery.error.code })
        throw new Error('The organization export is incomplete. No export was generated; please try again.')
    }
    const [
        workers, fixedWorkers, machines, productionLogs, payrollPayments,
        payrollSettlements, payrollAdjustments, workerAdvances, supervisorFloatTransactions,
        attendance, orders, qualities, yarnBatches, yarnLots, yarnMovements, beamCards,
        beamCardLots, orderYarnRequirements, dispatches, estimatorQuotes, estimatorTemplates,
        factoryCostProfile, costRateBook, costRateHistory, payrollConfigs, workerConsentArtifacts,
        languageRequests, grievances, organizationDpas, organization, profiles,
    ] = queryResults.map(result => result.data)

    const { error: auditError } = await supabase.rpc('log_export_event', {
        p_org_id: orgId,
        p_table_name: 'owner_data_export',
        p_record_id: orgId,
        p_description: `Owner organization data export generated at ${exportedAt}`,
        p_actor_id: user.id,
    })

    if (auditError) {
        console.error('Failed to audit organization export:', auditError.message)
        throw new Error('Data export could not be audited. Please try again.')
    }

    return {
        exported_at: exportedAt,
        export_scope: 'current_owner_org',
        terminology: {
            baseline: 'UX-012 product-owner-approved limited-pilot baseline',
            display_terms: UX012_TERMS,
            dataset_labels: UX012_EXPORT_LABELS,
            high_risk_distinctions: UX012_DISTINCTIONS,
            priority_helpers: UX012_PRIORITY_HELPERS,
            note: 'Dataset keys remain stable technical identifiers for portability; use these labels and distinctions when interpreting records.',
        },
        sensitive_fields_review: {
            redaction_marker: REDACTED,
            redacted_fields: Array.from(SENSITIVE_EXPORT_FIELD_NAMES).sort(),
            excluded_runtime_sources: [
                'auth headers',
                'cookies',
                'environment variables',
                'request headers',
                'service-role keys',
            ],
        },
        organization: organization?.[0] ? redactSensitiveFields(organization[0] as ExportRecord) : null,
        profiles: redactRows(profiles as ExportRecord[] | null),
        workers: redactRows(workers as ExportRecord[] | null),
        fixed_workers: redactRows(fixedWorkers as ExportRecord[] | null),
        machines: redactRows(machines as ExportRecord[] | null),
        production_logs: redactRows(productionLogs as ExportRecord[] | null),
        payroll_payments: redactRows(payrollPayments as ExportRecord[] | null),
        payroll_settlements: redactRows(payrollSettlements as ExportRecord[] | null),
        payroll_adjustments: redactRows(payrollAdjustments as ExportRecord[] | null),
        worker_advances: redactRows(workerAdvances as ExportRecord[] | null),
        supervisor_float_transactions: redactRows(supervisorFloatTransactions as ExportRecord[] | null),
        attendance: redactRows(attendance as ExportRecord[] | null),
        orders: redactRows(orders as ExportRecord[] | null),
        qualities: redactRows(qualities as ExportRecord[] | null),
        yarn_batches: redactRows(yarnBatches as ExportRecord[] | null),
        yarn_lots: redactRows(yarnLots as ExportRecord[] | null),
        yarn_movements: redactRows(yarnMovements as ExportRecord[] | null),
        beam_cards: redactRows(beamCards as ExportRecord[] | null),
        beam_card_lots: redactRows(beamCardLots as ExportRecord[] | null),
        order_yarn_requirements: redactRows(orderYarnRequirements as ExportRecord[] | null),
        dispatches: redactRows(dispatches as ExportRecord[] | null),
        estimator_quotes: redactRows(estimatorQuotes as ExportRecord[] | null),
        estimator_templates: redactRows(estimatorTemplates as ExportRecord[] | null),
        factory_cost_profile: redactRows(factoryCostProfile as ExportRecord[] | null),
        cost_rate_book: redactRows(costRateBook as ExportRecord[] | null),
        cost_rate_history: redactRows(costRateHistory as ExportRecord[] | null),
        payroll_configs: redactRows(payrollConfigs as ExportRecord[] | null),
        worker_consent_artifacts: redactRows(workerConsentArtifacts as ExportRecord[] | null),
        language_requests: redactRows(languageRequests as ExportRecord[] | null),
        grievances: redactRows(grievances as ExportRecord[] | null),
        organization_dpas: redactRows(organizationDpas as ExportRecord[] | null),
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
    const { getDestructiveLimiter, checkRateLimit, getRateLimitRetrySeconds } = await import('@/lib/rate-limit')
    const limiter = await checkRateLimit(getDestructiveLimiter, user.id)
    if (!limiter.success) {
        throw new Error(`Too many attempts. Try again in ${getRateLimitRetrySeconds(limiter.reset)} seconds.`)
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
        'cost_rate_history',
        'cost_rate_book',
        'factory_cost_profile',
        'payroll_configs',
        'worker_consent_artifacts',
        'language_requests',
        'grievances',
        'organization_dpas',
        'beam_card_lots',
        'yarn_movements',
        'beam_cards',
        'order_yarn_requirements',
        'yarn_lots',
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
