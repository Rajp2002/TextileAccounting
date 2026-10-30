import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asServiceRole, asSuperuser, asUser, freshDatabase, pgError, seedOwnerOrg, type Db } from './helpers'

// Release 2 (spec 2026-10-30 section B): the founder marks a factory as test, demo,
// internal or a customer; the classification and its audit commit together.

let db: Db, founder: string, session: string

async function setCohort(orgId: string, cohort: string, sid = session, reason = 'Marked by founder') {
    await asServiceRole(db)
    return (await db.query('SELECT public.admin_set_org_cohort($1,$2,$3,$4,$5,$6) AS value', [founder, sid, orgId, cohort, reason, randomUUID()])).rows[0].value
}
async function storedCohort(orgId: string): Promise<string | undefined> {
    await asSuperuser(db)
    return (await db.query('SELECT cohort FROM private.admin_org_reporting WHERE org_id=$1', [orgId])).rows[0]?.cohort
}

beforeAll(async () => {
    db = await freshDatabase()
    await asSuperuser(db)
    founder = randomUUID(); session = randomUUID()
    await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'founder-fixture@example.test',now())", [founder])
    await db.query("INSERT INTO public.profiles(id,role) VALUES($1,'admin')", [founder])
    await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,grant_reason,login_email) VALUES($1,true,'Synthetic isolated DB fixture','founder-fixture@example.test')", [founder])
    await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal2')", [session, founder])
    await asServiceRole(db)
    expect((await db.query("SELECT public.admin_founder_session($1,$2,'establish') value", [founder, session])).rows[0].value).toEqual({ allowed: true })
})
afterAll(async () => { await db?.end() })

describe('admin_set_org_cohort', () => {
    it('upserts the cohort and audits in the same transaction', async () => {
        const org = await seedOwnerOrg(db, { tier: null })
        expect(await setCohort(org.orgId, 'test')).toEqual({ orgId: org.orgId, cohort: 'test' })
        expect(await storedCohort(org.orgId)).toBe('test')
        expect(await setCohort(org.orgId, 'production', session, 'Real factory after all')).toEqual({ orgId: org.orgId, cohort: 'production' })
        expect(await storedCohort(org.orgId)).toBe('production')
        await asSuperuser(db)
        const audits = (await db.query("SELECT before_safe, after_safe FROM private.admin_audit_events WHERE action='factory.cohort.set' AND target_id=$1 ORDER BY occurred_at, id", [org.orgId])).rows
        expect(audits).toEqual([
            { before_safe: { cohort: 'production' }, after_safe: { cohort: 'test' } },
            { before_safe: { cohort: 'test' }, after_safe: { cohort: 'production' } },
        ])
    })

    it('refuses a non-founder session, unknown cohorts and missing factories', async () => {
        const org = await seedOwnerOrg(db, { tier: null })
        expect((await pgError(setCohort(org.orgId, 'test', randomUUID()))).code).toBe('42501')
        expect((await pgError(setCohort(org.orgId, 'unclassified'))).code).toBe('22023')
        expect((await pgError(setCohort(randomUUID(), 'test'))).code).toBe('P0002')
        await asUser(db, org.userId, org.orgId)
        expect((await pgError(db.query('SELECT public.admin_set_org_cohort($1,$2,$3,$4,$5,$6)', [founder, session, org.orgId, 'test', 'x', randomUUID()]))).code).toBe('42501')
    })

    it('rolls back the classification when the audit fails', async () => {
        const org = await seedOwnerOrg(db, { tier: null })
        await asSuperuser(db)
        await db.query("CREATE FUNCTION private.test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Synthetic audit failure';END$$; CREATE TRIGGER test_reject_audit BEFORE INSERT ON private.admin_audit_events FOR EACH ROW EXECUTE FUNCTION private.test_reject_audit()")
        expect((await pgError(setCohort(org.orgId, 'demo'))).message).toContain('Synthetic audit failure')
        await asSuperuser(db)
        await db.query('DROP TRIGGER test_reject_audit ON private.admin_audit_events; DROP FUNCTION private.test_reject_audit()')
        expect(await storedCohort(org.orgId)).toBeUndefined()
    })
})
