import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { f1State } from '../fixtures/costing-characterization'
import { asSuperuser, freshDatabase, seedOwnerOrg, type Db } from './helpers'
import { createTestSupabase, type RpcCall } from './supabase-adapter'

// Phase 3F: quote-to-order conversion, Start Party Order and market runs are
// retired. The three server actions stay only because the Estimator and
// Quotations screens import them from controls that never render. These tests
// pin what a direct call returns, even for a Base owner: the same refusal, after
// the owner check, with no database call and no rows written. They pass against
// the code before 3F as well, where an always-refusing guard gave this result.

type Actor = { userId: string; orgId: string }
const ctx = vi.hoisted(() => ({ db: undefined as unknown, actor: undefined as unknown, calls: [] as unknown[], tables: [] as string[], roleChecks: 0 }))

/** Record every table the action touches, on top of the adapter's RPC log. */
function tracked<T extends { from: (table: string) => unknown }>(client: T): T {
    return { ...client, from: (table: string) => { ctx.tables.push(table); return client.from(table) } }
}

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('@/lib/auth', () => ({
    requireRole: async (roles: string[]) => {
        expect(roles).toEqual(['owner'])
        ctx.roleChecks += 1
        const actor = ctx.actor as Actor
        return { user: { id: actor.userId }, profile: { id: actor.userId, org_id: actor.orgId, role: 'owner' } }
    },
}))
vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => {
        const actor = ctx.actor as Actor
        return tracked(createTestSupabase(ctx.db as Db, { kind: 'user', ...actor }, ctx.calls as RpcCall[]))
    },
}))
vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: () => tracked(createTestSupabase(ctx.db as Db, { kind: 'service' }, ctx.calls as RpcCall[])),
}))

const { convertAcceptedQuoteToOrder, createMarketRunFromEstimator, startPartyOrderFromEstimator } = await import('@/app/(dashboard)/owner/estimator/actions')

const REFUSAL = { error: 'This factory workflow is unavailable on Free, Lite, and Base.' }
const TABLES = ['estimator_quotes', 'orders', 'market_runs', 'order_yarn_requirements', 'machines']

let db: Db
let base: Actor

async function rowCounts() {
    await asSuperuser(db)
    const counts: Record<string, number | 'absent'> = {}
    for (const table of TABLES) {
        const { rows } = await db.query('SELECT to_regclass($1) IS NOT NULL AS present', [`public.${table}`])
        if (!rows[0].present) { counts[table] = 'absent'; continue }
        const result = await db.query(`SELECT count(*)::int AS n FROM public.${table}`)
        counts[table] = result.rows[0].n
    }
    return counts
}

beforeAll(async () => {
    db = await freshDatabase()
    ctx.db = db
    base = await seedOwnerOrg(db, { tier: 'base', name: 'Base Weaver' })
})
afterAll(async () => { await db?.end() })
beforeEach(() => {
    (ctx.calls as RpcCall[]).length = 0
    ctx.tables.length = 0
    ctx.roleChecks = 0
    ctx.actor = base
})

describe('retired factory workflows refuse direct calls', () => {
    const deadline = '2026-10-31'
    const cases = {
        convertAcceptedQuoteToOrder: () => convertAcceptedQuoteToOrder({ quoteId: randomUUID(), total_target_meters: 1000, deadline }),
        startPartyOrderFromEstimator: () => startPartyOrderFromEstimator({
            estimatorState: f1State({ orderQuantityM: 1000 }),
            partyName: 'Mahavir Traders',
            qualityLabel: 'DNO-252',
            targetMeters: 1000,
            deadline,
            quotePricePerM: 31.44,
            costPerM: 26.23,
        }),
        createMarketRunFromEstimator: () => createMarketRunFromEstimator({
            fabricLabel: 'Market Rayon',
            qualityLabel: 'DNO-252',
            targetMeters: 1000,
            estimate: f1State({ orderQuantityM: 1000 }),
            totalProductionCostPerM: 26.23,
            deadline,
        }),
    }

    for (const [name, call] of Object.entries(cases)) {
        it(`INVARIANT ${name}: owner check, then the refusal; no table or RPC access and no rows written`, async () => {
            const before = await rowCounts()
            await expect(call()).resolves.toEqual(REFUSAL)
            expect(ctx.roleChecks).toBe(1)
            expect(ctx.calls).toEqual([])
            expect(ctx.tables).toEqual([])
            expect(await rowCounts()).toEqual(before)
        })
    }
})
