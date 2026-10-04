import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asSuperuser, freshDatabase, seedOwnerOrg, type Db } from './helpers'

let db: Db
const draft = readFileSync('docs/admin-console/FOUNDER_TEST_FACTORY_INSPECT.sql', 'utf8')
function fixtureSql(id: string) {
    // Substitute synthetic identity values; never seed the supplied real UUID/email.
    return draft.replaceAll('d0e56517-29f9-474f-b368-9e63e84da25a', id).replaceAll('rajpatel86420@gmail.com', 'synthetic-inspector@example.test')
}
beforeAll(async () => { db = await freshDatabase() })
afterAll(async () => { await db?.end() })
async function identity(id: string, confirmed = true) {
    await db.query('UPDATE auth.users SET email=$2,email_confirmed_at=$3 WHERE id=$1', [id, 'synthetic-inspector@example.test', confirmed ? new Date().toISOString() : null])
}
describe('read-only founder test-factory source inspector', () => {
    it('reads bounded dependency counts with a missing profile while preserving every Auth and factory row', async () => {
        const owner = await seedOwnerOrg(db, { tier: null, name: 'Synthetic test factory' })
        await identity(owner.userId)
        await db.query('DELETE FROM public.profiles WHERE id=$1', [owner.userId])
        await db.query("INSERT INTO public.grievances(org_id,subject,description,status)SELECT $1,'Synthetic retained question','SECRET CUSTOMER BODY','pending' FROM generate_series(1,105)", [owner.orgId])
        const authBefore = (await db.query('SELECT row_to_json(u) AS value FROM auth.users u WHERE id=$1', [owner.userId])).rows[0].value
        const notices: string[] = []
        const listener = (notice: { message?: string }) => notices.push(notice.message ?? '')
        db.on('notice', listener)
        try { await db.query(fixtureSql(owner.userId)) } finally { db.off('notice', listener) }
        expect(notices.join('\n')).toContain(owner.orgId)
        expect(notices.some(n => n.includes('public.grievances') && n.includes('"countUpTo101": 101') && n.includes('"moreThan100": true'))).toBe(true)
        expect(notices.some(n => n.includes('"present": false'))).toBe(true)
        expect(notices.join('\n')).not.toContain('SECRET CUSTOMER BODY')
        expect((await db.query('SELECT row_to_json(u) AS value FROM auth.users u WHERE id=$1', [owner.userId])).rows[0].value).toEqual(authBefore)
        expect((await db.query('SELECT id FROM public.organizations WHERE id=$1', [owner.orgId])).rowCount).toBe(1)
        expect((await db.query('SELECT id FROM public.grievances WHERE org_id=$1', [owner.orgId])).rowCount).toBe(105)
    })
    it('refuses an unconfirmed identity before reporting a factory target', async () => {
        const owner = await seedOwnerOrg(db, { tier: null }); await identity(owner.userId, false)
        await expect(db.query(fixtureSql(owner.userId))).rejects.toMatchObject({ message: 'Confirmed Auth UUID/email assertion failed. Stop; nothing was changed.' })
        await db.query('ROLLBACK'); await asSuperuser(db)
        expect((await db.query('SELECT id FROM auth.users WHERE id=$1', [owner.userId])).rowCount).toBe(1)
    })
    it('refuses ambiguous organization ownership and changes nothing', async () => {
        const owner = await seedOwnerOrg(db, { tier: null }); await identity(owner.userId)
        await db.query("INSERT INTO public.organizations(name,owner_id)VALUES('Other synthetic test factory',$1)", [owner.userId])
        await expect(db.query(fixtureSql(owner.userId))).rejects.toMatchObject({ message: 'Expected exactly one owned test factory; found 2 (bounded at2). Stop for target review.' })
        await db.query('ROLLBACK'); await asSuperuser(db)
        expect((await db.query('SELECT id FROM public.organizations WHERE owner_id=$1', [owner.userId])).rowCount).toBe(2)
    })
})
