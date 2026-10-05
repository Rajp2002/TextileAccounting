import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase, seedOwnerOrg, type Db } from './helpers'

let db: Db
const report = readFileSync('docs/admin-console/FOUNDER_TEST_FACTORY_BILLING_STORAGE.sql', 'utf8')
type Fixture = { userId: string; orgId: string }
type Row = { section: string; evidence: Record<string, unknown> }
function fixtureSql(owner: Fixture) {
    return report.replaceAll('d0e56517-29f9-474f-b368-9e63e84da25a', owner.userId)
        .replaceAll('2420a5a8-d231-4ed2-b9ce-9db986e38879', owner.orgId)
        .replaceAll('rajpatel86420@gmail.com', 'synthetic-billing-inspection@example.test')
}
async function fixture() {
    const owner = await seedOwnerOrg(db, { tier: null, name: 'test' })
    await db.query('UPDATE auth.users SET email=$2,email_confirmed_at=now() WHERE id=$1', [owner.userId, 'synthetic-billing-inspection@example.test'])
    await db.query('DELETE FROM public.profiles WHERE id=$1', [owner.userId])
    return owner
}
async function rows(owner: Fixture): Promise<Row[]> {
    await db.query('BEGIN READ ONLY')
    try { return (await db.query(fixtureSql(owner))).rows } finally { await db.query('ROLLBACK') }
}
beforeAll(async () => { db = await freshDatabase() })
afterAll(async () => { await db?.end() })

describe('read-only founder test-factory payment and Storage follow-up', () => {
    it('shows safe recorded payment/term evidence without inferring mode, altering records or leaking provider payloads', async () => {
        const owner = await fixture()
        const payment = randomUUID()
        const term = randomUUID()
        await db.query("INSERT INTO public.org_subscriptions(id,org_id,plan_tier,status,paid_count) VALUES($1,$2,'base','active',1)", [term, owner.orgId])
        await db.query("INSERT INTO public.subscription_payments(id,org_id,subscription_id,razorpay_payment_id,amount_paise,status) VALUES($1,$2,$3,'synthetic_reference',299900,'captured')", [payment, owner.orgId, term])
        await db.query('ALTER TABLE public.subscription_payments ADD COLUMN synthetic_secret text')
        try {
            await db.query("UPDATE public.subscription_payments SET synthetic_secret='SECRET PROVIDER PAYLOAD' WHERE id=$1", [payment])
            const before = (await db.query('SELECT row_to_json(p) AS value FROM public.subscription_payments p WHERE id=$1', [payment])).rows[0].value
            const result = await rows(owner)
            expect(result.find(r => r.section === 'assertion')?.evidence.verified).toBe(true)
            expect(result.find(r => r.section === 'payment')?.evidence).toMatchObject({ id: payment, status: 'captured', amount_paise: '299900', mode: null, currency: null, razorpay_payment_id: 'synthetic_reference', subscription_id: term })
            expect(result.find(r => r.section === 'subscription')?.evidence).toMatchObject({ id: term, status: 'active', paid_count: 1, plan_tier: 'base' })
            expect(result.find(r => r.section === 'bounds')?.evidence).toEqual({ payment_rows_upto_101: 1, subscription_rows_upto_101: 1, overflow: false })
            expect(JSON.stringify(result)).not.toContain('SECRET PROVIDER PAYLOAD')
            expect((await db.query('SELECT row_to_json(p) AS value FROM public.subscription_payments p WHERE id=$1', [payment])).rows[0].value).toEqual(before)
        } finally { await db.query('ALTER TABLE public.subscription_payments DROP COLUMN synthetic_secret') }
        expect((await db.query('SELECT id FROM auth.users WHERE id=$1', [owner.userId])).rowCount).toBe(1)
        expect((await db.query('SELECT id FROM public.organizations WHERE id=$1', [owner.orgId])).rowCount).toBe(1)
    })
    it('counts owner and UUID-prefix Storage links up to 101 without exposing file names or metadata', async () => {
        const owner = await fixture()
        await db.query("INSERT INTO storage.objects(id,bucket_id,name,owner,metadata) SELECT gen_random_uuid(),'synthetic',i::text || '.txt',$1,'{\"secret\":\"SECRET STORAGE METADATA\"}'::jsonb FROM generate_series(1,105)i", [owner.userId])
        const result = await rows(owner)
        expect(result.find(r => r.section === 'storage')?.evidence).toMatchObject({ matching_objects_upto_101: 101, more_than_100: true, ownership_columns: ['owner'] })
        expect(JSON.stringify(result)).not.toContain('SECRET STORAGE METADATA')
        expect((await db.query('SELECT id FROM storage.objects WHERE owner=$1', [owner.userId])).rowCount).toBe(105)
        const prefix = await fixture()
        await db.query('INSERT INTO storage.objects(id,bucket_id,name) VALUES($1,$2,$3)', [randomUUID(), 'synthetic', `${prefix.orgId}/private.txt`])
        expect((await rows(prefix)).find(r => r.section === 'storage')?.evidence).toMatchObject({ matching_objects_upto_101: 1, more_than_100: false })
    })
    it('handles current owner_id Storage mappings independently of legacy owner', async () => {
        await db.query('ALTER TABLE storage.objects ADD COLUMN owner_id text')
        try {
            const owner = await fixture()
            await db.query('INSERT INTO storage.objects(id,bucket_id,name,owner_id) VALUES($1,$2,$3,$4)', [randomUUID(), 'synthetic', 'unrelated/path.txt', owner.userId])
            expect((await rows(owner)).find(r => r.section === 'storage')?.evidence).toMatchObject({ matching_objects_upto_101: 1, ownership_columns: ['owner', 'owner_id'] })
        } finally { await db.query('ALTER TABLE storage.objects DROP COLUMN owner_id') }
    })
    it('reports unavailable ownership mapping instead of a plausible empty Storage count', async () => {
        await db.query('ALTER TABLE storage.objects RENAME COLUMN owner TO synthetic_unknown_owner')
        try {
            const owner = await fixture()
            expect((await rows(owner)).find(r => r.section === 'storage')?.evidence).toMatchObject({ ownership_status: 'unavailable', matching_objects_upto_101: null, more_than_100: null, ownership_columns: [] })
        } finally { await db.query('ALTER TABLE storage.objects RENAME COLUMN synthetic_unknown_owner TO owner') }
    })
    it('does not report payment or Storage data after any exact-target/profile assertion fails', async () => {
        const owner = await fixture()
        await db.query('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1', [owner.userId])
        const result = await rows(owner)
        expect(result).toEqual([{ section: 'assertion', evidence: { verified: false, detail: 'Target/identity/profile/operator assertion failed. Stop; nothing changed.' } }])
        await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1', [owner.userId])
        expect(await rows({ ...owner, orgId: randomUUID() })).toEqual(result)
        await db.query("INSERT INTO public.profiles(id,org_id,role) VALUES($1,NULL,'admin')", [owner.userId])
        expect(await rows(owner)).toEqual(result)
    })
})
