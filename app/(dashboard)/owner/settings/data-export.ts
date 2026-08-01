'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth'
import { UX012_DISTINCTIONS, UX012_EXPORT_LABELS, UX012_PRIORITY_HELPERS, UX012_TERMS } from '@/lib/terminology'
import crypto from 'crypto'

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

export type OrganizationExportHistoryItem = {
    changed_at: string
    record_id: string | null
    actor_name: string
    description: string
    status?: 'generated' | 'failed'
}

function getOrganizationExportFilename(exportedAt: string) {
    const compactTimestamp = exportedAt.replace(/\D/g, '').slice(0, 14) || new Date().toISOString().replace(/\D/g, '').slice(0, 14)
    return `weavly-org-export-${compactTimestamp}.json`
}

async function persistFailedExportRun(
    supabase: ReturnType<typeof createAdminClient>,
    {
        orgId,
        actorId,
        filename,
        exportedAt,
        reason,
    }: {
        orgId: string
        actorId: string
        filename: string
        exportedAt: string
        reason: string
    },
) {
    try {
        const { data: failedRun, error } = await supabase
            .from('organization_export_runs')
            .insert({
                org_id: orgId,
                actor_id: actorId,
                status: 'failed',
                filename,
                schema_version: 'sprint4-v1',
                exported_at: exportedAt,
                dataset_counts: {},
                failure_reason: reason.slice(0, 500),
            })
            .select('id')
            .single()

        if (error || !failedRun) {
            console.error('Failed to persist organization export failure:', error?.message)
            return
        }

        const { error: auditError } = await supabase.rpc('log_export_event', {
            p_org_id: orgId,
            p_table_name: 'owner_data_export',
            p_record_id: failedRun.id,
            p_description: `Owner organization data export failed at ${exportedAt}; filename ${filename}; reason ${reason.slice(0, 300)}`,
            p_actor_id: actorId,
        })
        if (auditError) console.error('Failed to audit organization export failure:', auditError.message)
    } catch (error) {
        console.error('Failed to record organization export failure:', error instanceof Error ? error.message : error)
    }
}

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
    const filename = getOrganizationExportFilename(exportedAt)

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
        supabase.from('organization_billing_profiles').select('id, org_id, legal_name, address_line1, address_line2, city, state, state_code, postal_code, billing_email, gstin, created_at, updated_at').eq('org_id', orgId),
        supabase.from('org_subscriptions').select('id, org_id, plan_tier, status, current_start, current_end, checkout_purchase_type, checkout_amount_paise, checkout_currency, razorpay_order_id, razorpay_payment_id, created_at, updated_at').eq('org_id', orgId),
        supabase.from('subscription_payments').select('id, org_id, subscription_id, razorpay_payment_id, razorpay_order_id, amount_paise, status, method, captured_at, created_at').eq('org_id', orgId),
        supabase.from('billing_invoices').select('*').eq('org_id', orgId),
        supabase.from('billing_checkout_attempts').select('id, org_id, client_request_id, plan_tier, purchase_type, billing_model, base_amount_paise, gst_amount_paise, total_amount_paise, currency, status, provider_order_id, provider_payment_id, provider_order_status, provider_status, org_subscription_id, failure_code, failure_reason, expires_at, last_checked_at, created_at, updated_at').eq('org_id', orgId),
        supabase.from('billing_payment_refunds').select('id, org_id, razorpay_payment_id, amount_paise, reason, status, idempotency_key, provider_refund_id, attempts, last_error, created_at, updated_at').eq('org_id', orgId),
    ])
    const failedQuery = queryResults.find(result => result.error)
    if (failedQuery?.error) {
        const reason = 'The organization export is incomplete. No export was generated; please try again.'
        console.error('Organization export query failed', { code: failedQuery.error.code })
        await persistFailedExportRun(supabase, { orgId, actorId: user.id, filename, exportedAt, reason })
        throw new Error(reason)
    }
    const [
        workers, fixedWorkers, machines, productionLogs, payrollPayments,
        payrollSettlements, payrollAdjustments, workerAdvances, supervisorFloatTransactions,
        attendance, orders, qualities, yarnBatches, yarnLots, yarnMovements, beamCards,
        beamCardLots, orderYarnRequirements, dispatches, estimatorQuotes, estimatorTemplates,
        factoryCostProfile, costRateBook, costRateHistory, payrollConfigs, workerConsentArtifacts,
        languageRequests, grievances, organizationDpas, organization, profiles,
        billingProfiles, billingSubscriptions, billingPayments, billingInvoices, billingAttempts, billingRefunds,
    ] = queryResults.map(result => result.data)

    const datasetCounts = {
        workers: workers?.length ?? 0,
        fixed_workers: fixedWorkers?.length ?? 0,
        machines: machines?.length ?? 0,
        production_logs: productionLogs?.length ?? 0,
        orders: orders?.length ?? 0,
        estimator_quotes: estimatorQuotes?.length ?? 0,
        estimator_templates: estimatorTemplates?.length ?? 0,
        billing_profiles: billingProfiles?.length ?? 0,
        subscription_history: billingSubscriptions?.length ?? 0,
        subscription_payments: billingPayments?.length ?? 0,
        billing_invoices: billingInvoices?.length ?? 0,
        billing_checkout_attempts: billingAttempts?.length ?? 0,
        billing_payment_refunds: billingRefunds?.length ?? 0,
    }

    const exportPayload = {
        exported_at: exportedAt,
        filename,
        schema_version: 'sprint4-v1',
        export_scope: 'current_owner_org',
        dataset_counts: datasetCounts,
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
        billing_profile: billingProfiles?.[0] ? redactSensitiveFields(billingProfiles[0] as ExportRecord) : null,
        subscription_history: redactRows(billingSubscriptions as ExportRecord[] | null),
        subscription_payments: redactRows(billingPayments as ExportRecord[] | null),
        billing_invoices: redactRows(billingInvoices as ExportRecord[] | null),
        billing_checkout_attempts: redactRows(billingAttempts as ExportRecord[] | null),
        billing_payment_refunds: redactRows(billingRefunds as ExportRecord[] | null),
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

    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(exportPayload)).digest('hex')
    const { data: exportRun, error: exportRunError } = await supabase
        .from('organization_export_runs')
        .insert({
            org_id: orgId,
            actor_id: user.id,
            status: 'generated',
            filename,
            schema_version: 'sprint4-v1',
            exported_at: exportedAt,
            dataset_counts: datasetCounts,
            payload_hash: payloadHash,
        })
        .select('id, status, exported_at, filename, schema_version, dataset_counts, payload_hash')
        .single()

    if (exportRunError || !exportRun) {
        console.error('Failed to persist organization export run:', exportRunError?.message)
        const reason = 'Data export could not be recorded. No download was generated; please try again.'
        await persistFailedExportRun(supabase, { orgId, actorId: user.id, filename, exportedAt, reason })
        throw new Error(reason)
    }

    const { error: auditError } = await supabase.rpc('log_export_event', {
        p_org_id: orgId,
        p_table_name: 'owner_data_export',
        p_record_id: exportRun.id,
        p_description: `Owner organization data export generated at ${exportedAt}; filename ${filename}; run ${exportRun.id}`,
        p_actor_id: user.id,
    })

    if (auditError) {
        await supabase.from('organization_export_runs').delete().eq('id', exportRun.id).eq('org_id', orgId)
        console.error('Failed to audit organization export:', auditError.message)
        throw new Error('Data export could not be audited. No download was generated; please try again.')
    }

    return {
        ...exportPayload,
        export_run: {
            ...exportRun,
            actor_name: profile.full_name ?? 'Owner',
        },
    }
}

