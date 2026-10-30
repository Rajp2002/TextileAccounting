import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, freshDatabase, seedOwnerOrg, type Db } from './helpers'

// Release 2 (spec 2026-10-30 section B): every factory counts as a real customer
// unless the founder marks it; the founder's own email and its + aliases are internal.

let db: Db, founder: string, session: string
const FOUNDER_EMAIL = 'founder-fixture@example.test'

type SnapshotRow = { id: string; cohort: string; owner_name: string | null; owner_phone: string | null }
async function snapshot(orgId: string): Promise<SnapshotRow> {
    await asServiceRole(db)
    const { rows } = await db.query('SELECT public.admin_factory_snapshot($1,$2,$3,$4,$5) AS value', [founder, session, new Date().toISOString(), orgId, ''])
    return rows[0].value.rows[0]
}
async function setOwnerEmail(userId: string, email: string) {
    await asSuperuser(db)
    await db.query('UPDATE auth.users SET email=$2, email_confirmed_at=now() WHERE id=$1', [userId, email])
}

beforeAll(async () => {
    db = await freshDatabase()
    await asSuperuser(db)
    founder = randomUUID(); session = randomUUID()
    await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())', [founder, FOUNDER_EMAIL])
    await db.query("INSERT INTO public.profiles(id,role) VALUES($1,'admin')", [founder])
    await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,grant_reason,login_email) VALUES($1,true,'Synthetic isolated DB fixture',$2)", [founder, FOUNDER_EMAIL])
    await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal2')", [session, founder])
    await asServiceRole(db)
    expect((await db.query("SELECT public.admin_founder_session($1,$2,'establish') value", [founder, session])).rows[0].value).toEqual({ allowed: true })
})
afterAll(async () => { await db?.end() })

describe('reporting cohort default', () => {
    it('a factory with no classification row counts as production', async () => {
        const plain = await seedOwnerOrg(db, { tier: null })
        expect((await snapshot(plain.orgId)).cohort).toBe('production')
    })

    it("the founder's email and its + aliases are internal; look-alikes are not", async () => {
        const cases = [
            ['founder-fixture@example.test', 'internal'], ['Founder-Fixture+trial2@example.test', 'internal'],
            ['founder-fixture2@example.test', 'production'], ['founder-fixture+x@example.org', 'production'],
        ] as const
        for (const [email, cohort] of cases) {
            const org = await seedOwnerOrg(db, { tier: null })
            await setOwnerEmail(org.userId, email)
            expect((await snapshot(org.orgId)).cohort, email).toBe(cohort)
        }
    })

    it('an explicit classification still wins', async () => {
        const org = await seedOwnerOrg(db, { tier: null })
        await setOwnerEmail(org.userId, 'founder-fixture+demo@example.test')
        await asSuperuser(db)
        await db.query("INSERT INTO private.admin_org_reporting(org_id,cohort,classification_reason) VALUES($1,'test','Synthetic explicit fixture')", [org.orgId])
        expect((await snapshot(org.orgId)).cohort).toBe('test')
    })

    it('a revoked founder grant stops the alias rule', async () => {
        const org = await seedOwnerOrg(db, { tier: null })
        await setOwnerEmail(org.userId, 'founder-fixture+old@example.test')
        expect((await snapshot(org.orgId)).cohort).toBe('internal')
        await asSuperuser(db)
        await db.query('UPDATE private.platform_founder_grants SET enabled=false, revoked_at=now() WHERE user_id=$1', [founder])
        const cohort = (await db.query("SELECT private.resolve_reporting_cohort(NULL,'founder-fixture+old@example.test') AS cohort")).rows[0].cohort
        await db.query('UPDATE private.platform_founder_grants SET enabled=true, revoked_at=NULL WHERE user_id=$1', [founder])
        expect(cohort).toBe('production')
    })

    it('exposes owner name and phone', async () => {
        const org = await seedOwnerOrg(db, { tier: null })
        await asSuperuser(db)
        await db.query("UPDATE public.profiles SET full_name='Ramesh Patel', phone='+919800000001' WHERE id=$1", [org.userId])
        expect(await snapshot(org.orgId)).toMatchObject({ owner_name: 'Ramesh Patel', owner_phone: '+919800000001' })
    })

    it('billing report treats unclassified factories as production and unmapped facts as unclassified', async () => {
        const org = await seedOwnerOrg(db, { tier: null })
        await asSuperuser(db)
        const insert = (object: string, orgId: string | null) => db.query(`INSERT INTO private.admin_billing_facts(kind,provider,provider_account_id,provider_object_id,source_record_type,source_record_id,org_id,currency,amount_minor,occurred_at,time_basis,mode,verification_state,verified_at,evidence_ref)
            VALUES('capture','razorpay','synthetic',$1,'synthetic_provider_evidence',$1,$2,'INR',299900,'2026-09-15T00:00:00Z','provider_verified','live','verified',now(),'Synthetic isolated evidence')`, [object, orgId])
        await insert('pay_cohort_default', org.orgId)
        await insert('pay_unmapped', null)
        await asServiceRole(db)
        const result = (await db.query("SELECT public.admin_billing_report_input($1,$2,'2026-09-01T00:00:00Z','2026-10-01T00:00:00Z','INR',25,NULL,NULL) AS result", [founder, session])).rows[0].result
        expect(result.summary.knownGrossMinor).toBe('299900')
        const cohorts = Object.fromEntries(result.ledger.map((item: { providerObjectId: string; cohort: string }) => [item.providerObjectId, item.cohort]))
        expect(cohorts).toMatchObject({ pay_cohort_default: 'production', pay_unmapped: 'unclassified' })
    })
})
