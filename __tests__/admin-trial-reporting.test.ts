import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const fixture = vi.hoisted(() => ({ guard: vi.fn(), audit: vi.fn(), rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/admin/founder', () => ({ requireFounder: fixture.guard, adminRecordAudit: fixture.audit }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: fixture.rpc, from: fixture.from }) }))

import { getFactoryDetail, listFactories } from '@/lib/admin/factories'
import { resolveFactoryAccess, type SubscriptionInput } from '@/lib/admin/metrics'

const DAY = 86_400_000
const asOf = new Date().toISOString()
const at = (days: number) => new Date(Date.parse(asOf) + days * DAY).toISOString()
const ORG = '00000000-0000-4000-8000-000000000042'
const TRIAL_ID = '00000000-0000-4000-8000-000000000101'
const PAID_ID = '00000000-0000-4000-8000-000000000102'

/** An org_subscriptions row as the founder snapshot serialises it. */
function trial(overrides: Partial<SubscriptionInput> = {}): SubscriptionInput {
    return { id: TRIAL_ID, status: 'active', plan_tier: 'lite', current_start: at(-1), current_end: at(29), razorpay_payment_id: null, created_at: at(-1), payment_evidenced: false, is_trial: true, ...overrides }
}
function lapsedTrial(overrides: Partial<SubscriptionInput> = {}): SubscriptionInput {
    return trial({ current_start: at(-31), current_end: at(-2), created_at: at(-31), ...overrides })
}
function paidLite(overrides: Partial<SubscriptionInput> = {}): SubscriptionInput {
    return { id: PAID_ID, status: 'active', plan_tier: 'lite', current_start: at(0), current_end: at(365), razorpay_payment_id: 'pay_synthetic_trial_convert', created_at: at(0), payment_evidenced: true, is_trial: false, ...overrides }
}

describe('Lite trial rows in founder reporting resolve as trials', () => {
    it('an active trial reports Lite access with no paid term', () => {
        expect(resolveFactoryAccess([trial()], false, asOf)).toMatchObject({ effectivePlan: 'lite', subscriptionTier: 'lite', currentPaidTerm: null })
    })

    it('a lapsed trial with an explicit Free grant reports Free, not Lite or none', () => {
        expect(resolveFactoryAccess([lapsedTrial()], true, asOf)).toMatchObject({ effectivePlan: 'free', subscriptionTier: 'none', currentPaidTerm: null })
        // A trial gets no 24-hour grace: one that ended two hours ago has already lapsed.
        expect(resolveFactoryAccess([lapsedTrial({ current_end: new Date(Date.parse(asOf) - 2 * 3_600_000).toISOString() })], true, asOf))
            .toMatchObject({ effectivePlan: 'free', subscriptionTier: 'none', currentPaidTerm: null })
    })

    it('a lapsed trial without a Free grant reports no access, and never established paid history', () => {
        expect(resolveFactoryAccess([lapsedTrial()], false, asOf)).toMatchObject({ effectivePlan: 'none', currentPaidTerm: null })
    })

    it('a trial row never becomes a paid term, even if payment fields were present', () => {
        expect(resolveFactoryAccess([trial({ payment_evidenced: true })], false, asOf).currentPaidTerm).toBeNull()
        // The database shape check forbids Razorpay ids on trial rows; the resolver refuses them anyway.
        expect(resolveFactoryAccess([trial({ payment_evidenced: true, razorpay_payment_id: 'pay_synthetic_bad_trial' })], false, asOf).currentPaidTerm).toBeNull()
    })

    it('a converted owner reports the paid term, with the trial kept out of it', () => {
        expect(resolveFactoryAccess([trial({ created_at: at(-2) }), paidLite()], false, asOf))
            .toMatchObject({ effectivePlan: 'lite', currentPaidTerm: { id: PAID_ID, tier: 'lite', paymentReference: 'pay_synthetic_trial_convert' } })
    })
})

function snapshotRow(overrides: Record<string, unknown> = {}) {
    return { id: ORG, name: 'Synthetic trial works', created_at: at(-40), cohort: 'production', is_locked_down: false, owner_revoked: false, verified_email: null, subscriptions: [], has_free_grant: true, free_subject_id: '00000000-0000-4000-8000-000000000090', estimator_at: null, production_at: null, last_outcome_at: null, open_tickets: 0, ...overrides }
}
/** A thenable stand-in for the query chain the detail loader awaits. */
function queryChain() {
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'lte', 'order', 'limit']) chain[method] = () => chain
    chain.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve)
    return chain
}
function snapshotReturning(rows: unknown[]) {
    fixture.rpc.mockImplementation((name: string, args: { p_as_of: string }) => Promise.resolve({
        data: name === 'admin_factory_snapshot' ? { asOf: args.p_as_of, rows } : null, error: null,
    }))
}

