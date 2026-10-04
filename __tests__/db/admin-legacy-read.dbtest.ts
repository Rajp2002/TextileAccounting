import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asUser, freshDatabase, seedOwnerOrg, type Db } from './helpers'

let db: Db
let owner: { userId: string; orgId: string }
const ids = Array.from({ length: 5 }, () => randomUUID()).sort().reverse()
const instant = '2026-10-04T00:00:00.000Z'

beforeAll(async () => {
    db = await freshDatabase(); owner = await seedOwnerOrg(db, { tier: null })
    for (let index = 0; index < ids.length; index++) await db.query("INSERT INTO public.grievances(id,org_id,subject,status,created_at) VALUES($1,$2,'Synthetic retained request','pending',$3)", [ids[index], owner.orgId, index < 2 ? instant : index === 2 ? '2026-10-03T00:00:00Z' : null])
})
afterAll(async () => { await db?.end() })

describe('read-only formal register pagination on the migrated isolated database', () => {
    it('creates the five matching tuple indexes without data or access changes', async () => {
        await asSuperuser(db)
        const indexes = await db.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname=ANY($1::text[]) ORDER BY indexname", [[
            'admin_grievances_recorded_page_idx', 'admin_security_incidents_recorded_page_idx', 'admin_dpas_recorded_page_idx', 'admin_notices_recorded_page_idx', 'admin_dpa_bindings_recorded_page_idx',
        ]])
        expect(indexes.rows).toHaveLength(5)
        for (const item of indexes.rows) expect(item.indexdef).toContain('created_at DESC NULLS LAST, id DESC')
        expect(indexes.rows.find((item: { indexname: string }) => item.indexname === 'admin_dpa_bindings_recorded_page_idx')?.indexdef).toContain('(dpa_id, created_at')
    })
    it('independent SQL pages tied timestamps and nullable dates without missing or duplicate records', async () => {
        await asServiceRole(db)
        const all = (await db.query('SELECT id,created_at FROM public.grievances WHERE org_id=$1 ORDER BY created_at DESC NULLS LAST,id DESC', [owner.orgId])).rows
        const first = (await db.query('SELECT id,created_at FROM public.grievances WHERE org_id=$1 ORDER BY created_at DESC NULLS LAST,id DESC LIMIT 1', [owner.orgId])).rows
        const datedTail = (await db.query('SELECT id,created_at FROM public.grievances WHERE org_id=$1 AND (created_at < $2::timestamptz OR (created_at = $2::timestamptz AND id < $3::uuid) OR created_at IS NULL) ORDER BY created_at DESC NULLS LAST,id DESC LIMIT 3', [owner.orgId, first[0].created_at, first[0].id])).rows
        expect(datedTail[2].created_at).toBeNull()
        const undatedTail = (await db.query('SELECT id,created_at FROM public.grievances WHERE org_id=$1 AND created_at IS NULL AND id < $2::uuid ORDER BY created_at DESC NULLS LAST,id DESC LIMIT 3', [owner.orgId, datedTail[2].id])).rows
        const paged = [...first, ...datedTail, ...undatedTail]
        expect(paged.map(item => item.id)).toEqual(all.map((item: { id: string }) => item.id)); expect(new Set(paged.map(item => item.id)).size).toBe(5)
    })
    it('index additions do not let a generic admin read the security incident table', async () => {
        await asUser(db, owner.userId, owner.orgId, 'admin')
        await expect(db.query('SELECT id,title,status,created_at FROM public.security_incidents ORDER BY created_at DESC NULLS LAST,id DESC LIMIT 25')).rejects.toMatchObject({ code: '42501' })
        await asSuperuser(db)
        expect((await db.query('SELECT count(*)::integer AS count FROM public.grievances WHERE org_id=$1', [owner.orgId])).rows[0].count).toBe(5)
    })
})
