import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase, seedOwnerOrg, type Db } from './helpers'

let db: Db
const report = readFileSync('docs/admin-console/FOUNDER_TEST_FACTORY_DEPENDENCIES.sql', 'utf8')
type Row = { section: string; source: string; scope: string; status: string; count_upto_101: number | null; more_than_100: boolean | null; detail: string }
function fixtureSql(owner: { userId: string; orgId: string }) {
    return report.replaceAll('d0e56517-29f9-474f-b368-9e63e84da25a', owner.userId)
        .replaceAll('2420a5a8-d231-4ed2-b9ce-9db986e38879', owner.orgId)
        .replaceAll('rajpatel86420@gmail.com', 'synthetic-dependencies@example.test')
}
async function fixture() {
    const owner = await seedOwnerOrg(db, { tier: null, name: 'test' })
    await db.query("UPDATE auth.users SET email='synthetic-dependencies@example.test',email_confirmed_at=now() WHERE id=$1", [owner.userId])
    await db.query('DELETE FROM public.profiles WHERE id=$1', [owner.userId])
    return owner
}
async function rows(owner: { userId: string; orgId: string }): Promise<Row[]> {
    return (await db.query(fixtureSql(owner))).rows
}
beforeAll(async () => { db = await freshDatabase() })
afterAll(async () => { await db?.end() })

describe('SQL Editor founder test factory result-row dependency report', () => {
    it('returns bounded actual counts and preserves Auth, factory and retained source rows', async () => {
        const owner = await fixture()
        await db.query("UPDATE auth.users SET email=' SYNTHETIC-DEPENDENCIES@EXAMPLE.TEST ' WHERE id=$1", [owner.userId])
        await db.query("INSERT INTO public.grievances(org_id,subject,description,status) SELECT $1,'Synthetic retained issue','SECRET TICKET CONTENT','pending' FROM generate_series(1,105)", [owner.orgId])
        const authBefore = (await db.query('SELECT row_to_json(u) AS value FROM auth.users u WHERE id=$1', [owner.userId])).rows[0].value
        const orgBefore = (await db.query('SELECT row_to_json(o) AS value FROM public.organizations o WHERE id=$1', [owner.orgId])).rows[0].value
        // A read-only transaction independently prevents accidental writes.
        await db.query('BEGIN READ ONLY')
        let result: Row[]
        const started = performance.now()
        try { result = await rows(owner) } finally { await db.query('ROLLBACK') }
        const elapsedMs = Math.ceil(performance.now() - started)
        const budget = result.find(r => r.source === 'catalogue_budget')
        console.info(`Synthetic dependency report: ${result.length} result rows; query ${elapsedMs}ms; ${budget?.detail}`)
        expect(result.filter(r => r.section === 'coverage' && r.source === 'catalogue')).toEqual([])
        expect(result.find(r => r.section === 'assertion')).toMatchObject({ status: 'verified', count_upto_101: null })
        expect(result.find(r => r.section === 'canonical_uuid' && r.source === 'public.grievances')).toMatchObject({ status: 'measured', count_upto_101: 101, more_than_100: true })
        expect(result.find(r => r.section === 'foreign_key' && r.source === 'public.grievances')).toMatchObject({ count_upto_101: 101 })
        expect(result.find(r => r.section === 'canonical_uuid' && r.source === 'public.subscription_payments')).toMatchObject({ status: 'measured', count_upto_101: 0, more_than_100: false })
        expect(result.find(r => r.source === 'catalogue')).toBeUndefined()
        expect(JSON.stringify(result)).not.toContain('SECRET TICKET CONTENT')
        expect((await db.query('SELECT row_to_json(u) AS value FROM auth.users u WHERE id=$1', [owner.userId])).rows[0].value).toEqual(authBefore)
        expect((await db.query('SELECT row_to_json(o) AS value FROM public.organizations o WHERE id=$1', [owner.orgId])).rows[0].value).toEqual(orgBefore)
        expect((await db.query('SELECT id FROM public.grievances WHERE org_id=$1', [owner.orgId])).rowCount).toBe(105)
    })
    it('quotes catalogue table identifiers and keeps shared Free owner scope separate', async () => {
        const owner = await fixture()
        await db.query('CREATE TABLE public."synthetic odd\'\"\" table"(org_id uuid REFERENCES public.organizations(id))')
        await db.query('INSERT INTO public."synthetic odd\'\"\" table" VALUES($1)', [owner.orgId])
        await db.query('INSERT INTO public.free_account_subjects(id) VALUES($1)', [owner.userId])
        await db.query('INSERT INTO public.free_account_grants(org_id,subject_id) VALUES($1,$2)', [owner.orgId, owner.userId])
        const result = await rows(owner)
        expect(result.find(r => r.section === 'foreign_key' && r.source.includes('synthetic odd'))).toMatchObject({ status: 'measured', count_upto_101: 1 })
        expect(result.find(r => r.section === 'fixed_reference' && r.source === 'public.free_account_grants')).toMatchObject({ scope: 'shared_owner_account_preserve', count_upto_101: 1 })
        expect((await db.query('SELECT id FROM public.free_account_subjects WHERE id=$1', [owner.userId])).rowCount).toBe(1)
    })
    it('reports missing optional sources as unavailable rather than a trusted zero', async () => {
        const owner = await fixture()
        await db.query('ALTER TABLE private.admin_audit_events RENAME TO admin_audit_events_report_fixture')
        try {
            const result = await rows(owner)
            expect(result.find(r => r.section === 'source_coverage' && r.source === 'private.admin_audit_events')).toMatchObject({ status: 'unavailable', count_upto_101: null, more_than_100: null })
        } finally { await db.query('ALTER TABLE private.admin_audit_events_report_fixture RENAME TO admin_audit_events') }
    })
    it('does not execute dependency queries when the identity or exact target assertion changes', async () => {
        const owner = await fixture()
        await db.query('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1', [owner.userId])
        expect(await rows(owner)).toEqual([expect.objectContaining({ status: 'assertion_failed', count_upto_101: null, detail: 'confirmed_identity_mismatch' })])
        await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1', [owner.userId])
        const wrongTarget = { ...owner, orgId: randomUUID() }
        expect(await rows(wrongTarget)).toEqual([expect.objectContaining({ status: 'assertion_failed', detail: 'exact_factory_owner_or_name_mismatch' })])
    })
    it('fails closed when the missing-profile and empty-membership screenshot assumptions change', async () => {
        const owner = await fixture()
        const peer = randomUUID()
        await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [peer, `${peer}@example.test`])
        await db.query("INSERT INTO public.profiles(id,org_id,role,full_name) VALUES($1,$2,'owner','Synthetic peer')", [peer, owner.orgId])
        expect(await rows(owner)).toEqual([expect.objectContaining({ status: 'assertion_failed', detail: 'factory_member_profiles_present' })])
        await db.query('DELETE FROM public.profiles WHERE id=$1', [peer])
        await db.query("INSERT INTO public.profiles(id,org_id,role,full_name) VALUES($1,NULL,'admin','Synthetic founder')", [owner.userId])
        expect(await rows(owner)).toEqual([expect.objectContaining({ status: 'assertion_failed', detail: 'founder_profile_no_longer_missing' })])
        expect((await db.query('SELECT id FROM auth.users WHERE id=$1', [owner.userId])).rowCount).toBe(1)
    })
})
