import { z } from 'zod'
import { hasEstablishedPaidHistory, hasPaidBaseHistory, resolveEffectiveSubscription, resolveOrgPlanAccess, type SubscriptionTier } from '@/lib/subscription-access'

export const ADMIN_METRIC_VERSION = '2026-10-04.v1'
export const ADMIN_REPORTING_ZONE = 'Asia/Kolkata'
export const REPORTING_COHORTS = ['production', 'test', 'demo', 'internal', 'unclassified'] as const
export type ReportingCohort = typeof REPORTING_COHORTS[number]
export type ReportingPlan = SubscriptionTier | 'unknown'
export type SourceCoverage = { source: string; state: 'complete' | 'partial' | 'unavailable'; detail: string }

export type SubscriptionInput = {
    id: string; status: string; plan_tier: string | null; current_start: string | null
    current_end: string | null; razorpay_payment_id: string | null; created_at: string | null
    payment_evidenced?: boolean
    /** A Lite trial: no grace, never paid history, never a paid term. */
    is_trial?: boolean
}
export type PaidTerm = { id: string; tier: 'lite' | 'base'; startsAt: string | null; endsAt: string | null; paymentReference: string; renewal: 'manual_annual' }
export type FactoryAccess = { effectivePlan: ReportingPlan; subscriptionTier: ReportingPlan; currentPaidTerm: PaidTerm | null; explanation: string }

/** Reporting composes the customer resolver rather than redefining access rules.
 * Payment linkage is separate evidence: an access-bearing status is not a receipt. */
export function resolveFactoryAccess(rows: SubscriptionInput[] | null, hasFreeGrant: boolean | null, asOf: string): FactoryAccess {
    if (!rows) return { effectivePlan: 'unknown', subscriptionTier: 'unknown', currentPaidTerm: null, explanation: 'Entitlement source unavailable.' }
    const now = Date.parse(asOf)
    if (!Number.isFinite(now)) throw new Error('Invalid snapshot time')
    const current = resolveEffectiveSubscription(rows, now)
    const access = resolveOrgPlanAccess(current.tier, current.tier === 'none' && hasPaidBaseHistory(rows, now))
    let effectivePlan: ReportingPlan = access.effectiveTier
    if (effectivePlan === 'none' && !hasEstablishedPaidHistory(rows)) {
        if (hasFreeGrant === null) effectivePlan = 'unknown'
        else if (hasFreeGrant) effectivePlan = 'free'
    }
    const evidenced = resolveEffectiveSubscription(rows.filter(row => row.is_trial !== true && row.payment_evidenced === true && Boolean(row.razorpay_payment_id)
        && Boolean(row.current_start) && Boolean(row.current_end)), now)
    const paid = evidenced.subscription
    const currentPaidTerm: PaidTerm | null = paid && (evidenced.tier === 'lite' || evidenced.tier === 'base') ? {
        id: paid.id, tier: evidenced.tier, startsAt: paid.current_start, endsAt: paid.current_end,
        paymentReference: paid.razorpay_payment_id!, renewal: 'manual_annual',
    } : null
    return {
        effectivePlan, subscriptionTier: current.tier, currentPaidTerm,
        explanation: effectivePlan === 'unknown' ? 'Explicit Free grant source unavailable.'
            : current.tier === 'none' && effectivePlan === 'lite' ? 'Annual Base term expired; Lite access remains.'
                : effectivePlan === 'free' ? 'Explicit Free account grant; quota is shared by the owner account.'
                    : effectivePlan === 'none' ? 'No current entitlement or applicable explicit Free grant.'
                        : `${effectivePlan === 'base' ? 'Base' : 'Lite'} access resolved from all eligible terms, including the current grace policy.`,
    }
}

export type FactorySource = {
    id: string; name: string; created_at: string; cohort: ReportingCohort; is_locked_down: boolean
    owner_revoked: boolean; verified_email: string | null; subscriptions: SubscriptionInput[] | null
    has_free_grant: boolean | null; free_subject_id: string | null
    estimator_at: string | null; production_at: string | null; last_outcome_at: string | null
    open_tickets?: number | null
}
export type FactoryRow = {
    id: string; name: string; joinedAt: string; cohort: ReportingCohort; locked: boolean; ownerRevoked: boolean
    access: FactoryAccess; lastMeaningfulActivity: string | null
    activation: { estimatorAt: string | null; productionAt: string | null; coverage: 'partial' }
    openTickets: number | null; nextAttentionReason: string | null
}
export function toFactoryRow(source: FactorySource, asOf: string): FactoryRow {
    const access = resolveFactoryAccess(source.subscriptions, source.has_free_grant, asOf)
    return {
        id: source.id, name: source.name, joinedAt: source.created_at, cohort: source.cohort,
        locked: source.is_locked_down, ownerRevoked: source.owner_revoked, access,
        lastMeaningfulActivity: source.last_outcome_at,
        activation: { estimatorAt: source.estimator_at, productionAt: source.production_at, coverage: 'partial' },
        openTickets: source.open_tickets ?? null,
        nextAttentionReason: access.effectivePlan === 'unknown' ? 'Entitlement source needs review.'
            : source.owner_revoked ? 'Owner identity access revoked.' : source.is_locked_down ? 'Business writes locked; support remains separate.' : null,
    }
}

