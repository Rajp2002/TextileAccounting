import 'server-only'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminError } from './errors'
import { requireFounder, adminRecordAudit, type FounderPrincipal } from './founder'
import { ADMIN_METRIC_VERSION, ADMIN_REPORTING_ZONE, FACTORY_COVERAGE, REPORTING_COHORTS, countReportingCohorts, factoryFiltersSchema, summarizeFactories, toFactoryRow, type FactorySource, type FactorySummary, type SourceCoverage } from './metrics'
import { decodeFactoryCursor, paginateFactories } from './factory-pagination'

const instant = z.string().refine(value => Number.isFinite(Date.parse(value))).transform(value => new Date(value).toISOString())
const sourceSchema = z.object({
    id: z.uuid(), name: z.string().max(240), created_at: instant, cohort: z.enum(REPORTING_COHORTS),
    is_locked_down: z.boolean(), owner_revoked: z.boolean(), verified_email: z.string().nullable(),
    owner_name: z.string().max(240).nullable().optional().default(null), owner_phone: z.string().max(40).nullable().optional().default(null),
    subscriptions: z.array(z.object({
        id: z.uuid(), status: z.string(), plan_tier: z.string().nullable(), current_start: instant.nullable(),
        current_end: instant.nullable(), razorpay_payment_id: z.string().nullable(), created_at: instant.nullable(), payment_evidenced: z.boolean(),
        is_trial: z.boolean().optional().default(false),
    })).max(1000).nullable(), has_free_grant: z.boolean().nullable(), free_subject_id: z.uuid().nullable(),
    estimator_at: instant.nullable(), production_at: instant.nullable(), last_outcome_at: instant.nullable(),
    open_tickets: z.number().int().nonnegative(),
})
const snapshotSchema = z.object({ asOf: instant, rows: z.array(sourceSchema).max(10000) })

async function snapshot(principal: FounderPrincipal, asOf: string, orgId: string | null = null, search = ''): Promise<FactorySource[]> {
    const { data, error } = await createAdminClient().rpc('admin_factory_snapshot', {
        p_actor_id: principal.userId, p_session_id: principal.sessionId, p_as_of: asOf, p_org_id: orgId, p_search: search,
    })
    const parsed = snapshotSchema.safeParse(data)
    if (error || !parsed.success) throw new AdminError('FACTORY_SOURCE_UNAVAILABLE', 503, 'Factory reporting is unavailable. Counts have not been substituted with zero.')
    return parsed.data.rows
}

/** Every public data loader rechecks live founder authorization and records access. */
export async function getFactorySummary(): Promise<FactorySummary> {
    const principal = await requireFounder()
    const requestId = randomUUID(), asOf = new Date().toISOString()
    const sources = await snapshot(principal, asOf)
    const result = summarizeFactories(sources, asOf)
    await adminRecordAudit(principal, 'factories.summary.read', 'factory_population', 'snapshot', requestId)
    return result
}

export async function listFactories(input: unknown = {}) {
    const principal = await requireFounder()
    const parsed = factoryFiltersSchema.safeParse(input)
    if (!parsed.success) throw new AdminError('VALIDATION', 400, 'Check the factory filters.', z.flattenError(parsed.error).fieldErrors)
    const filters = parsed.data
    let cursor: ReturnType<typeof decodeFactoryCursor>
    try { cursor = decodeFactoryCursor(filters) }
    catch { throw new AdminError('VALIDATION', 400, 'This page cursor is invalid or expired. Start a new search.') }
    const asOf = cursor?.asOf ?? new Date().toISOString(), requestId = randomUUID()
    const sources = await snapshot(principal, asOf, null, filters.search)
    const page = paginateFactories(sources.map(source => toFactoryRow(source, asOf)), filters, asOf)
    await adminRecordAudit(principal, 'factories.list.read', 'factory_population', 'snapshot', requestId)
    return { ...page, classificationCounts: countReportingCohorts(sources), classificationScope: 'search_population_before_access_filters' as const, filters: { ...filters, cursor: undefined }, asOf, definitionVersion: ADMIN_METRIC_VERSION, reportingZone: ADMIN_REPORTING_ZONE, coverage: FACTORY_COVERAGE }
}

