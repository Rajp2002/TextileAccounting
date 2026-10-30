import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Release 2 (spec 2026-10-30 section C2): paid-plans state and "Notify me" interest.

let db: Db

async function state(orgId: string) {
    await asServiceRole(db)
    return (await db.query('SELECT public.paid_plans_state($1) AS value', [orgId])).rows[0].value
}
async function interest(orgId: string, userId: string, source: string): Promise<number> {
    await asServiceRole(db)
    return (await db.query('SELECT public.record_paid_plan_interest($1,$2,$3) AS taps', [orgId, userId, source])).rows[0].taps
}

beforeAll(async () => { db = await freshDatabase() })
afterAll(async () => { await db?.end() })

describe('paid plans state', () => {
    it('starts closed and reports test accounts', async () => {
        const plain = await seedOwnerOrg(db, { tier: null })
        const marked = await seedOwnerOrg(db, { tier: null })
        await asSuperuser(db)
        await db.query("INSERT INTO private.admin_org_reporting(org_id,cohort,classification_reason) VALUES($1,'test','Synthetic test account')", [marked.orgId])
        expect(await state(plain.orgId)).toEqual({ goLiveAt: null, testAccount: false })
        expect(await state(marked.orgId)).toEqual({ goLiveAt: null, testAccount: true })
    })

    it('test checkout needs an explicit marking: a founder + alias alone is not enough', async () => {
        const founder = await seedOwnerOrg(db, { tier: null })
        await asSuperuser(db)
        await db.query("UPDATE auth.users SET email='founder-fixture@example.test' WHERE id=$1", [founder.userId])
        await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,grant_reason,login_email) VALUES($1,true,'Synthetic grant','founder-fixture@example.test')", [founder.userId])
        const alias = await seedOwnerOrg(db, { tier: null })
        await asSuperuser(db)
        await db.query("UPDATE auth.users SET email='founder-fixture+x@example.test' WHERE id=$1", [alias.userId])
        expect(await state(alias.orgId)).toEqual({ goLiveAt: null, testAccount: false })
        await asSuperuser(db)
        await db.query("INSERT INTO private.admin_org_reporting(org_id,cohort,classification_reason) VALUES($1,'internal','Marked by founder')", [alias.orgId])
        expect(await state(alias.orgId)).toEqual({ goLiveAt: null, testAccount: true })
    })

    it('records interest once per org and counts taps', async () => {
        const org = await seedOwnerOrg(db, { tier: null })
        expect(await interest(org.orgId, org.userId, 'billing')).toBe(1)
        await asSuperuser(db)
        const first = (await db.query('SELECT first_at FROM private.paid_plan_interest WHERE org_id=$1', [org.orgId])).rows[0].first_at
        expect(await interest(org.orgId, org.userId, 'plan_card')).toBe(2)
        await asSuperuser(db)
        const row = (await db.query('SELECT first_at, last_source, taps FROM private.paid_plan_interest WHERE org_id=$1', [org.orgId])).rows[0]
        expect(row).toMatchObject({ first_at: first, last_source: 'plan_card', taps: 2 })
        expect((await pgError(interest(org.orgId, org.userId, 'email'))).code).toBe('23514')
    })

    it('is service-role only', async () => {
        const org = await seedOwnerOrg(db, { tier: null })
        await asUser(db, org.userId, org.orgId)
        expect((await pgError(db.query('SELECT public.paid_plans_state($1)', [org.orgId]))).code).toBe('42501')
        expect((await pgError(db.query("SELECT public.record_paid_plan_interest($1,$2,'billing')", [org.orgId, org.userId]))).code).toBe('42501')
        expect((await pgError(db.query('SELECT * FROM private.paid_plans_state'))).code).toBe('42501')
    })
})