export const factoryFiltersSchema = z.object({
    search: z.string().trim().max(120).default(''),
    plan: z.enum(['all', 'none', 'free', 'lite', 'base', 'unknown']).default('all'),
    cohort: z.enum(['all', ...REPORTING_COHORTS]).default('production'),
    lifecycle: z.enum(['all', 'locked', 'revoked', 'unlocked']).default('all'),
    paidTerm: z.enum(['all', 'lite', 'base', 'expiring', 'no_evidenced_term']).default('all'),
    activation: z.enum(['all', 'estimator_observed', 'production_observed', 'not_observed']).default('all'),
    sort: z.enum(['joined_desc', 'name_asc']).default('joined_desc'),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(1600).optional(),
}).strict()
export type FactoryFilters = z.infer<typeof factoryFiltersSchema>

export function matchesFactory(row: FactoryRow, filters: FactoryFilters, asOf: string): boolean {
    const term = row.access.currentPaidTerm
    const end = term?.endsAt ? Date.parse(term.endsAt) : NaN
    const now = Date.parse(asOf)
    return (filters.cohort === 'all' || row.cohort === filters.cohort)
        && (filters.plan === 'all' || row.access.effectivePlan === filters.plan)
        && (filters.lifecycle === 'all' || (filters.lifecycle === 'locked' ? row.locked : filters.lifecycle === 'revoked' ? row.ownerRevoked : !row.locked))
        && (filters.paidTerm === 'all' || (filters.paidTerm === 'expiring' ? Boolean(term) && end >= now && end < now + 30 * 86_400_000
            : filters.paidTerm === 'no_evidenced_term' ? !term : term?.tier === filters.paidTerm))
        && (filters.activation === 'all' || (filters.activation === 'estimator_observed' ? Boolean(row.activation.estimatorAt)
            : filters.activation === 'production_observed' ? Boolean(row.activation.productionAt) : !row.activation.estimatorAt && !row.activation.productionAt))
}

export type FactorySummary = {
    asOf: string; definitionVersion: string; reportingZone: string; totalProductionFactories: number
    effectivePlans: Record<ReportingPlan, number>; currentPaidTerms: { lite: number; base: number }
    expiringPaidTerms: number; lockedFactories: number; revokedFactories: number
    cohorts: Record<ReportingCohort, number>; observedActiveFactories: { value: number; state: 'partial'; from: string; to: string }
    activation: { state: 'partial'; detail: string }; coverage: SourceCoverage[]
}
export const FACTORY_COVERAGE: SourceCoverage[] = [
    { source: 'organization population and reporting classification', state: 'complete', detail: 'Missing classification remains unclassified and is excluded from production totals.' },
    { source: 'persisted costing saves/revisions and positive production save receipts', state: 'partial', detail: 'Observed retained records only. Costing activation uses original creation; same-entry revisions only contribute activity. Production uses successful positive save-receipt time, never batch creation; earlier production without receipts is unobserved. Deletion, review, export and other workflows are not a complete historical event feed. No historical zero-fill or lapse score.' },
    { source: 'activation and retention cohorts', state: 'unavailable', detail: 'Full cohort observation windows and historical outcome coverage are not yet established.' },
    { source: 'current paid term counts', state: 'partial', detail: 'Verified live capture facts linked to source payment, factory, amount and plan only. Test and unknown payment history may grant effective access but do not count as verified paid terms. Complete historical provenance has not been established.' },
]
/** Classification describes the search population before access/status filters. */
export function countReportingCohorts(sources: FactorySource[]): Record<ReportingCohort, number> {
    const counts = Object.fromEntries(REPORTING_COHORTS.map(cohort => [cohort, 0])) as Record<ReportingCohort, number>
    for (const source of sources) counts[source.cohort]++
    return counts
}
export function summarizeFactories(sources: FactorySource[], asOf: string): FactorySummary {
    const cohorts = countReportingCohorts(sources)
    const effectivePlans = { none: 0, free: 0, lite: 0, base: 0, unknown: 0 }
    const currentPaidTerms = { lite: 0, base: 0 }
    let expiringPaidTerms = 0, lockedFactories = 0, revokedFactories = 0, observedActiveFactories = 0
    const now = Date.parse(asOf), from = new Date(now - 7 * 86_400_000).toISOString()
    for (const source of sources) {
        if (source.cohort !== 'production') continue
        const row = toFactoryRow(source, asOf)
        effectivePlans[row.access.effectivePlan]++
        const term = row.access.currentPaidTerm
        if (term) {
            currentPaidTerms[term.tier]++
            const end = term.endsAt ? Date.parse(term.endsAt) : NaN
            if (end >= now && end < now + 30 * 86_400_000) expiringPaidTerms++
        }
        if (row.locked) lockedFactories++
        if (row.ownerRevoked) revokedFactories++
        const latest = row.lastMeaningfulActivity ? Date.parse(row.lastMeaningfulActivity) : NaN
        if (latest >= Date.parse(from) && latest < now) observedActiveFactories++
    }
    return {
        asOf, definitionVersion: ADMIN_METRIC_VERSION, reportingZone: ADMIN_REPORTING_ZONE,
        totalProductionFactories: cohorts.production, effectivePlans, currentPaidTerms, expiringPaidTerms,
        lockedFactories, revokedFactories, cohorts, observedActiveFactories: { value: observedActiveFactories, state: 'partial', from, to: asOf },
        activation: { state: 'partial', detail: FACTORY_COVERAGE[1].detail },
        coverage: [...FACTORY_COVERAGE, ...(effectivePlans.unknown ? [{ source: 'effective entitlement', state: 'partial' as const, detail: `${effectivePlans.unknown} included factories could not resolve; unknown remains separate from no access.` }] : [])],
    }
}