export type AccountQuota = {
    scope: 'owner_account'; subjectId: string; sharedFactoryGrants: number; state: 'active' | 'pending' | 'suspended'
    used: number; allowance: number; periodStart: string; resetsAt: string; reportingZone: string; policyVersion: number; recalculationWindowMinutes: number
}
const quotaSchema = z.object({
    scope: z.literal('owner_account'), subjectId: z.uuid(), sharedFactoryGrants: z.number().int().nonnegative(),
    state: z.enum(['active', 'pending', 'suspended']), used: z.number().int().nonnegative(), allowance: z.number().int().positive(),
    periodStart: instant, resetsAt: instant, reportingZone: z.literal('Asia/Kolkata'), policyVersion: z.number().int().positive(), recalculationWindowMinutes: z.literal(30),
})
export async function getFactoryDetail(orgId: string) {
    const principal = await requireFounder()
    if (!z.uuid().safeParse(orgId).success) throw new AdminError('VALIDATION', 400, 'Invalid factory reference.')
    const asOf = new Date().toISOString(), requestId = randomUUID()
    const sources = await snapshot(principal, asOf, orgId)
    const source = sources[0]
    if (!source) throw new AdminError('NOT_FOUND', 404, 'Factory not found.')
    const admin = createAdminClient()
    const [quota, payments, support] = await Promise.all([
        admin.rpc('admin_factory_account_quota', { p_actor_id: principal.userId, p_session_id: principal.sessionId, p_org_id: orgId, p_as_of: asOf }),
        admin.from('subscription_payments').select('id,razorpay_payment_id,razorpay_order_id,status,created_at').eq('org_id', orgId).lte('created_at', asOf).order('created_at', { ascending: false }).order('id').limit(25),
        admin.from('support_tickets').select('id,subject,status,updated_at').eq('org_id', orgId).order('updated_at', { ascending: false }).order('id').limit(5),
    ])
    const parsedQuota = quota.data === null ? null : quotaSchema.safeParse(quota.data)
    const coverage: SourceCoverage[] = [...FACTORY_COVERAGE]
    if (quota.error || (parsedQuota && !parsedQuota.success)) coverage.push({ source: 'Free shared account quota', state: 'unavailable', detail: 'Quota source unavailable; used and remaining credits are not inferred.' })
    if (payments.error) coverage.push({ source: 'payment references', state: 'unavailable', detail: 'Payment references are unavailable.' })
    else coverage.push({ source: 'payment references', state: 'partial', detail: 'Most recent 25 local payment references; provenance and processing coverage belong in Payments.' })
    if (support.error) coverage.push({ source: 'support references', state: 'unavailable', detail: 'Recent support references are unavailable.' })
    await adminRecordAudit(principal, 'factories.detail.read', 'organization', orgId, requestId)
    return {
        ...toFactoryRow(source, asOf), asOf, definitionVersion: ADMIN_METRIC_VERSION, reportingZone: ADMIN_REPORTING_ZONE,
        contact: { verifiedOwnerEmail: source.verified_email, ownerName: source.owner_name ?? null, ownerPhone: source.owner_phone ?? null },
        quota: !quota.error && parsedQuota?.success ? parsedQuota.data as AccountQuota : null,
        quotaState: quota.error || (parsedQuota && !parsedQuota.success) ? 'unavailable' as const : parsedQuota ? 'observed' as const : 'not_applicable' as const,
        termHistory: source.subscriptions?.slice(-20).reverse().map(term => ({ id: term.id, tier: term.plan_tier, status: term.status, startsAt: term.current_start, endsAt: term.current_end, paymentReference: term.razorpay_payment_id, isTrial: term.is_trial === true })) ?? null,
        paymentReferences: payments.error ? null : (payments.data ?? []).map(payment => ({ id: payment.id, paymentReference: payment.razorpay_payment_id, orderReference: payment.razorpay_order_id, localState: payment.status, recordedAt: payment.created_at })),
        support: support.error ? null : (support.data ?? []).map(ticket => ({ id: ticket.id, subject: ticket.subject, status: ticket.status, updatedAt: ticket.updated_at })),
        coverage,
    }
}

/** A safe worksheet only. The console contains no classification mutation. */
export async function getClassificationDryRun() {
    const principal = await requireFounder()
    const asOf = new Date().toISOString(), requestId = randomUUID()
    const sources = await snapshot(principal, asOf)
    await adminRecordAudit(principal, 'factories.classification.dry_run', 'factory_population', 'snapshot', requestId)
    return { asOf, total: sources.length, cohorts: summarizeFactories(sources, asOf).cohorts,
        unclassified: sources.filter(source => source.cohort === 'unclassified').map(source => ({ id: source.id, name: source.name, joinedAt: source.created_at, proposedCohort: null, evidenceRequired: 'Explicit founder-reviewed business evidence; no email/payment-ID heuristic.' })), writesPerformed: 0 }
}