export async function getOrganizationExportHistory(limit = 10) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createServerClient()
    const boundedLimit = Math.min(Math.max(limit, 1), 50)
    const { data: runs, error: runsError } = await supabase
        .from('organization_export_runs')
        .select('id, actor_id, status, filename, schema_version, exported_at, created_at')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(boundedLimit)

    if (!runsError && runs && runs.length > 0) {
        return {
            data: runs.map(run => ({
                changed_at: run.exported_at,
                record_id: run.id,
                actor_name: run.actor_id === profile.org_id ? 'Owner' : 'Owner',
                status: run.status as 'generated' | 'failed',
                description: run.status === 'generated'
                    ? `Export generated; filename ${run.filename}`
                    : `Export failed; filename ${run.filename}`,
            } satisfies OrganizationExportHistoryItem)),
        }
    }

    // Keep legacy audit history visible for exports created before the durable
    // run ledger was introduced, while all new exports use organization_export_runs.
    const { data, error } = await supabase
        .from('audit_log')
        .select('changed_at, record_id, new_data, changed_by, profiles!audit_log_changed_by_fkey(full_name)')
        .eq('org_id', profile.org_id)
        .eq('table_name', 'owner_data_export')
        .eq('action', 'EXPORT')
        .order('changed_at', { ascending: false })
        .limit(boundedLimit)

    if (error) {
        console.error('Organization export history query failed', { code: error.code })
        return { error: 'Export history could not be loaded. Try again.' }
    }

    return {
        data: (data ?? []).map(row => {
            const typedRow = row as unknown as {
                changed_at: string
                record_id: string | null
                new_data?: { description?: unknown } | null
                profiles?: { full_name?: string } | { full_name?: string }[] | null
            }
            const profile = Array.isArray(typedRow.profiles) ? typedRow.profiles[0] : typedRow.profiles
            return {
                changed_at: typedRow.changed_at,
                record_id: typedRow.record_id,
                actor_name: profile?.full_name ?? 'Owner',
                status: 'generated' as const,
                description: typeof typedRow.new_data?.description === 'string'
                    ? typedRow.new_data.description
                    : 'Organization data export generated',
            } satisfies OrganizationExportHistoryItem
        }),
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
