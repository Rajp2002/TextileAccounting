import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'
import { createTestSupabase } from './supabase-adapter'

// Fix package F1 (OS-1, OS-2): the inventory audit board, draft audits and
// physical counts, executed against the replayed schema including
// 20260926132159 and 20260926132310. Before F1 the board failed with 42803 and
// owners could not create audits or record counts (EVIDENCE E12, E17).

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

let db: Db
let owner: Actor
let today: string
let yesterday: string
let cotton: string
let yarn: string

type Board = {
    audit: { id: string; status: string } | null
    lines: { item_type: string; item_id: string; system_quantity: number; physical_count: number; variance: number }[]
    fabric: { id: string; quality_label: string; system_meters: number }[]
    yarns: { id: string; yarn_name: string; system_loose_kg: number }[]
    summary: { total_fabric_meters: number; total_loose_yarn_kg: number }
}

async function board(actor: Actor, date: string, auditId: string | null = null) {
    await asUser(db, actor.userId, actor.orgId)
    const { rows } = await db.query('SELECT public.get_inventory_audit_data($1, $2) AS board', [date, auditId])
    return rows[0].board as Board
}

async function createDraft(actor: Actor, date: string) {
    await asUser(db, actor.userId, actor.orgId)
    const { rows } = await db.query("SELECT public.create_inventory_audit_draft($1, 'Stock Audit', NULL) AS result", [date])
    return rows[0].result as { audit_id: string; created: boolean }
}

async function recordCount(actor: Actor, auditId: string, itemType: string, itemId: string, count: number) {
    await asUser(db, actor.userId, actor.orgId)
    const { rows } = await db.query('SELECT public.record_inventory_audit_count($1, $2, $3, $4, NULL) AS result', [auditId, itemType, itemId, count])
    return rows[0].result as { system_quantity: number; physical_count: number; variance: number }
}

async function seedStock(actor: Actor) {
    await asUser(db, actor.userId, actor.orgId)
    await db.query("SELECT public.record_quality_stock_adjustment('Cotton Poplin', 120.5, 'opening', 'Physical count', $1)", [randomUUID()])
    await db.query("SELECT public.record_quality_stock_adjustment('Rayon Slub', 30, 'opening', 'Physical count', $1)", [randomUUID()])
    await asSuperuser(db)
    const { rows: [yarnRow] } = await db.query("INSERT INTO public.yarn_stock(org_id, yarn_name, weight_kg) VALUES ($1, '40s Cotton', 74) RETURNING id", [actor.orgId])
    await db.query("INSERT INTO public.yarn_stock_movements(org_id, yarn_id, kind, kg_delta, balance_after, reason) VALUES ($1, $2, 'opening', 74, 74, 'Opening stock')", [actor.orgId, yarnRow.id])
    const { rows: [quality] } = await db.query("SELECT id FROM public.quality_stock WHERE org_id = $1 AND quality_key = 'cotton poplin'", [actor.orgId])
    return { cotton: quality.id as string, yarn: yarnRow.id as string }
}

