import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { f1State } from '../fixtures/costing-characterization'
import { asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'
import { createTestSupabase, type RpcCall } from './supabase-adapter'

// Refactor Package 1B-2: the real paid save action, end to end against the
// replayed schema. Only authentication is mocked; the Supabase clients run
// every read and RPC in PostgreSQL as the owner or the service role
// (E8 C-INV-17…C-INV-21, E11 A-INV-09/10).

type Actor = { userId: string; orgId: string }
const ctx = vi.hoisted(() => ({ db: undefined as unknown, actor: undefined as unknown, calls: [] as unknown[] }))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('@/lib/auth', () => ({
    requireRole: async () => {
        const actor = ctx.actor as Actor
        return { user: { id: actor.userId }, profile: { id: actor.userId, org_id: actor.orgId, role: 'owner' } }
    },
}))
vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => {
        const actor = ctx.actor as Actor
        return createTestSupabase(ctx.db as Db, { kind: 'user', ...actor }, ctx.calls as RpcCall[])
    },
}))
vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: () => createTestSupabase(ctx.db as Db, { kind: 'service' }, ctx.calls as RpcCall[]),
}))

const { saveEstimatorQuoteV3 } = await import('@/app/(dashboard)/owner/estimator/actions')

let db: Db
let lite: Actor
let other: Actor

// Price for the F1 fixture at each target margin (production 26.23/m), from the
// independent reference in docs/maintenance/weavly-refactor/evidence.
const PRICE: Record<number, number> = { 12: 31.44, 13: 31.82, 14: 32.2, 15: 32.6, 16: 33 }
const atMargin = (profitPct: number) => ({ estimate: f1State({ profitPct }), totalProductionCostPerM: 26.23, quotePricePerM: PRICE[profitPct] })

type SaveResult = Awaited<ReturnType<typeof saveEstimatorQuoteV3>> & {
    quoteId?: string; updatedAt?: string; versionNumber?: number; noChange?: boolean; idempotentReplay?: boolean; error?: string
}

async function save(actor: Actor, overrides: Partial<Parameters<typeof saveEstimatorQuoteV3>[0]> = {}): Promise<SaveResult> {
    ctx.actor = actor
    const result = await saveEstimatorQuoteV3({
        clientRequestId: randomUUID(),
        qualityLabel: `Quality ${randomUUID().slice(0, 8)}`,
        ...atMargin(12),
        ...overrides,
    })
    return result as SaveResult
}

async function costingRows(orgId: string) {
    await asSuperuser(db)
    const { rows } = await db.query(
        `SELECT id, version_number, quote_price_per_meter::float8 AS price, server_attestation_id IS NOT NULL AS attested
           FROM public.estimator_quotes WHERE org_id = $1 AND record_kind = 'costing' ORDER BY version_number`,
        [orgId],
    )
    return rows as { id: string; version_number: number; price: number; attested: boolean }[]
}

beforeAll(async () => {
    db = await freshDatabase()
    ctx.db = db
    lite = await seedOwnerOrg(db, { tier: 'lite', name: 'Lite Weaver' })
    other = await seedOwnerOrg(db, { tier: 'lite', name: 'Other Weaver' })
})
afterAll(async () => { await db?.end() })
beforeEach(() => { (ctx.calls as RpcCall[]).length = 0 })

