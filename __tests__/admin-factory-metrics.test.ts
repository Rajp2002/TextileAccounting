import { describe, expect, it } from 'vitest'
import { countReportingCohorts, factoryFiltersSchema, resolveFactoryAccess, summarizeFactories, toFactoryRow, type FactorySource, type SubscriptionInput } from '@/lib/admin/metrics'
import { paginateFactories } from '@/lib/admin/factory-pagination'

const asOf = new Date().toISOString()
const time = Date.parse(asOf)
function term(overrides: Partial<SubscriptionInput> = {}): SubscriptionInput {
    return { id: '7b4e9cf1-51d7-4e57-9cf4-2b97730a34ac', status: 'active', plan_tier: 'base', current_start: new Date(time - 86_400_000).toISOString(), current_end: new Date(time + 10 * 86_400_000).toISOString(), razorpay_payment_id: 'pay_fixture', created_at: new Date(time - 86_400_000).toISOString(), payment_evidenced: true, ...overrides }
}
function factory(id = 'bf78d13f-5f8d-4b1d-8f9c-e07b027fcb21', overrides: Partial<FactorySource> = {}): FactorySource {
    return { id, name: 'Synthetic weaving works', created_at: new Date(time - 10 * 86_400_000).toISOString(), cohort: 'production', is_locked_down: false, owner_revoked: false, verified_email: null, subscriptions: [], has_free_grant: false, free_subject_id: null, estimator_at: null, production_at: null, last_outcome_at: null, open_tickets: 0, ...overrides }
}
describe('AD03 canonical factory access and honest metric definitions', () => {
    it('retains highest current term when a newer checkout fails and distinguishes evidence from access', () => {
        const rows = [term(), term({ id: 'late', status: 'created', plan_tier: 'lite', created_at: asOf, payment_evidenced: false })]
        expect(resolveFactoryAccess(rows, false, asOf)).toMatchObject({ effectivePlan: 'base', currentPaidTerm: { tier: 'base' } })
        expect(resolveFactoryAccess([term({ payment_evidenced: false })], false, asOf)).toMatchObject({ effectivePlan: 'base', currentPaidTerm: null })
        expect(resolveFactoryAccess([term({ current_end: null })], false, asOf)).toMatchObject({ effectivePlan: 'base', currentPaidTerm: null })
    })
    it('expired Base retains Lite without inflating paid Lite; expired paid Lite never becomes Free', () => {
        expect(resolveFactoryAccess([term({ status: 'expired', current_end: new Date(time - 2 * 86_400_000).toISOString() })], true, asOf)).toMatchObject({ effectivePlan: 'lite', subscriptionTier: 'none', currentPaidTerm: null })
        expect(resolveFactoryAccess([term({ status: 'expired', plan_tier: 'lite', current_end: new Date(time - 2 * 86_400_000).toISOString() })], true, asOf).effectivePlan).toBe('none')
    })
    it('missing subscription differs from explicit Free; missing source remains reporting unknown', () => {
        expect(resolveFactoryAccess([], false, asOf).effectivePlan).toBe('none')
        expect(resolveFactoryAccess([], true, asOf).effectivePlan).toBe('free')
        expect(resolveFactoryAccess(null, true, asOf).effectivePlan).toBe('unknown')
        expect(resolveFactoryAccess([], null, asOf).effectivePlan).toBe('unknown')
    })
    it('reuses exact grace boundary, excludes future terms and duplicate subscription rows do not inflate factory count', () => {
        const expired = term({ current_end: new Date(time - 86_400_000).toISOString() })
        expect(resolveFactoryAccess([expired], false, asOf).effectivePlan).toBe('base')
        expect(resolveFactoryAccess([term({ current_start: new Date(time + 1).toISOString() })], false, asOf).effectivePlan).toBe('none')
        expect(summarizeFactories([factory(undefined, { subscriptions: [term(), term()], is_locked_down: true, owner_revoked: true })], asOf)).toMatchObject({ totalProductionFactories: 1, effectivePlans: { base: 1 }, currentPaidTerms: { base: 1 }, lockedFactories: 1, revokedFactories: 1, expiringPaidTerms: 1 })
    })
    it('excludes all non-production classifications and known plus unknown buckets reconcile', () => {
        const sources = [factory(), factory('b', { subscriptions: null }), ...(['test', 'demo', 'internal', 'unclassified'] as const).map((cohort, i) => factory(`excluded-${i}`, { cohort, subscriptions: [term()] }))]
        const report = summarizeFactories(sources, asOf)
        expect(report.totalProductionFactories).toBe(2)
        expect(Object.values(report.effectivePlans).reduce((a, b) => a + b, 0)).toBe(2)
        expect(report.effectivePlans.unknown).toBe(1)
        expect(report.currentPaidTerms.base).toBe(0)
        expect(report.cohorts).toEqual({ production: 2, test: 1, demo: 1, internal: 1, unclassified: 1 })
    })
    it('healthy measured empty population is zero while history remains unavailable and outcome bounds are half-open', () => {
        const empty = summarizeFactories([], asOf)
        expect(empty.totalProductionFactories).toBe(0)
        expect(empty.coverage.find(coverage => coverage.source === 'activation and retention cohorts')?.state).toBe('unavailable')
        const report = summarizeFactories([factory('old', { last_outcome_at: new Date(time - 7 * 86_400_000).toISOString() }), factory('end', { last_outcome_at: asOf })], asOf)
        expect(report.observedActiveFactories.value).toBe(1)
        expect(report.observedActiveFactories.state).toBe('partial')
    })
    it('never exposes internal search contact or subscription rows from directory DTO', () => {
        const row = toFactoryRow(factory(undefined, { verified_email: 'synthetic@example.test', subscriptions: [term()] }), asOf)
        expect(row).not.toHaveProperty('verified_email')
        expect(row).not.toHaveProperty('subscriptions')
    })
    it('classification counts include the full search population before selected access/status filters', () => {
        const sources = [factory('a', { subscriptions: [term()] }), factory('b', { cohort: 'unclassified' }), factory('c', { cohort: 'test' })]
        expect(countReportingCohorts(sources)).toEqual({ production: 1, unclassified: 1, test: 1, demo: 0, internal: 0 })
        const filtered = paginateFactories(sources.map(source => toFactoryRow(source, asOf)), factoryFiltersSchema.parse({ plan: 'free' }), asOf)
        expect(filtered.totalMatching).toBe(0)
        expect(countReportingCohorts(sources).production).toBe(1)
    })
})
describe('AD04 bounded filtering and stable pagination', () => {
    it('allowlists and bounds filters, sort and limits', () => {
        for (const input of [{ limit: 0 }, { limit: 101 }, { sort: 'salary' }, { search: 'x'.repeat(121) }, { table: 'workers' }]) expect(factoryFiltersSchema.safeParse(input).success).toBe(false)
        expect(factoryFiltersSchema.parse({}).cohort).toBe('production')
    })
    it('equal-timestamp pages have stable ID ordering and exact matching counts', () => {
        const rows = [3, 1, 2].map(value => toFactoryRow(factory(`00000000-0000-4000-8000-${String(value).padStart(12, '0')}`), asOf))
        const filters = factoryFiltersSchema.parse({ limit: 1 })
        const first = paginateFactories(rows, filters, asOf)
        const second = paginateFactories(rows, { ...filters, cursor: first.nextCursor! }, asOf)
        const third = paginateFactories(rows, { ...filters, cursor: second.nextCursor! }, asOf)
        expect([first.items[0].id, second.items[0].id, third.items[0].id]).toEqual([...rows.map(row => row.id)].sort())
        expect(first.totalMatching).toBe(3)
        expect(third.nextCursor).toBeNull()
        expect(() => paginateFactories(rows, { ...filters, plan: 'base', cursor: first.nextCursor! }, asOf)).toThrow('INVALID_FACTORY_CURSOR')
    })
    it('drilldowns reproduce canonical access and separate paid, locked and observed activation states', () => {
        const rows = [toFactoryRow(factory('a', { subscriptions: [term()], is_locked_down: true }), asOf), toFactoryRow(factory('b', { has_free_grant: true, estimator_at: asOf }), asOf)]
        expect(paginateFactories(rows, factoryFiltersSchema.parse({ plan: 'base', lifecycle: 'locked', paidTerm: 'expiring' }), asOf).totalMatching).toBe(1)
        expect(paginateFactories(rows, factoryFiltersSchema.parse({ plan: 'free', activation: 'estimator_observed' }), asOf).totalMatching).toBe(1)
    })
})
