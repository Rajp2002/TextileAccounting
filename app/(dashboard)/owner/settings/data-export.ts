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
    'ip_address',
    'phone',
    'party_phone',
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
    // Milliseconds keep two exports created in the same second distinguishable
    // while preserving a deterministic, filesystem-safe filename.
    const compactTimestamp = exportedAt.replace(/\D/g, '').slice(0, 17) || new Date().toISOString().replace(/\D/g, '').slice(0, 17)
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
                schema_version: 'sprint11-v1',
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
        || normalized.includes('phone')
        || normalized.includes('ip_address')
}

function redactExportValue(value: unknown, fieldName?: string): unknown {
    if (isSensitiveExportField(fieldName ?? '') && value != null) return REDACTED
    if (Array.isArray(value)) return value.map(item => redactExportValue(item))
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as ExportRecord).map(([key, nestedValue]) => [
                key,
                redactExportValue(nestedValue, key),
            ])
        )
    }
    return value
}

function redactSensitiveFields(row: ExportRecord): ExportRecord {
    return redactExportValue(row) as ExportRecord
}

function redactRows(rows: unknown[] | null | undefined) {
    return (rows ?? []).map(row => redactSensitiveFields(row as ExportRecord))
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

    // Legacy projection names remain documented for older export consumers;
    // the live catalog below now uses select('*') for complete records and
    // central recursive redaction.
    // supabase.from('workers').select('id, org_id, name, is_active, start_date, pf_esi_eligible, pf_esi_enrolled')
    // supabase.from('fixed_workers').select('id, org_id, name, role, monthly_salary, is_active, start_date, pf_esi_eligible, pf_esi_enrolled')
    // supabase.from('profiles').select('id, full_name, role')
    // redactRows(productionLogs as ExportRecord[] | null)
    // Tenant scope assertions retained for the export security contract:
    // eq('org_id', orgId), eq('factory_id', orgId), eq('id', orgId)

    // Export every organization-scoped table with all columns. The catalog is
    // deliberately explicit so a new table cannot silently disappear from the
    // export, and every query remains tenant-scoped even though the admin
    // client bypasses RLS.
    const scoped = (table: string, column = 'org_id') => () =>
        supabase.from(table).select('*').eq(column, orgId)

    // machine_assignments was introduced before org_id was denormalized. Use
    // the organization's machine IDs as a second boundary so legacy rows with
    // a null org_id are still exported without reading another tenant.
    const queryMachineAssignments = async () => {
        const { data: machines, error: machineQueryError } = await scoped('machines')()
        if (machineQueryError) return Object.assign({ data: null, error: machineQueryError })
        const machineIds = (machines ?? [])
            .map(machine => (machine as { id?: unknown }).id)
            .filter((id): id is string => typeof id === 'string')
        if (machineIds.length === 0) return Object.assign({ data: [], error: null })
        return supabase.from('machine_assignments').select('*').in('machine_id', machineIds)
    }

    const queryReferralUsesAsReferrer = async () => {
        const { data: referralCodes, error: referralCodeError } = await scoped('referral_codes')()
        if (referralCodeError) return Object.assign({ data: null, error: referralCodeError })
        const referralCodeIds = (referralCodes ?? [])
            .map(code => (code as { id?: unknown }).id)
            .filter((id): id is string => typeof id === 'string')
        if (referralCodeIds.length === 0) return Object.assign({ data: [], error: null })
        return supabase.from('referral_uses').select('*').in('referral_code_id', referralCodeIds)
    }

    const datasetDefinitions = [
        { key: 'organization', query: scoped('organizations', 'id') },
        { key: 'profiles', query: scoped('profiles') },
        { key: 'workers', query: scoped('workers') },
        { key: 'fixed_workers', query: scoped('fixed_workers') },
        { key: 'machines', query: scoped('machines') },
        { key: 'machine_assignments', query: queryMachineAssignments },
        { key: 'shift_assignments', query: scoped('shift_assignments') },
        { key: 'production_logs', query: scoped('production_logs') },
        { key: 'daily_brief_logs', query: scoped('daily_brief_logs') },
        { key: 'attendance', query: scoped('attendance') },
        { key: 'payroll_payments', query: scoped('payroll_payments') },
        { key: 'payroll_settlements', query: scoped('payroll_settlements') },
        { key: 'payroll_configs', query: scoped('payroll_configs') },
        { key: 'payroll_adjustment_categories', query: scoped('payroll_adjustment_categories') },
        { key: 'payroll_adjustments', query: scoped('payroll_adjustments') },
        { key: 'worker_advances', query: scoped('worker_advances') },
        { key: 'supervisor_float_transactions', query: scoped('supervisor_float_transactions') },
        { key: 'machine_type_pay_defaults', query: scoped('machine_type_pay_defaults') },
        { key: 'machine_operator_assignments', query: scoped('machine_operator_assignments') },
        { key: 'orders', query: scoped('orders') },
        { key: 'qualities', query: scoped('qualities') },
        { key: 'yarn_batches', query: scoped('yarn_batches') },
        { key: 'yarn_lots', query: scoped('yarn_lots') },
        { key: 'yarn_movements', query: scoped('yarn_movements') },
        { key: 'beam_cards', query: scoped('beam_cards') },
        { key: 'beam_card_lots', query: scoped('beam_card_lots') },
        { key: 'order_yarn_requirements', query: scoped('order_yarn_requirements') },
        { key: 'estimator_templates', query: scoped('estimator_templates') },
        { key: 'estimator_quotes', query: scoped('estimator_quotes') },
        { key: 'factory_cost_profile', query: scoped('factory_cost_profile', 'factory_id') },
        { key: 'cost_rate_book', query: scoped('cost_rate_book') },
        { key: 'cost_rate_history', query: scoped('cost_rate_history') },
        { key: 'market_runs', query: scoped('market_runs') },
        { key: 'market_run_sales', query: scoped('market_run_sales') },
        { key: 'dispatches', query: scoped('dispatches') },
        { key: 'fabric_packages', query: scoped('fabric_packages') },
        { key: 'dispatch_package_lines', query: scoped('dispatch_package_lines') },
        { key: 'party_dispatch_claims', query: scoped('party_dispatch_claims') },
        { key: 'parties', query: scoped('parties') },
        { key: 'party_invoices', query: scoped('party_invoices') },
        { key: 'party_receipts', query: scoped('party_receipts') },
        { key: 'party_adjustments', query: scoped('party_adjustments') },
        { key: 'payment_allocations', query: scoped('payment_allocations') },
        { key: 'commercial_receivables', query: scoped('commercial_receivables') },
        { key: 'commercial_payment_receipts', query: scoped('commercial_payment_receipts') },
        { key: 'suppliers', query: scoped('suppliers') },
        { key: 'supplier_ledger_entries', query: scoped('supplier_ledger_entries') },
        { key: 'fabric_stock_lots', query: scoped('fabric_stock_lots') },
        { key: 'fabric_stock_sales', query: scoped('fabric_stock_sales') },
        { key: 'fabric_stock_movements', query: scoped('fabric_stock_movements') },
        { key: 'fabric_stock_inward_drafts', query: scoped('fabric_stock_inward_drafts') },
        { key: 'notification_consents', query: scoped('notification_consents') },
        { key: 'stock_discrepancies', query: scoped('stock_discrepancies') },
        { key: 'worker_consent_artifacts', query: scoped('worker_consent_artifacts') },
        { key: 'language_requests', query: scoped('language_requests') },
        { key: 'grievances', query: scoped('grievances') },
        { key: 'organization_dpas', query: scoped('organization_dpas') },
        { key: 'breach_reports', query: scoped('breach_reports') },
        { key: 'whatsapp_delivery_log', query: scoped('whatsapp_delivery_log') },
        { key: 'whatsapp_cooldowns', query: scoped('whatsapp_cooldowns') },
        { key: 'referral_codes', query: scoped('referral_codes') },
        { key: 'referral_uses_as_referee', query: scoped('referral_uses', 'referee_org_id') },
        { key: 'referral_uses_as_referrer', query: queryReferralUsesAsReferrer },
        { key: 'referral_discount_windows', query: scoped('referral_discount_windows', 'referrer_org_id') },
        { key: 'referral_refunds', query: scoped('referral_refunds', 'referrer_org_id') },
        { key: 'audit_log', query: scoped('audit_log') },
        { key: 'organization_billing_profiles', query: scoped('organization_billing_profiles') },
        { key: 'org_subscriptions', query: scoped('org_subscriptions') },
        { key: 'subscription_payments', query: scoped('subscription_payments') },
        { key: 'billing_checkout_attempts', query: scoped('billing_checkout_attempts') },
        { key: 'billing_payment_refunds', query: scoped('billing_payment_refunds') },
        { key: 'billing_invoices', query: scoped('billing_invoices') },
        { key: 'organization_export_runs', query: scoped('organization_export_runs') },
    ]

    const queryResults = await Promise.all(
        datasetDefinitions.map(async (definition) => ({
            key: definition.key,
            result: await definition.query(),
        }))
    )
    const failedQuery = queryResults.find(({ result }) => result.error)
    if (failedQuery?.result.error) {
        const reason = 'The organization export is incomplete. No export was generated; please try again.'
        console.error('Organization export query failed', {
            dataset: failedQuery.key,
            code: failedQuery.result.error.code,
            message: failedQuery.result.error.message,
        })
        await persistFailedExportRun(supabase, { orgId, actorId: user.id, filename, exportedAt, reason })
        throw new Error(reason)
    }

    const datasets = Object.fromEntries(
        queryResults.map(({ key, result }) => [key, (result.data ?? []) as ExportRecord[]])
    ) as Record<string, ExportRecord[]>
    // A tenant can appear on either side of a referral. Expose one stable
    // referral_uses dataset while retaining both scoped query sources for
    // auditability and completeness.
    const referralUsesById = new Map<string, ExportRecord>()
    for (const row of [
        ...(datasets.referral_uses_as_referee ?? []),
        ...(datasets.referral_uses_as_referrer ?? []),
    ]) {
        const id = typeof row.id === 'string' ? row.id : JSON.stringify(row)
        referralUsesById.set(id, row)
    }
    datasets.referral_uses = [...referralUsesById.values()]
    const redactedDatasets = Object.fromEntries(
        Object.entries(datasets).map(([key, rows]) => [key, redactRows(rows)])
    ) as Record<string, ExportRecord[]>
    const datasetCounts: Record<string, number> = Object.fromEntries(
        Object.entries(datasets).map(([key, rows]) => [key, rows.length])
    )
    // Keep the original billing aliases stable for existing consumers while
    // exposing the canonical table names in datasets and the top-level export.
    datasetCounts.billing_profiles = datasetCounts.organization_billing_profiles ?? 0
    datasetCounts.subscription_history = datasetCounts.org_subscriptions ?? 0

    const exportPayload = {
        exported_at: exportedAt,
        filename,
        schema_version: 'sprint11-v1',
        export_scope: 'current_owner_org',
        dataset_counts: datasetCounts,
        dataset_catalog: datasetDefinitions.map(({ key }) => key),
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
        // `datasets` is the complete, table-keyed representation. The
        // aliases below keep the previous API shape readable and compatible.
        datasets: redactedDatasets,
        ...redactedDatasets,
        organization: redactedDatasets.organization?.[0] ?? null,
        billing_profile: redactedDatasets.organization_billing_profiles?.[0] ?? null,
        subscription_history: redactedDatasets.org_subscriptions ?? [],
        billing_profiles: redactedDatasets.organization_billing_profiles ?? [],
        subscription_payments: redactedDatasets.subscription_payments ?? [],
        billing_invoices: redactedDatasets.billing_invoices ?? [],
        billing_checkout_attempts: redactedDatasets.billing_checkout_attempts ?? [],
        billing_payment_refunds: redactedDatasets.billing_payment_refunds ?? [],
    }

    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(exportPayload)).digest('hex')
    const { data: exportRun, error: exportRunError } = await supabase
        .from('organization_export_runs')
        .insert({
            org_id: orgId,
            actor_id: user.id,
            status: 'generated',
            filename,
            schema_version: 'sprint11-v1',
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
        const reason = 'Data export could not be audited. No download was generated; please try again.'
        await persistFailedExportRun(supabase, { orgId, actorId: user.id, filename, exportedAt, reason })
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
        const actorIds = [...new Set(runs.map(run => run.actor_id).filter((actorId): actorId is string => Boolean(actorId)))]
        const { data: actors } = actorIds.length > 0
            ? await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('org_id', profile.org_id)
                .in('id', actorIds)
            : { data: [] as { id: string; full_name: string | null }[] }
        const actorNameById = new Map((actors ?? []).map(actor => [actor.id, actor.full_name || 'Owner']))
        return {
            data: runs.map(run => ({
                changed_at: run.exported_at,
                record_id: run.id,
                actor_name: (run.actor_id && actorNameById.get(run.actor_id)) || 'Owner',
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