describe('founder snapshot carries the trial flag through the loaders', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        fixture.guard.mockResolvedValue({ userId: 'founder', sessionId: 'session', capabilities: [] })
        fixture.audit.mockResolvedValue(undefined)
        fixture.from.mockImplementation(() => queryChain())
    })

    it('a lapsed trial with a Free grant lists as Free', async () => {
        snapshotReturning([snapshotRow({ subscriptions: [lapsedTrial()] })])
        const listed = await listFactories()
        expect(listed.items[0].access).toMatchObject({ effectivePlan: 'free', currentPaidTerm: null })
    })

    it('term history marks the trial and the converted paid term separately', async () => {
        snapshotReturning([snapshotRow({ subscriptions: [trial({ created_at: at(-2) }), paidLite()] })])
        const detail = await getFactoryDetail(ORG)
        expect(detail.access).toMatchObject({ effectivePlan: 'lite', currentPaidTerm: { id: PAID_ID } })
        expect(detail.termHistory).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: TRIAL_ID, isTrial: true }),
            expect.objectContaining({ id: PAID_ID, isTrial: false }),
        ]))
    })

    it('a snapshot row without the trial flag fails closed as unavailable, never read as paid history', async () => {
        const legacy: Partial<SubscriptionInput> = lapsedTrial()
        delete legacy.is_trial
        snapshotReturning([snapshotRow({ subscriptions: [legacy] })])
        await expect(listFactories()).rejects.toMatchObject({ code: 'FACTORY_SOURCE_UNAVAILABLE', status: 503 })
    })
})

const MIGRATION_DIR = join(process.cwd(), 'supabase/migrations')
const ORIGINAL = '20261004151000_founder_factory_reporting.sql'
const REVISED = '20261011120100_admin_snapshot_trial_flag.sql'
const DEFINITION_END = 'END; $$;'
const TRIAL_KEY = "'is_trial',s.is_trial,"
const REVOKE = 'REVOKE ALL ON FUNCTION public.admin_factory_snapshot(uuid,uuid,timestamptz,uuid,text) FROM PUBLIC,anon,authenticated;'
const GRANT = 'GRANT EXECUTE ON FUNCTION public.admin_factory_snapshot(uuid,uuid,timestamptz,uuid,text) TO service_role;'

function readMigration(name: string) {
    return readFileSync(join(MIGRATION_DIR, name), 'utf8')
}
/** The admin_factory_snapshot definition, from its CREATE through the end of its body. */
function definitionOf(sql: string) {
    const start = sql.search(/CREATE (OR REPLACE )?FUNCTION public\.admin_factory_snapshot\(/)
    const end = sql.indexOf(DEFINITION_END, start)
    if (start < 0 || end < 0) throw new Error('admin_factory_snapshot definition not found')
    return sql.slice(start, end + DEFINITION_END.length).replace('CREATE OR REPLACE FUNCTION', 'CREATE FUNCTION')
}

describe('admin_factory_snapshot trial-flag migration', () => {
    it('redefines admin_factory_snapshot with CREATE OR REPLACE and no other function', () => {
        const sql = readMigration(REVISED)
        expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.admin_factory_snapshot\(/)
        expect(sql.match(/CREATE (OR REPLACE )?FUNCTION/g)).toHaveLength(1)
    })

    it('adds is_trial to each subscription object and changes nothing else in the function body', () => {
        const original = definitionOf(readMigration(ORIGINAL))
        const revised = definitionOf(readMigration(REVISED))
        expect(revised.split(TRIAL_KEY)).toHaveLength(2)
        expect(revised.replace(TRIAL_KEY, '')).toBe(original)
    })

    it('re-issues the original REVOKE and GRANT exactly, keeping execute service-role only', () => {
        const original = readMigration(ORIGINAL)
        const sql = readMigration(REVISED)
        expect(original).toContain(REVOKE)
        expect(original).toContain(GRANT)
        expect(sql).toContain(REVOKE)
        expect(sql).toContain(GRANT)
    })
})
