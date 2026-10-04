import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildCostingResult, calcFullTotals, type EstimateState } from '@/lib/estimator'
import { resolveSavedCostingInputBasis } from '@/lib/saved-costings'
import { f1State } from '../fixtures/costing-characterization'
import { asSuperuser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'
import { createTestSupabase, type RpcCall } from './supabase-adapter'

// LT01B (LC74 / CS-2): save -> PostgreSQL -> read -> reopen -> save keeps the
// warping and overhead basis. Only authentication is mocked.

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

const { saveAsFabricTemplate, saveEstimatorQuoteV3 } = await import('@/app/(dashboard)/owner/estimator/actions')

let db: Db
let lite: Actor

type SaveResult = { success?: boolean; quoteId?: string; updatedAt?: string; noChange?: boolean; error?: string }

function totalsFor(estimate: EstimateState) {
    const result = buildCostingResult(estimate, calcFullTotals(estimate))
    return { totalProductionCostPerM: result.productionCostPerM, quotePricePerM: result.suggestedSellingPricePerM }
}

async function save(estimate: EstimateState, overrides: Partial<Parameters<typeof saveEstimatorQuoteV3>[0]> = {}) {
    ctx.actor = lite
    return await saveEstimatorQuoteV3({
        clientRequestId: randomUUID(),
        qualityLabel: `Basis ${randomUUID().slice(0, 8)}`,
        estimate,
        ...totalsFor(estimate),
        ...overrides,
    }) as SaveResult
}

async function storedRow(id: string) {
    await asSuperuser(db)
    const { rows: [row] } = await db.query(
        `SELECT warping_mode, overhead_mode, warping_rate_per_kg::float8 AS warping_rate_per_kg,
                overhead_override_per_m::float8 AS overhead_override_per_m, overhead_per_meter::float8 AS overhead_per_meter,
                production_cost_per_meter::float8 AS production_cost_per_meter, updated_at
           FROM public.estimator_quotes WHERE id = $1`,
        [id],
    )
    return row as Record<string, unknown> & { production_cost_per_meter: number; updated_at: string }
}

function reopen(saved: EstimateState, row: Record<string, unknown>): EstimateState {
    const basis = resolveSavedCostingInputBasis(row)
    return { ...saved, ...basis, warpingMode: basis.warpingMode ?? 'in_house' }
}

const inHouseMonthlyApplied = () => f1State({ warpingMode: 'in_house', warpingRatePerKg: 12, overheadMode: 'monthly_expenses', overheadOverridePerM: 2.5 })

beforeAll(async () => {
    db = await freshDatabase()
    ctx.db = db
    lite = await seedOwnerOrg(db, { tier: 'lite', name: 'Basis Weaver' })
})
afterAll(async () => { await db?.end() })

describe('saved costing input basis, end to end in PostgreSQL', () => {
    it('stores in-house warping with a kept reference rate and the monthly overhead that was applied', async () => {
        const estimate = inHouseMonthlyApplied()
        const saved = await save(estimate)
        expect(saved.error).toBeUndefined()
        const row = await storedRow(saved.quoteId!)
        expect(row).toMatchObject({ warping_mode: 'in_house', overhead_mode: 'monthly_expenses', warping_rate_per_kg: 12, overhead_override_per_m: 2.5, overhead_per_meter: 2.5 })
    })

    it('reopens to the saved cost, and an unchanged resave records no new version', async () => {
        const estimate = inHouseMonthlyApplied()
        const qualityLabel = `Basis ${randomUUID().slice(0, 8)}`
        const saved = await save(estimate, { qualityLabel })
        const row = await storedRow(saved.quoteId!)

        const reopened = reopen(estimate, row)
        expect(buildCostingResult(reopened, calcFullTotals(reopened)).productionCostPerM).toBe(row.production_cost_per_meter)

        // The earlier inference would have charged warping and dropped the applied overhead.
        const legacy = reopen(estimate, { warping_rate_per_kg: 12, overhead_override_per_m: null })
        expect(buildCostingResult(legacy, calcFullTotals(legacy)).productionCostPerM).not.toBe(row.production_cost_per_meter)

        const resaved = await save(reopened, { qualityLabel, sourceQuoteId: saved.quoteId, expectedSourceUpdatedAt: row.updated_at })
        expect(resaved).toMatchObject({ success: true, noChange: true, quoteId: saved.quoteId })
    })

    it('stores direct mode and its rate', async () => {
        const saved = await save(f1State({ overheadMode: 'direct', overheadOverridePerM: 3 }))
        expect(await storedRow(saved.quoteId!)).toMatchObject({ overhead_mode: 'direct', overhead_override_per_m: 3, warping_mode: 'outsourced' })
    })

    it('stores the basis on the first costing of a new saved quality', async () => {
        ctx.actor = lite
        const estimate = inHouseMonthlyApplied()
        const result = await saveAsFabricTemplate({
            name: `Basis quality ${randomUUID().slice(0, 6)}`, partyName: '',
            warpRows: estimate.warpRows, weftRows: estimate.weftRows, tapeLengthM: estimate.tapeLengthM,
            warpCrimpPct: estimate.warpCrimpPct, perPickCostPaisa: estimate.perPickCostPaisa, yarnShortagePct: estimate.yarnShortagePct,
            overheadMode: estimate.overheadMode, overheadOverridePerM: estimate.overheadOverridePerM,
            loomType: estimate.loomType, loomRpm: estimate.loomRpm, loomPowerKw: estimate.loomPowerKw,
            warpingMode: estimate.warpingMode, sizingMode: estimate.sizingMode, hoursPerShift: estimate.hoursPerShift, estimate,
        }) as SaveResult
        expect(result).toMatchObject({ success: true })
        expect(await storedRow(result.quoteId!)).toMatchObject({ warping_mode: 'in_house', overhead_mode: 'monthly_expenses', overhead_override_per_m: 2.5 })
    })

    it('keeps the stored basis immutable like the rest of the snapshot', async () => {
        const saved = await save(inHouseMonthlyApplied())
        await asSuperuser(db)
        const error = await pgError(db.query("UPDATE public.estimator_quotes SET warping_mode = 'outsourced' WHERE id = $1", [saved.quoteId]))
        expect(error.message).toBe('Historical costing snapshots are immutable. Save a new costing version for changed economics.')
    })
})

describe('code deployed before the migration', () => {
    it('falls back once to the legacy payload when the database rejects the new keys', async () => {
        await asSuperuser(db)
        const { rows: [fn] } = await db.query(
            "SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'save_estimator_costing_revision_v2'",
        )
        const current = fn.def as string
        const preMigration = current.replace("'server_attestation_id', 'warping_mode', 'overhead_mode'", "'server_attestation_id'")
        expect(preMigration).not.toBe(current)
        await db.query(preMigration)
        try {
            ctx.calls.length = 0
            const saved = await save(inHouseMonthlyApplied())
            expect(saved).toMatchObject({ success: true })
            expect((ctx.calls as RpcCall[]).map(call => call.fn)).toEqual([
                'register_estimator_costing_attestation',
                'save_estimator_costing_revision_v2',
                'register_estimator_costing_attestation',
                'save_estimator_costing_revision_v2',
            ])
            // Today's behavior without the migration: no modes, override kept only in direct mode.
            expect(await storedRow(saved.quoteId!)).toMatchObject({ warping_mode: null, overhead_mode: null, overhead_override_per_m: null, overhead_per_meter: 2.5 })
        } finally {
            await asSuperuser(db)
            await db.query(current)
        }
    })
})
