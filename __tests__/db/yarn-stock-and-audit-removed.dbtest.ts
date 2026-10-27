import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asSuperuser, asUser, freshDatabase, seedOwnerOrg, type Db } from './helpers'

// Yarn Stock and the Stock Audit were deleted on 2026-10-14 (20261014120000). Production, quality activation and
// dispatch keep working with no yarn anywhere, and fabric balances that included past audit adjustments do not move.

type Actor = { userId: string; orgId: string }
let db: Db

const TABLES = [
    'yarn_stock_settings', 'yarn_stock', 'yarn_stock_recipes', 'yarn_stock_requests', 'yarn_stock_movements',
    'inventory_audits', 'inventory_audit_lines', 'production_stock_lots', 'delivery_challan_lot_allocations',
]
const FUNCTIONS = [
    'public.mutate_yarn_stock(uuid, text, jsonb)',
    'public.get_yarn_stock_board(date, uuid, timestamptz, uuid)',
    'public.validate_quality_activation_yarn(uuid)',
    'private.move_dispatch_yarn_stock()',
    'private.yarn_costing_recipe(jsonb)',
    'public.get_inventory_audit_data(date, uuid)',
    'public.create_inventory_audit_draft(date, text, text)',
    'public.record_inventory_audit_count(uuid, text, uuid, numeric, text)',
    'public.apply_inventory_audit_adjustment(uuid, text, uuid, numeric, text, numeric)',
    'public.finalize_inventory_audit(uuid)',
]
// A costing whose result names two yarns with positive weights: exactly what used to need yarn stock to activate.
const SNAPSHOT = {
    audit: {
        warp: { layers: [{ name: '40s Cotton', finalKgPer100m: 6 }] },
        weft: { layers: [{ name: '30s Rayon', finalKgPer100m: 4 }] },
    },
}

async function seedCosting(owner: Actor, label: string) {
    const id = randomUUID()
    await asSuperuser(db)
    await db.query(`INSERT INTO public.estimator_quotes(id, org_id, record_kind, quality_label, yarn_denier, meters, yarn_rate_per_kg,
        landed_cost_per_meter, quote_price_per_meter, intended_margin_percent, worker_rate_per_m, costing_result_snapshot)
        VALUES ($1, $2, 'costing', $3, 100, 1000, 100, 20, 40, 50, 2, $4)`, [id, owner.orgId, label, SNAPSHOT])
    return id
}

async function activate(owner: Actor, costingId: string) {
    await asUser(db, owner.userId, owner.orgId)
    const { rows: [row] } = await db.query('SELECT public.activate_saved_costing_for_production($1) AS result', [costingId])
    return row.result as { success: boolean; job_id: string; blocked?: boolean }
}

/** Records production on the job as one entry, then runs the same reconcile a production save runs. */
async function produce(owner: Actor, jobId: string, meters: number) {
    await asSuperuser(db)
    const worker = randomUUID()
    await db.query("INSERT INTO public.base_production_workers(id, org_id, name, rate_per_meter) VALUES ($1, $2, $3, 2)", [worker, owner.orgId, `Worker ${worker.slice(0, 4)}`])
    // Dated in Surat like the job's start date: the column's current_date default is the server's UTC day,
    // which falls a day before the job between midnight and 5:30 am in Surat.
    const { rows: [entry] } = await db.query(
        "INSERT INTO public.base_production_entries(org_id, job_id, worker_id, meters, worker_rate_snapshot, production_date) VALUES ($1, $2, $3, $4, 2, (now() AT TIME ZONE 'Asia/Kolkata')::date) RETURNING id",
        [owner.orgId, jobId, worker, meters])
    await db.query('SELECT private.reconcile_quality_stock($1, NULL, NULL)', [owner.orgId])
    return entry.id as string
}

async function fabric(owner: Actor, qualityKey: string) {
    await asSuperuser(db)
    const { rows: [row] } = await db.query('SELECT id, meters::float8 AS meters FROM public.quality_stock WHERE org_id = $1 AND quality_key = $2', [owner.orgId, qualityKey])
    return row as { id: string; meters: number } | undefined
}

beforeAll(async () => { db = await freshDatabase() })
afterAll(async () => { await db?.end() })

