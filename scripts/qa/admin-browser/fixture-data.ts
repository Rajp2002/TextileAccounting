// Synthetic DTOs only. Real pure metrics/cursor logic is exercised here; the
// protected product DAL/Auth is never imported at runtime or weakened.
import { factoryFiltersSchema, summarizeFactories, toFactoryRow, countReportingCohorts, FACTORY_COVERAGE, ADMIN_METRIC_VERSION, ADMIN_REPORTING_ZONE, type FactorySource } from '../../../lib/admin/metrics'
import { decodeFactoryCursor, paginateFactories } from '../../../lib/admin/factory-pagination'
import { freeQuotaWindow } from '../../../lib/free-tier-policy'
const now = Date.now()
const at = (days: number) => new Date(now + days * 86_400_000).toISOString()
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`
export const FIXTURE_SOURCES: FactorySource[] = Array.from({ length: 35 }, (_, index) => {
    const n = index + 1
    const tier = n % 4 === 0 ? 'base' : n % 4 === 1 ? 'lite' : null
    return {
        id: id(n), name: n === 1 ? 'Saffron Weaving QA' : n === 2 ? 'Cotton Free Shared QA' : n === 3 ? 'Cotton Free Second Factory QA' : `Synthetic Weaving Factory ${String(n).padStart(2, '0')}`,
        created_at: at(-20), cohort: n <= 32 ? 'production' : n === 33 ? 'unclassified' : n === 34 ? 'test' : 'demo',
        is_locked_down: n === 4, owner_revoked: n === 8, verified_email: n === 1 ? 'synthetic-contact@example.test' : null,
        subscriptions: n === 7 ? null : tier ? [{ id: id(100 + n), status: 'active', plan_tier: tier, current_start: at(-20), current_end: at(20), razorpay_payment_id: `pay_synthetic_${n}`, created_at: at(-20), payment_evidenced: n === 1 }] : [],
        has_free_grant: n === 2 || n === 3, free_subject_id: n === 2 || n === 3 ? id(90) : null,
        estimator_at: n === 1 || n === 2 ? at(-10) : null, production_at: n === 1 ? at(-8) : null,
        last_outcome_at: n === 1 || n === 2 ? at(-1) : null, open_tickets: n === 1 ? 2 : 0,
    }
})
function scenario(input: unknown) {
    const { scenario: variant, ...filters } = (input ?? {}) as Record<string, unknown>
    if (variant === 'unavailable') throw new Error('Synthetic unavailable source')
    return filters
}
export async function listFactories(input: unknown) {
    const filters = factoryFiltersSchema.parse(scenario(input))
    const asOf = decodeFactoryCursor(filters)?.asOf ?? new Date().toISOString()
    const search = filters.search.toLowerCase()
    const sources = FIXTURE_SOURCES.filter(source => source.name.toLowerCase().includes(search) || source.id === filters.search || source.verified_email?.toLowerCase().includes(search) || source.subscriptions?.some(term => term.razorpay_payment_id === filters.search))
    return { ...paginateFactories(sources.map(source => toFactoryRow(source, asOf)), filters, asOf), classificationCounts: countReportingCohorts(sources), classificationScope: 'search_population_before_access_filters' as const, filters: { ...filters, cursor: undefined }, asOf, definitionVersion: ADMIN_METRIC_VERSION, reportingZone: ADMIN_REPORTING_ZONE, coverage: FACTORY_COVERAGE }
}
export async function getFactorySummary() { return summarizeFactories(FIXTURE_SOURCES, new Date().toISOString()) }
export async function getFactoryDetail(orgId: string) {
    const source = FIXTURE_SOURCES.find(source => source.id === orgId)
    if (!source) throw new Error('Synthetic unknown factory')
    const asOf = new Date().toISOString()
    const quotaWindow = freeQuotaWindow(new Date(asOf))
    return {
        ...toFactoryRow(source, asOf), asOf, definitionVersion: ADMIN_METRIC_VERSION, reportingZone: ADMIN_REPORTING_ZONE,
        contact: { verifiedOwnerEmail: source.verified_email },
        quota: source.has_free_grant ? { scope: 'owner_account', subjectId: id(90), sharedFactoryGrants: 2, state: 'active', used: 1, allowance: 2, periodStart: quotaWindow.start, resetsAt: quotaWindow.end, reportingZone: ADMIN_REPORTING_ZONE, policyVersion: 2, recalculationWindowMinutes: 30 } : null,
        quotaState: source.has_free_grant ? 'observed' : 'not_applicable',
        termHistory: source.subscriptions?.map(term => ({ id: term.id, tier: term.plan_tier, status: term.status, startsAt: term.current_start, endsAt: term.current_end, paymentReference: term.razorpay_payment_id })) ?? null,
        paymentReferences: source.subscriptions?.map(term => ({ id: term.id, paymentReference: term.razorpay_payment_id, orderReference: `order_synthetic_${source.id}`, localState: 'captured', recordedAt: at(-20) })) ?? [],
        support: source.id === id(1) ? [{ id: id(200), subject: 'Synthetic costing question', status: 'waiting_on_customer', updatedAt: at(-1) }] : [], coverage: FACTORY_COVERAGE,
    }
}
