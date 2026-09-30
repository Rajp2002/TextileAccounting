import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'
import { createTestSupabase } from './supabase-adapter'

// PI-06 (Stock audit): (1) changing the audit date must load that date's audit, never date B's stock with audit A's
// lines; (2) the adjustment the owner is shown must be the adjustment that is applied. Executed against the replayed
// schema, including 20260930150000_inventory_audit_date_and_adjustment.sql.

type Actor = { userId: string; orgId: string }
const ctx = vi.hoisted(() => ({ db: undefined as unknown, actor: undefined as unknown }))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('@/lib/auth', () => ({
    requireRole: async () => {
        const actor = ctx.actor as Actor
        return { user: { id: actor.userId }, profile: { id: actor.userId, org_id: actor.orgId, role: 'owner' } }
    },
}))
vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => createTestSupabase(ctx.db as Db, { kind: 'user', ...(ctx.actor as Actor) }),
}))

const actions = await import('@/app/(dashboard)/owner/stock/audit/actions')

type Board = {
    audit_date: string
    audit: { id: string; status: string; audit_date: string } | null
    lines: { item_type: string; item_id: string; system_quantity: number; physical_count: number; variance: number; adjustment_applied: boolean }[]
    fabric: { id: string; quality_label: string; system_meters: number }[]
    yarns: { id: string; yarn_name: string; system_loose_kg: number }[]
}

let db: Db
let today: string
let yesterday: string

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
    const { rows } = await db.query(text, params)
    return rows as T[]
}
async function board(actor: Actor, date: string | null, auditId: string | null = null) {
    await asUser(db, actor.userId, actor.orgId)
    const [{ board: result }] = await sql<{ board: Board }>('SELECT public.get_inventory_audit_data($1, $2) AS board', [date, auditId])
    return result
}
async function draft(actor: Actor, date: string) {
    await asUser(db, actor.userId, actor.orgId)
    const [{ result }] = await sql<{ result: { audit_id: string } }>("SELECT public.create_inventory_audit_draft($1, 'Stock Audit', NULL) AS result", [date])
    return result.audit_id
}
async function count(actor: Actor, auditId: string, itemType: 'fabric' | 'yarn', itemId: string, physical: number) {
    await asUser(db, actor.userId, actor.orgId)
    const [{ result }] = await sql<{ result: { system_quantity: number; variance: number } }>('SELECT public.record_inventory_audit_count($1, $2, $3, $4, NULL) AS result', [auditId, itemType, itemId, physical])
    return result
}
async function adjust(actor: Actor, auditId: string, itemType: 'fabric' | 'yarn', itemId: string, physical: number, expectedVariance: number | null = null) {
    await asUser(db, actor.userId, actor.orgId)
    const [{ result }] = await sql<{ result: { adjusted?: boolean; variance?: number } }>(
        "SELECT public.apply_inventory_audit_adjustment($1, $2, $3, $4, 'Recount', $5) AS result", [auditId, itemType, itemId, physical, expectedVariance])
    return result
}

/** One org with a quality that had 100 m two days ago and +20 m of production since (120 m now), and yarn likewise. */
async function seedOrg(name: string) {
    const actor = await seedOwnerOrg(db, { tier: 'base', name })
    await asUser(db, actor.userId, actor.orgId)
    await sql("SELECT public.record_quality_stock_adjustment('Cotton Poplin', 100, 'opening', 'Physical count', $1)", [randomUUID()])
    await asSuperuser(db)
    const [quality] = await sql<{ id: string }>("SELECT id FROM public.quality_stock WHERE org_id = $1 AND quality_key = 'cotton poplin'", [actor.orgId])
    await sql('SET session_replication_role = replica')
    await sql("UPDATE public.quality_stock_movements SET created_at = now() - interval '2 days 3 hours' WHERE org_id = $1", [actor.orgId])
    await sql("INSERT INTO public.quality_stock_movements(org_id, quality_id, kind, meters_delta, balance_after, reason) VALUES ($1, $2, 'production', 20, 120, 'Production entry')", [actor.orgId, quality.id])
    await sql('UPDATE public.quality_stock SET meters = 120 WHERE id = $1', [quality.id])
    const [yarnRow] = await sql<{ id: string }>("INSERT INTO public.yarn_stock(org_id, yarn_name, weight_kg) VALUES ($1, '40s Cotton', 80) RETURNING id", [actor.orgId])
    await sql("INSERT INTO public.yarn_stock_movements(org_id, yarn_id, kind, kg_delta, balance_after, reason, created_at) VALUES ($1, $2, 'opening', 74, 74, 'Opening stock', now() - interval '2 days 3 hours')", [actor.orgId, yarnRow.id])
    await sql("INSERT INTO public.yarn_stock_movements(org_id, yarn_id, kind, kg_delta, balance_after, reason) VALUES ($1, $2, 'opening', 6, 80, 'Yarn received')", [actor.orgId, yarnRow.id])
    await sql('SET session_replication_role = origin')
    return { actor, cotton: quality.id, yarn: yarnRow.id }
}
const current = async (table: 'quality_stock' | 'yarn_stock', id: string) => {
    await asSuperuser(db)
    const [row] = await sql<{ qty: string }>(`SELECT ${table === 'quality_stock' ? 'meters' : 'weight_kg'}::text AS qty FROM public.${table} WHERE id = $1`, [id])
    return Number(row.qty)
}

