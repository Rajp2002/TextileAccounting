'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOrgExportReader, EXPORT_PAGE_SIZE, exportRecordIds, type ExportQueryResult, type ExportRecord } from '@/lib/org-export-reads'
import { requireRetainedArchiveOwner } from '@/lib/retained-archive-owner'
import { UX012_DISTINCTIONS, UX012_EXPORT_LABELS, UX012_PRIORITY_HELPERS, UX012_TERMS } from '@/lib/terminology'
import crypto from 'crypto'
import { readOwnSupportExport } from '@/lib/support/data-rights'

const REDACTED = '[REDACTED]'
const SENSITIVE_EXPORT_FIELD_NAMES = new Set([
    'access_code_hash',
    'authorization',
    'client_ip',
    'cookie',
    'esi_number',
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

const OWNER_ARCHIVE_READ_GRANT_MIGRATION = '20261013120000_owner_archive_service_role_reads.sql'

const EXPORT_SCHEMA_MIGRATION_BY_DATASET: Record<string, string> = {
    legal_document_acceptances: '20260823203156_record_signup_legal_acceptance.sql',
    referral_year_credits: '20260810182342_referral_year_credits.sql',
    organization_export_runs: '20260801162646_20260801143840_sprint4_billing_trust_boundaries.sql',
    base_production_workers: '20260829090000_base_production_core.sql',
    base_production_jobs: '20260829090000_base_production_core.sql',
    base_production_entries: '20260829090000_base_production_core.sql',
    base_worker_advances: '20260829090000_base_production_core.sql',
    base_payroll_settlements: '20260829090000_base_production_core.sql',
    // These five revoked every service_role privilege when they were created;
    // the archive's service-role reads need this grant.
    base_production_batch_revisions: OWNER_ARCHIVE_READ_GRANT_MIGRATION,
    base_payroll_reversals: OWNER_ARCHIVE_READ_GRANT_MIGRATION,
    base_payroll_advance_recoveries: OWNER_ARCHIVE_READ_GRANT_MIGRATION,
    base_worker_incentives: OWNER_ARCHIVE_READ_GRANT_MIGRATION,
    factory_supervisors: OWNER_ARCHIVE_READ_GRANT_MIGRATION,
}

const POSTGREST_SCHEMA_COMPATIBILITY_ERROR_CODES = new Set([
    '42P01', // undefined_table
    '42703', // undefined_column
    'PGRST204', // column not found in schema cache
    'PGRST205', // table not found in schema cache
])

// Deliberately left out of the archive, and named in it so "complete" is
// checkable. Every other organization-scoped table is in the catalog.
const EXPORT_EXCLUDED_SOURCES = [
    { tables: ['supervisor_join_codes'], reason: 'The live code a supervisor uses to join the factory. It is an access credential, not a record.' },
    { tables: ['estimator_costing_attestations'], reason: 'Ten-minute server checks used while a costing is saved. The saved costings are in estimator_quotes.' },
    { tables: ['base_production_save_receipts', 'base_payroll_payment_requests'], reason: 'Request replay records. The production and payments they saved are in the production and payroll datasets.' },
    { tables: ['free_account_subjects', 'free_monthly_usage', 'free_calculation_receipts', 'free_costing_recalculation_receipts', 'free_funnel_events'], reason: 'Free plan sign-in, allowance and replay records kept per sign-in account, not per organization. Completed Free costings are in free_saved_costings.' },
    { tables: ['document branding logo files'], reason: 'Logo image files stay in storage. Their details are in document_branding_logo_assets.' },
]

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
                schema_version: 'base-legal-v1',
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

function exportSchemaReadinessError(datasetKey: string, error: unknown): string | null {
    const candidate = (error && typeof error === 'object')
        ? error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }
        : {}
    const code = typeof candidate.code === 'string' ? candidate.code : ''
    const description = [candidate.message, candidate.details, candidate.hint]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase()
    const looksLikeSchemaMismatch = POSTGREST_SCHEMA_COMPATIBILITY_ERROR_CODES.has(code)
        || /schema cache|relation .* does not exist|column .* does not exist|could not find the (table|column)/i.test(description)
        // A table still missing its service_role read grant.
        || (code === '42501' && EXPORT_SCHEMA_MIGRATION_BY_DATASET[datasetKey] === OWNER_ARCHIVE_READ_GRANT_MIGRATION)
    if (!looksLikeSchemaMismatch) return null

    const migration = EXPORT_SCHEMA_MIGRATION_BY_DATASET[datasetKey]
    const migrationInstruction = migration
        ? `Apply ${migration}`
        : 'Apply the reviewed production migrations'
    console.error(`Organization export schema mismatch for ${datasetKey}. ${migrationInstruction}, then run NOTIFY pgrst, 'reload schema'.`)
    return 'Your data export is not available right now. Please try again later or contact Weavly support.'
}

/**
 * Export all organization data as a structured JSON object.
 * DPDP Act 2023 — Right to Access (Section 11)
 */
export async function exportOrganizationData() {
    const { user, profile } = await requireRetainedArchiveOwner()
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
    // LT07: every dataset is read in pages ordered by its key until an empty
    // page, so a table larger than the server's row cap is never cut short.
    // The paged, tenant-scoped reads live in lib/org-export-reads.ts so the
    // accountant CSV downloads read the same way.
    const { readByKey, scoped, readOrderedPages, readByParentIds } = createOrgExportReader(supabase, orgId)

    // machine_assignments was introduced before org_id was denormalized. Use
    // the organization's machine IDs as a second boundary so legacy rows with
    // a null org_id are still exported without reading another tenant.
    const queryMachineAssignments = async (): Promise<ExportQueryResult> => {
        const { data: machines, error: machineQueryError } = await scoped('machines')()
        if (machineQueryError) return { data: null, error: machineQueryError }
        return readByParentIds('machine_assignments', 'machine_id', exportRecordIds(machines))
    }

    const queryReferralUsesAsReferrer = async (): Promise<ExportQueryResult> => {
        const { data: referralCodes, error: referralCodeError } = await scoped('referral_codes')()
        if (referralCodeError) return { data: null, error: referralCodeError }
        return readByParentIds('referral_uses', 'referral_code_id', exportRecordIds(referralCodes))
    }

    const datasetDefinitions = [
        { key: 'organization', query: scoped('organizations', 'id') },
        { key: 'profiles', query: scoped('profiles') },
        { key: 'workers', query: scoped('workers') },
        { key: 'base_production_workers', query: scoped('base_production_workers') },
        { key: 'fixed_workers', query: scoped('fixed_workers') },
        { key: 'machines', query: scoped('machines') },
        { key: 'machine_assignments', query: queryMachineAssignments },
        { key: 'shift_assignments', query: scoped('shift_assignments') },
        { key: 'production_logs', query: scoped('production_logs') },
        { key: 'base_production_jobs', query: scoped('base_production_jobs') },
        { key: 'base_production_entries', query: scoped('base_production_entries') },
        // Machine-first production, as the current daily sheet and the
        // supervisor's metres-only sheet write it.
        { key: 'base_production_machines', query: scoped('base_production_machines') },
        { key: 'base_worker_machine_assignments', query: scoped('base_worker_machine_assignments') },
        { key: 'base_machine_job_contexts', query: scoped('base_machine_job_contexts') },
        { key: 'base_production_batches', query: scoped('base_production_batches') },
        { key: 'base_production_batch_revisions', query: scoped('base_production_batch_revisions') },
        { key: 'base_daily_production_entries', query: scoped('base_daily_production_entries') },
        { key: 'base_daily_production_allocations', query: scoped('base_daily_production_allocations') },
        { key: 'factory_supervisors', query: scoped('factory_supervisors', 'org_id', 'user_id') },
        { key: 'daily_brief_logs', query: scoped('daily_brief_logs') },
        { key: 'attendance', query: scoped('attendance') },
        { key: 'payroll_payments', query: scoped('payroll_payments') },
        { key: 'payroll_settlements', query: scoped('payroll_settlements') },
        { key: 'payroll_configs', query: scoped('payroll_configs', 'org_id', 'org_id') },
        { key: 'payroll_adjustment_categories', query: scoped('payroll_adjustment_categories') },
        { key: 'payroll_adjustments', query: scoped('payroll_adjustments') },
        { key: 'worker_advances', query: scoped('worker_advances') },
        { key: 'base_worker_advances', query: scoped('base_worker_advances') },
        { key: 'base_payroll_settlements', query: scoped('base_payroll_settlements') },
        { key: 'base_payroll_settlement_lines', query: scoped('base_payroll_settlement_lines') },
        { key: 'base_payroll_reversals', query: scoped('base_payroll_reversals', 'org_id', 'settlement_id') },
        // Keyed by (settlement_id, advance_id); written only when a payment
        // is recorded or reversed.
        { key: 'base_payroll_advance_recoveries', query: () => readOrderedPages('base_payroll_advance_recoveries', ['settlement_id', 'advance_id']) },
        { key: 'base_payroll_periods', query: scoped('base_payroll_periods') },
        { key: 'base_payroll_cycle_configs', query: scoped('base_payroll_cycle_configs') },
        { key: 'base_worker_incentives', query: scoped('base_worker_incentives') },
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
        // Completed Free costings kept after an upgrade or expiry.
        { key: 'free_saved_costings', query: scoped('free_saved_costings') },
        { key: 'factory_cost_profile', query: scoped('factory_cost_profile', 'factory_id') },
        { key: 'document_branding_settings', query: scoped('document_branding_settings', 'org_id', 'org_id') },
        // Logo details only; the image files stay in storage.
        { key: 'document_branding_logo_assets', query: scoped('document_branding_logo_assets') },
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
        { key: 'quality_stock', query: scoped('quality_stock') },
        { key: 'quality_stock_movements', query: scoped('quality_stock_movements') },
        { key: 'quality_stock_cutover', query: scoped('quality_stock_cutover', 'org_id', 'org_id') },
        { key: 'yarn_stock_settings', query: scoped('yarn_stock_settings', 'org_id', 'org_id') },
        { key: 'yarn_stock', query: scoped('yarn_stock') },
        { key: 'yarn_stock_movements', query: scoped('yarn_stock_movements') },
        { key: 'yarn_stock_recipes', query: scoped('yarn_stock_recipes', 'org_id', 'quality_id') },
        { key: 'yarn_stock_requests', query: scoped('yarn_stock_requests') },
        { key: 'fabric_stock_lots', query: scoped('fabric_stock_lots') },
        { key: 'fabric_stock_sales', query: scoped('fabric_stock_sales') },
        { key: 'fabric_stock_movements', query: scoped('fabric_stock_movements') },
        { key: 'fabric_stock_inward_drafts', query: scoped('fabric_stock_inward_drafts') },
        { key: 'production_stock_lots', query: scoped('production_stock_lots') },
        { key: 'delivery_challans', query: scoped('delivery_challans') },
        { key: 'delivery_challan_events', query: scoped('delivery_challan_events') },
        { key: 'delivery_challan_lot_allocations', query: scoped('delivery_challan_lot_allocations') },
        { key: 'inventory_audits', query: scoped('inventory_audits') },
        { key: 'inventory_audit_lines', query: scoped('inventory_audit_lines') },
        { key: 'notification_consents', query: scoped('notification_consents') },
        { key: 'stock_discrepancies', query: scoped('stock_discrepancies') },
        { key: 'worker_consent_artifacts', query: scoped('worker_consent_artifacts') },
        { key: 'legal_document_acceptances', query: scoped('legal_document_acceptances') },
        { key: 'language_requests', query: scoped('language_requests') },
        // Operator privacy communications may concern a different requester in
        // the same factory. They require case review, rather than an org export.
        { key: 'grievances', query: () => readByKey('grievances', query => query.eq('org_id', profile.org_id).or('target_entity.neq.WEAVLY,grievance_type.neq.DATA_PRIVACY')) },
        { key: 'organization_dpas', query: scoped('organization_dpas') },
        { key: 'breach_reports', query: scoped('breach_reports') },
        { key: 'whatsapp_delivery_log', query: scoped('whatsapp_delivery_log') },
        // Composite key (org_id, alert_type, ref_id). Its writers were
        // unscheduled on 2026-10-01, so the table does not change during a read.
        { key: 'whatsapp_cooldowns', query: () => readOrderedPages('whatsapp_cooldowns', ['alert_type', 'ref_id']) },
        { key: 'referral_codes', query: scoped('referral_codes') },
        { key: 'referral_uses_as_referee', query: scoped('referral_uses', 'referee_org_id') },
        { key: 'referral_uses_as_referrer', query: queryReferralUsesAsReferrer },
        { key: 'referral_discount_windows', query: scoped('referral_discount_windows', 'referrer_org_id') },
        { key: 'referral_refunds', query: scoped('referral_refunds', 'referrer_org_id') },
        { key: 'referral_year_credits', query: scoped('referral_year_credits', 'referrer_org_id') },
        { key: 'audit_log', query: scoped('audit_log') },
        { key: 'organization_billing_profiles', query: scoped('organization_billing_profiles') },
        { key: 'org_subscriptions', query: scoped('org_subscriptions') },
        { key: 'subscription_payments', query: scoped('subscription_payments') },
        { key: 'billing_checkout_attempts', query: scoped('billing_checkout_attempts') },
        { key: 'billing_payment_refunds', query: scoped('billing_payment_refunds') },
        { key: 'billing_invoices', query: scoped('billing_invoices') },
        { key: 'free_account_grants', query: scoped('free_account_grants', 'org_id', 'org_id') },
        { key: 'plan_usage_events', query: scoped('plan_usage_events') },
        { key: 'web_vital_samples', query: () => readOrderedPages('web_vital_samples', ['metric_id', 'name']) },
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
        const reason = exportSchemaReadinessError(failedQuery.key, failedQuery.result.error)
            ?? 'The organization export is incomplete. No export was generated; please try again.'
        console.error('Organization export query failed', {
            dataset: failedQuery.key,
            code: failedQuery.result.error.code,
            message: failedQuery.result.error.message,
        })
        await persistFailedExportRun(supabase, { orgId, actorId: user.id, filename, exportedAt, reason })
        throw new Error(reason)
    }

    let publicSupport: Awaited<ReturnType<typeof readOwnSupportExport>>
    try {
        publicSupport = await readOwnSupportExport()
    } catch {
        const reason = 'Your public support export is unavailable or incomplete. No export was generated; please try again.'
        await persistFailedExportRun(supabase, { orgId, actorId: user.id, filename, exportedAt, reason })
        throw new Error(reason)
    }
    const datasets = Object.fromEntries(
        queryResults.map(({ key, result }) => [key, (result.data ?? []) as ExportRecord[]])
    ) as Record<string, ExportRecord[]>
    Object.assign(datasets, publicSupport.datasets)
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
        schema_version: 'base-legal-v1',
        export_scope: 'current_owner_org',
        dataset_counts: datasetCounts,
        dataset_catalog: [...datasetDefinitions.map(({ key }) => key), ...Object.keys(publicSupport.datasets)],
        support_scope: { unit: publicSupport.scope, as_of: publicSupport.asOf, excluded: ['other requesters', 'unbound manual tickets', 'internal notes', 'private references', 'idempotency records', 'founder audit'] },
        formal_scope: { excluded: ['Weavly privacy cases', 'security incidents', 'operator notes and audit'], access: 'Case-by-case identity and authority review through the published privacy contact.' },
        excluded_sources: EXPORT_EXCLUDED_SOURCES,
        completeness: {
            status: 'complete',
            page_size: EXPORT_PAGE_SIZE,
            method: 'Every dataset is read in pages ordered by its key until an empty page. Any failed page fails the export and no file is produced.',
            consistency: 'Datasets are read separately, each in pages, while the factory may keep working, so a change made during the export may or may not appear. This is not a point-in-time backup.',
        },
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
            schema_version: 'base-legal-v1',
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
        const reason = 'Your data export could not be prepared. Nothing was downloaded; please try again.'
        await persistFailedExportRun(supabase, { orgId, actorId: user.id, filename, exportedAt, reason })
        throw new Error('Your data export could not be prepared. Nothing was downloaded; please try again.')
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
    const { profile } = await requireRetainedArchiveOwner()
    const supabase = await createServerClient()
    const boundedLimit = Math.min(Math.max(limit, 1), 50)
    const { data: runs, error: runsError } = await supabase
        .from('organization_export_runs')
        .select('id, actor_id, status, filename, schema_version, exported_at, created_at')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(boundedLimit)

    if (runsError) {
        return {
            error: exportSchemaReadinessError('organization_export_runs', runsError)
                ?? 'Export history could not be loaded. Try again.',
        }
    }

    if (runs && runs.length > 0) {
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