describe('paid costing save, end to end in PostgreSQL', () => {
    let first: SaveResult

    it('INVARIANT C-INV-19/20: a new costing is attested by the server and saved as version 1', async () => {
        first = await save(lite)
        expect(first.error).toBeUndefined()
        expect(first).toMatchObject({ success: true, versionNumber: 1 })
        expect((ctx.calls as RpcCall[]).map(call => `${call.identity}:${call.fn}`)).toEqual([
            'service:register_estimator_costing_attestation',
            'user:save_estimator_costing_revision_v2',
        ])
        expect(await costingRows(lite.orgId)).toEqual([{ id: first.quoteId, version_number: 1, price: 31.44, attested: true }])
        await asSuperuser(db)
        const { rows } = await db.query('SELECT consumed_at IS NOT NULL AS consumed FROM public.estimator_costing_attestations')
        expect(rows).toEqual([{ consumed: true }])
    })

    it('INVARIANT C-INV-20: retrying the same request returns the saved row without a second save', async () => {
        const clientRequestId = randomUUID()
        const original = await save(lite, { clientRequestId, sourceQuoteId: first.quoteId, expectedSourceUpdatedAt: first.updatedAt, ...atMargin(13) })
        const retry = await save(lite, { clientRequestId, sourceQuoteId: first.quoteId, expectedSourceUpdatedAt: first.updatedAt, ...atMargin(13) })
        expect(original).toMatchObject({ success: true, versionNumber: 2 })
        expect(retry).toMatchObject({ success: true, quoteId: original.quoteId, idempotentReplay: true })
        expect((await costingRows(lite.orgId)).map(row => row.version_number)).toEqual([1, 2])
    })

    it('INVARIANT C-INV-17: a client total that differs from the server by one paisa is refused before any attestation', async () => {
        const refused = await save(lite, { quotePricePerM: 31.45 })
        expect(refused.error).toBe('The estimate changed before it was saved. Review the recalculated totals and save again.')
        expect(ctx.calls).toEqual([])
    })

    it('CHARACTERIZATION C-INV-20: re-saving unchanged inputs as a new revision records no new version', async () => {
        const rows = await costingRows(lite.orgId)
        const latest = rows[rows.length - 1]
        await asSuperuser(db)
        const { rows: [source] } = await db.query('SELECT updated_at FROM public.estimator_quotes WHERE id = $1', [latest.id])
        const unchanged = await save(lite, { sourceQuoteId: latest.id, expectedSourceUpdatedAt: source.updated_at, ...atMargin(13) })
        expect(unchanged).toMatchObject({ success: true, noChange: true })
        expect((await costingRows(lite.orgId)).length).toBe(rows.length)
    })

    it('INVARIANT C-INV-20: a revision based on a stale version of the source is refused', async () => {
        const stale = await save(lite, { sourceQuoteId: first.quoteId, expectedSourceUpdatedAt: '2000-01-01T00:00:00Z', ...atMargin(14) })
        expect(stale.error).toBe('This costing changed in another tab. Reload the saved costing before saving again.')
        expect((await costingRows(lite.orgId)).map(row => row.version_number)).toEqual([1, 2])
    })

    it('INVARIANT C-INV-19: a payload altered after attestation is refused by the database', async () => {
        const probe = await save(lite, atMargin(15))
        expect(probe.success).toBe(true)
        const saveCall = (ctx.calls as RpcCall[]).find(call => call.fn === 'save_estimator_costing_revision_v2')!
        const tampered = { ...(saveCall.args.p_quote_payload as Record<string, unknown>), client_request_id: randomUUID(), quote_price_per_meter: 99 }
        await asUser(db, lite.userId, lite.orgId)
        const error = await pgError(db.query(
            'SELECT public.save_estimator_costing_revision_v2(p_quote_payload => $1, p_source_quote_id => NULL, p_expected_source_updated_at => NULL, p_template_id => NULL, p_expected_template_updated_at => NULL, p_update_saved_quality => false, p_template_payload => $2)',
            [JSON.stringify(tampered), '{}'],
        ))
        expect(error.message).toBe('The costing payload was not verified by the server. Refresh and try again.')
    })

    it('INVARIANT A-INV-09: an owner cannot revise another organization’s costing', async () => {
        const crossTenant = await save(other, { sourceQuoteId: first.quoteId, expectedSourceUpdatedAt: first.updatedAt, ...atMargin(16) })
        // The SECURITY DEFINER save RPC only looks up sources in the caller's own organization.
        expect(crossTenant.error).toBe('The costing being edited no longer exists.')
        expect(await costingRows(other.orgId)).toEqual([])
        expect((await costingRows(lite.orgId)).find(row => row.id === first.quoteId)?.price).toBe(31.44)
    })

    it('INVARIANT A-INV-09: an organization without a paid plan cannot save a costing', async () => {
        const unpaid = await seedOwnerOrg(db, { tier: null, name: 'Unpaid Weaver' })
        const refused = await save(unpaid)
        expect(refused.error).toBe('An active Weavly Estimator subscription is required to save costings.')
        expect(await costingRows(unpaid.orgId)).toEqual([])

        // CHARACTERIZATION CS-9 / A-INV-10: the service-role attestation step
        // does not enforce the plan (org_has_subscription_tier is always true
        // for service_role); the owner-side save RPC is what refuses it.
        await asSuperuser(db)
        const { rows } = await db.query('SELECT consumed_at IS NULL AS unused FROM public.estimator_costing_attestations WHERE org_id = $1', [unpaid.orgId])
        expect(rows).toEqual([{ unused: true }])
    })
})