describe('yarn stock and stock audit removed', () => {
    it('yarn and audit objects are gone', async () => {
        await asSuperuser(db)
        for (const table of TABLES) {
            const { rows: [row] } = await db.query('SELECT to_regclass($1) AS oid', [`public.${table}`])
            expect(row.oid, table).toBeNull()
        }
        for (const signature of FUNCTIONS) {
            const { rows: [row] } = await db.query('SELECT to_regprocedure($1) AS oid', [signature])
            expect(row.oid, signature).toBeNull()
        }
        const { rows } = await db.query("SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'base_production_jobs' AND column_name = 'yarn_recipe_snapshot'")
        expect(rows).toEqual([])
    })

    it('activation needs no yarn stock', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const result = await activate(owner, await seedCosting(owner, 'Cotton Poplin'))
        expect(result).toMatchObject({ success: true })
        expect(result).not.toHaveProperty('blocked')
    })

    it('production for a quality that had a yarn recipe saves, and a downward correction succeeds', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        const { job_id: job } = await activate(owner, await seedCosting(owner, 'Rayon Slub'))
        const entry = await produce(owner, job, 50)
        expect((await fabric(owner, 'rayon slub'))?.meters).toBe(50)

        await asSuperuser(db)
        await db.query('UPDATE public.base_production_entries SET meters = 30 WHERE id = $1', [entry])
        await db.query('SELECT private.reconcile_quality_stock($1, NULL, NULL)', [owner.orgId])
        expect((await fabric(owner, 'rayon slub'))?.meters).toBe(30)
    })

    it('cancelling an issued dispatch restores fabric', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        await asUser(db, owner.userId, owner.orgId)
        await db.query("SELECT public.record_quality_stock_adjustment('Cotton Poplin', 100, 'opening', 'Physical count', $1)", [randomUUID()])
        const quality = await fabric(owner, 'cotton poplin')
        const id = randomUUID()
        const mutate = async (action: string, payload: object) => {
            await asUser(db, owner.userId, owner.orgId)
            const { rows: [current] } = await db.query('SELECT version FROM public.delivery_challans WHERE id = $1', [id])
            await db.query('SELECT public.mutate_delivery_challan($1, $2, $3, $4, $5)', [id, randomUUID(), current?.version ?? 0, action, payload])
        }
        await mutate('save', {
            quality_id: quality!.id, selling_rate: 50, lines: [{ lot: 'LOT-1', meters: 40 }],
            document: { sender_name: 'Test Weaving Works', sender_address: 'Surat', customer_name: 'Test Party', customer_address: 'Surat', delivery_address: 'Surat', date: '2026-10-14' },
        })
        await mutate('confirm', {})
        expect((await fabric(owner, 'cotton poplin'))?.meters).toBe(60)
        await mutate('reverse_dispatch', { reason: 'Returned before delivery', stock_present: true })
        expect((await fabric(owner, 'cotton poplin'))?.meters).toBe(100)
    })

    it('audited fabric keeps its balance and history', async () => {
        const owner = await seedOwnerOrg(db, { tier: 'base' })
        await asUser(db, owner.userId, owner.orgId)
        await db.query("SELECT public.record_quality_stock_adjustment('Cotton Poplin', 100, 'opening', 'Physical count', $1)", [randomUUID()])
        const quality = await fabric(owner, 'cotton poplin')
        await asSuperuser(db)
        await db.query("INSERT INTO public.quality_stock_movements(org_id, quality_id, kind, meters_delta, balance_after, reason) VALUES ($1, $2, 'audit_adjustment', -4, 96, 'Recount (Audit: Stock Audit)')", [owner.orgId, quality!.id])
        await db.query('UPDATE public.quality_stock SET meters = 96 WHERE id = $1', [quality!.id])

        const { job_id: job } = await activate(owner, await seedCosting(owner, 'Cotton Poplin'))
        await produce(owner, job, 10)
        expect((await fabric(owner, 'cotton poplin'))?.meters).toBe(106)
        await asSuperuser(db)
        const { rows } = await db.query("SELECT meters_delta::float8 AS delta FROM public.quality_stock_movements WHERE quality_id = $1 AND kind = 'audit_adjustment'", [quality!.id])
        expect(rows).toEqual([{ delta: -4 }])
    })
    it('April yarn & beam module is gone', async () => {
        await asSuperuser(db)
        for (const relation of ['yarn_batches', 'yarn_lots', 'yarn_movements', 'beam_cards', 'beam_card_lots', 'order_yarn_requirements', 'yarn_lot_stock_summary', 'order_yarn_variance_summary']) {
            const { rows: [row] } = await db.query('SELECT to_regclass($1) AS oid', [`public.${relation}`])
            expect(row.oid, relation).toBeNull()
        }
        const { rows: functions } = await db.query(`SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = ANY($1)`,
            [['link_batch_to_machine', 'settle_batch_audit', 'get_yield_alert', 'get_batch_yield_report', 'get_daily_brief_stats', 'get_kpi_yesterday', 'start_party_order_from_estimator']])
        expect(functions).toEqual([])
        const { rows: columns } = await db.query("SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'production_logs' AND column_name = 'yarn_batch_id'")
        expect(columns).toEqual([])
    })
    it('the closing guard names a function that still reads a deleted table, and finds none after the migrations', async () => {
        const sql = readFileSync('supabase/migrations/20261014120100_remove_yarn_beam_module.sql', 'utf8')
        const pattern = sql.match(/p\.prosrc ~ '([^']+)'/)![1]
        const leftovers = "SELECT p.oid::regprocedure::text AS fn FROM pg_proc p WHERE p.pronamespace IN ('public'::regnamespace, 'private'::regnamespace) AND p.prosrc ~ $1"
        await asSuperuser(db)
        expect((await db.query(leftovers, [pattern])).rows).toEqual([])
        await db.query('CREATE FUNCTION public.guard_probe() RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint $$')
        await db.query("CREATE OR REPLACE FUNCTION public.guard_probe() RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN RETURN (SELECT count(*) FROM public.inventory_audits); END $$")
        expect((await db.query(leftovers, [pattern])).rows).toEqual([{ fn: 'guard_probe()' }])
        await db.query('DROP FUNCTION public.guard_probe()')
    })
})