beforeAll(async () => {
    db = await freshDatabase()
    ctx.db = db
    const [dates] = await sql<{ today: string; yesterday: string }>(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1)::text AS yesterday`)
    ;({ today, yesterday } = dates)
})
afterAll(async () => { await db?.end() })

describe('PI-06: changing the audit date loads that date\'s audit', () => {
    it('INVARIANT: an audit id decides the date, so a stale id with another date cannot mix two audits', async () => {
        const { actor, cotton } = await seedOrg('Date Mix Org')
        const audit = await draft(actor, today)
        await count(actor, audit, 'fabric', cotton, 118)

        const mixed = await board(actor, yesterday, audit)
        expect(mixed.audit).toMatchObject({ id: audit, audit_date: today })
        expect(mixed.audit_date).toBe(today)
        expect(mixed.fabric.map(item => item.system_meters)).toEqual([120])
        expect(mixed.lines.map(line => line.physical_count)).toEqual([118])
    })

    it('INVARIANT: the date alone loads that date\'s own draft and lines, not another date\'s', async () => {
        const { actor, cotton } = await seedOrg('Two Dates Org')
        const first = await draft(actor, today)
        const second = await draft(actor, yesterday)
        await count(actor, first, 'fabric', cotton, 118)
        await count(actor, second, 'fabric', cotton, 97)

        const onToday = await board(actor, today)
        const onYesterday = await board(actor, yesterday)
        expect(onToday.audit?.id).toBe(first)
        expect(onToday.lines.map(line => [line.system_quantity, line.physical_count])).toEqual([[120, 118]])
        expect(onYesterday.audit?.id).toBe(second)
        expect(onYesterday.lines.map(line => [line.system_quantity, line.physical_count])).toEqual([[100, 97]])
        expect(onYesterday.fabric.map(item => item.system_meters)).toEqual([100])
    })

    it('INVARIANT: a date with no audit shows an empty board for that date, with no audit and no lines', async () => {
        const { actor, cotton } = await seedOrg('Empty Date Org')
        const audit = await draft(actor, today)
        await count(actor, audit, 'fabric', cotton, 118)
        const empty = await board(actor, yesterday)
        expect(empty.audit).toBeNull()
        expect(empty.lines).toEqual([])
        expect(empty.audit_date).toBe(yesterday)
    })

    it('INVARIANT: a date whose audit is finalized loads that finalized audit (a draft, when present, wins)', async () => {
        const { actor, cotton } = await seedOrg('Finalized Date Org')
        const audit = await draft(actor, yesterday)
        await count(actor, audit, 'fabric', cotton, 97)
        await asUser(db, actor.userId, actor.orgId)
        await sql('SELECT public.finalize_inventory_audit($1)', [audit])

        const loaded = await board(actor, yesterday)
        expect(loaded.audit).toMatchObject({ id: audit, status: 'finalized' })
        expect(loaded.lines.map(line => line.physical_count)).toEqual([97])

        const newer = await draft(actor, yesterday)
        expect(newer).not.toBe(audit)
        expect((await board(actor, yesterday)).audit).toMatchObject({ id: newer, status: 'draft' })
    })

    it('INVARIANT: the page action loads the new date without the previous audit id', async () => {
        const { actor, cotton } = await seedOrg('Action Date Org')
        ctx.actor = actor
        const audit = await draft(actor, today)
        await count(actor, audit, 'fabric', cotton, 118)
        const result = await actions.getInventoryAuditDataAction({ auditDate: yesterday })
        expect('data' in result && result.data.audit).toBeNull()
        expect('data' in result && result.data.audit_date).toBe(yesterday)
    })
})

describe('PI-06: the adjustment shown equals the adjustment applied', () => {
    it('INVARIANT: an audit for a past date applies the shown variance to today\'s stock and keeps the movements since', async () => {
        const { actor, cotton } = await seedOrg('Past Fabric Org')
        const audit = await draft(actor, yesterday)
        const recorded = await count(actor, audit, 'fabric', cotton, 96)
        expect(recorded).toMatchObject({ system_quantity: 100, variance: -4 })

        const applied = await adjust(actor, audit, 'fabric', cotton, 96, recorded.variance)
        expect(applied).toMatchObject({ adjusted: true, variance: -4 })
        expect(await current('quality_stock', cotton)).toBe(116)

        await asSuperuser(db)
        const [movement] = await sql<{ meters_delta: string; balance_after: string }>("SELECT meters_delta::text, balance_after::text FROM public.quality_stock_movements WHERE org_id = $1 AND kind = 'audit_adjustment'", [actor.orgId])
        expect(Number(movement.meters_delta)).toBe(-4)
        expect(Number(movement.balance_after)).toBe(116)
        const [line] = await sql<{ system_quantity: string; variance: string; adjustment_applied: boolean }>('SELECT system_quantity::text, variance::text, adjustment_applied FROM public.inventory_audit_lines WHERE audit_id = $1', [audit])
        expect([Number(line.system_quantity), Number(line.variance), line.adjustment_applied]).toEqual([100, -4, true])
    })

    it('INVARIANT: an audit dated today still lands stock on the counted figure', async () => {
        const { actor, cotton } = await seedOrg('Today Fabric Org')
        const audit = await draft(actor, today)
        const recorded = await count(actor, audit, 'fabric', cotton, 118)
        expect(recorded.variance).toBe(-2)
        expect(await adjust(actor, audit, 'fabric', cotton, 118, recorded.variance)).toMatchObject({ adjusted: true, variance: -2 })
        expect(await current('quality_stock', cotton)).toBe(118)
    })

    it('INVARIANT: yarn follows the same rule (kg, three decimals)', async () => {
        const { actor, yarn } = await seedOrg('Past Yarn Org')
        const audit = await draft(actor, yesterday)
        const recorded = await count(actor, audit, 'yarn', yarn, 73.5)
        expect(recorded).toMatchObject({ system_quantity: 74, variance: -0.5 })
        expect(await adjust(actor, audit, 'yarn', yarn, 73.5, recorded.variance)).toMatchObject({ adjusted: true, variance: -0.5 })
        expect(await current('yarn_stock', yarn)).toBe(79.5)
    })

    it('INVARIANT: a change since the adjustment was shown is refused and nothing moves', async () => {
        const { actor, cotton } = await seedOrg('Stale Shown Org')
        const audit = await draft(actor, yesterday)
        await count(actor, audit, 'fabric', cotton, 96)
        const error = await pgError(adjust(actor, audit, 'fabric', cotton, 96, -3))
        expect(error.message).toContain('The adjustment changed since it was shown')
        expect(await current('quality_stock', cotton)).toBe(120)
    })

    it('INVARIANT: an adjustment that would make stock negative is refused with an explanation', async () => {
        const { actor, cotton } = await seedOrg('Negative Org')
        const audit = await draft(actor, yesterday)
        const recorded = await count(actor, audit, 'fabric', cotton, 0)
        expect(recorded.variance).toBe(-100)
        await asSuperuser(db)
        await sql('SET session_replication_role = replica')
        await sql("INSERT INTO public.quality_stock_movements(org_id, quality_id, kind, meters_delta, balance_after, reason) VALUES ($1, $2, 'correction', -118, 2, 'Dispatched since')", [actor.orgId, cotton])
        await sql('UPDATE public.quality_stock SET meters = 2 WHERE id = $1', [cotton])
        await sql('SET session_replication_role = origin')
        const error = await pgError(adjust(actor, audit, 'fabric', cotton, 0, recorded.variance))
        expect(error.message).toContain('would make stock negative')
        expect(await current('quality_stock', cotton)).toBe(2)
    })

    it('INVARIANT: a zero variance changes nothing and reports that', async () => {
        const { actor, cotton } = await seedOrg('Zero Org')
        const audit = await draft(actor, yesterday)
        await count(actor, audit, 'fabric', cotton, 100)
        expect(await adjust(actor, audit, 'fabric', cotton, 100, 0)).toMatchObject({ adjusted: false })
        expect(await current('quality_stock', cotton)).toBe(120)
    })

    it('INVARIANT: the page action passes the shown variance through and reports the applied one', async () => {
        const { actor, cotton } = await seedOrg('Action Adjust Org')
        ctx.actor = actor
        const audit = await draft(actor, yesterday)
        await count(actor, audit, 'fabric', cotton, 96)
        const refused = await actions.applyAuditAdjustmentAction({ auditId: audit, itemType: 'fabric', itemId: cotton, physicalCount: 96, expectedVariance: -1, reason: 'Recount' })
        expect('error' in refused && refused.error).toContain('The adjustment changed since it was shown')
        const done = await actions.applyAuditAdjustmentAction({ auditId: audit, itemType: 'fabric', itemId: cotton, physicalCount: 96, expectedVariance: -4, reason: 'Recount' })
        expect(done).toEqual({ success: true, variance: -4 })
    })

    it('INVARIANT: the older five-argument call still works, so no caller breaks during the rollout', async () => {
        const { actor, cotton } = await seedOrg('Legacy Call Org')
        const audit = await draft(actor, today)
        await count(actor, audit, 'fabric', cotton, 118)
        await asUser(db, actor.userId, actor.orgId)
        const [{ result }] = await sql<{ result: { variance: number } }>("SELECT public.apply_inventory_audit_adjustment($1, 'fabric', $2, 118, 'Recount') AS result", [audit, cotton])
        expect(result.variance).toBe(-2)
    })
})