beforeAll(async () => {
    db = await freshDatabase()
    ctx.db = db
    owner = await seedOwnerOrg(db, { tier: 'base' })
    ;({ cotton, yarn } = await seedStock(owner))
    const { rows } = await db.query(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today,
        ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1)::text AS yesterday`)
    ;({ today, yesterday } = rows[0])
})
afterAll(async () => { await db?.end() })

describe('inventory audit board (OS-1 fixed)', () => {
    it('INVARIANT: the board loads without an audit id and lists stock as of the audit date', async () => {
        const data = await board(owner, today)
        expect(data.audit).toBeNull()
        expect(data.lines).toEqual([])
        expect(data.fabric.map(item => [item.quality_label, item.system_meters])).toEqual([['Cotton Poplin', 120.5], ['Rayon Slub', 30]])
        expect(data.yarns.map(item => [item.yarn_name, item.system_loose_kg])).toEqual([['40s Cotton', 74]])
        expect(data.summary).toMatchObject({ total_fabric_meters: 150.5, total_loose_yarn_kg: 74 })
    })

    it('INVARIANT: movements after the audit date are excluded (as-of cutoff)', async () => {
        const data = await board(owner, yesterday)
        expect(data.fabric.map(item => item.system_meters)).toEqual([0, 0])
        expect(data.yarns.map(item => item.system_loose_kg)).toEqual([0])
    })
})

describe('draft audits and physical counts (OS-2 fixed)', () => {
    let auditId: string

    it('INVARIANT: an owner opens one draft per date; repeating returns the same draft', async () => {
        const first = await createDraft(owner, today)
        const again = await createDraft(owner, today)
        expect(first.created).toBe(true)
        expect(again).toEqual({ audit_id: first.audit_id, created: false })
        auditId = first.audit_id
        expect((await board(owner, today)).audit).toMatchObject({ id: auditId, status: 'draft' })
    })

    it('INVARIANT: a count stores the server-side system quantity and the variance; recounting replaces it', async () => {
        expect(await recordCount(owner, auditId, 'fabric', cotton, 118)).toMatchObject({ system_quantity: 120.5, physical_count: 118, variance: -2.5 })
        await recordCount(owner, auditId, 'fabric', cotton, 119)
        await recordCount(owner, auditId, 'yarn', yarn, 74)
        const lines = (await board(owner, today, auditId)).lines
        expect(lines.map(line => [line.item_type, line.physical_count, line.variance])).toEqual([['fabric', 119, -1.5], ['yarn', 74, 0]])
    })

    it('INVARIANT: owners still cannot write audit tables directly', async () => {
        await asUser(db, owner.userId, owner.orgId)
        const error = await pgError(db.query('INSERT INTO public.inventory_audits(org_id) VALUES ($1)', [owner.orgId]))
        expect(error.code).toBe('42501')
    })

    it('INVARIANT: other organizations, Lite owners, locked organizations and future dates are refused', async () => {
        const other = await seedOwnerOrg(db, { tier: 'base', name: 'Other Base' })
        expect((await pgError(recordCount(other, auditId, 'fabric', cotton, 1))).message).toBe('Inventory audit not found')
        const lite = await seedOwnerOrg(db, { tier: 'lite', name: 'Lite Org' })
        expect((await pgError(createDraft(lite, today))).code).toBe('42501')
        const locked = await seedOwnerOrg(db, { tier: 'base', locked: true, name: 'Locked Org' })
        expect((await pgError(createDraft(locked, today))).message).toContain('organization is locked')
        const { rows: [{ tomorrow }] } = await db.query("SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date + 1)::text AS tomorrow")
        expect((await pgError(createDraft(owner, tomorrow))).message).toBe('Choose an audit date that is not in the future')
    })

    it('INVARIANT: a count already applied to stock cannot be recorded again', async () => {
        const draft = await createDraft(owner, yesterday)
        await recordCount(owner, draft.audit_id, 'fabric', cotton, 0)
        await asUser(db, owner.userId, owner.orgId)
        await db.query("SELECT public.apply_inventory_audit_adjustment($1, 'fabric', $2, 110, 'Recount')", [draft.audit_id, cotton])
        const error = await pgError(recordCount(owner, draft.audit_id, 'fabric', cotton, 5))
        expect(error.message).toBe('This count was already applied to stock. Start a new audit to count it again.')
    })

    it('INVARIANT: finalizing snapshots the audit, after which counts are refused', async () => {
        await asUser(db, owner.userId, owner.orgId)
        const { rows: [{ result }] } = await db.query('SELECT public.finalize_inventory_audit($1) AS result', [auditId])
        expect(result).toMatchObject({ success: true, status: 'finalized' })
        await asSuperuser(db)
        const { rows: [audit] } = await db.query('SELECT status, snapshot IS NOT NULL AS has_snapshot FROM public.inventory_audits WHERE id = $1', [auditId])
        expect(audit).toEqual({ status: 'finalized', has_snapshot: true })
        expect((await pgError(recordCount(owner, auditId, 'fabric', cotton, 1))).message).toBe('Finalized audit cannot be changed')
    })
})

describe('inventory audit server actions, end to end', () => {
    it('INVARIANT: the page loader, draft creation and count actions work for an owner', async () => {
        const actor = await seedOwnerOrg(db, { tier: 'base', name: 'Action Org' })
        const stock = await seedStock(actor)
        ctx.actor = actor

        const loaded = await actions.getInventoryAuditDataAction()
        expect('data' in loaded && loaded.data.fabric.length).toBe(2)

        const draft = await actions.createInventoryAuditAction({ auditDate: today, title: 'Stock Audit' })
        expect('auditId' in draft).toBe(true)
        const auditId = (draft as { auditId: string }).auditId

        const saved = await actions.saveAuditPhysicalCountAction({
            auditId, itemType: 'fabric', itemId: stock.cotton, itemLabel: 'ignored by the server', systemQuantity: 999, physicalCount: 100,
        })
        expect(saved).toEqual({ success: true })

        const reloaded = await actions.getInventoryAuditDataAction({ auditDate: today })
        const lines = 'data' in reloaded ? reloaded.data.lines : []
        expect(lines).toHaveLength(1)
        expect(lines[0]).toMatchObject({ item_label: 'Cotton Poplin', system_quantity: 120.5, physical_count: 100, variance: -20.5 })
    })
})
