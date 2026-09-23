/** Run against a disposable local PostgreSQL server; creates and drops its own database. */
import pg from 'pg'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const url = new URL(process.env.STOCK_TEST_DATABASE_URL)
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Local database required')
const root = new pg.Client({ connectionString: url.href })
await root.connect()
const name = `challan_terms_${Date.now()}`
await root.query(`create database ${name}`)
url.pathname = `/${name}`
const db = new pg.Client({ connectionString: url.href })
await db.connect()
const migration = readFileSync('supabase/migrations/20260922135042_restore_challan_payment_terms.sql', 'utf8')
const org = randomUUID(), actor = randomUUID(), quality = randomUUID()
const read = async id => (await db.query('select *,payment_due_date::text as due from delivery_challans where id=$1', [id])).rows[0]
const call = async (id, version, action, payload, request = randomUUID()) =>
    db.query('select mutate_delivery_challan($1,$2,$3,$4,$5)', [id, request, version, action, payload])
const body = {
    quality_id: quality, selling_rate: 44,
    document: { date: '2026-09-19', sender_name: 'Sender', sender_address: 'Address', customer_name: 'Customer', customer_address: 'Address', delivery_address: 'Address', payment_due_date: '2026-11-27', payment_terms: 'Agreed date' },
    lines: [{ lot: 'test', meters: 346 }],
}
try {
    for (const role of ['anon', 'authenticated', 'service_role']) {
        if (!(await root.query('select 1 from pg_roles where rolname=$1', [role])).rowCount) await root.query(`create role ${role}`)
    }
    await db.query(`
      create schema auth; create schema private;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select current_setting('request.jwt.claim.sub')::uuid$$;
      create table organizations(id uuid primary key);
      create table profiles(id uuid,org_id uuid,role text);
      create table quality_stock(id uuid,org_id uuid,quality_label text,meters numeric,updated_at timestamptz,primary key(org_id,id));
      create table quality_stock_movements(kind text constraint quality_stock_movements_kind_check check(kind='opening'));
      create function private.quality_stock_access(uuid) returns boolean language sql as $$select true$$;
      create function public.assert_org_not_locked(uuid) returns void language sql as $$select$$;
    `)
    await db.query('insert into organizations values($1)', [org])
    await db.query('insert into auth.users values($1)', [actor])
    await db.query("insert into profiles values($1,$2,'owner')", [actor, org])
    await db.query("insert into quality_stock values($1,$2,'Test',1000,now())", [quality, org])
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor])
    await db.query(readFileSync('supabase/migrations/20260908235614_standalone_delivery_challans.sql', 'utf8'))
    await db.query(readFileSync('supabase/migrations/20260909045727_challan_payment_terms.sql', 'utf8'))
    // Reproduce the regression using the actual later replacement, not a mock.
    const inventory = readFileSync('supabase/migrations/20260920000000_unified_inventory_audit_architecture.sql', 'utf8')
    const start = inventory.indexOf('CREATE OR REPLACE FUNCTION public.mutate_delivery_challan(')
    await db.query(inventory.slice(start, inventory.indexOf('-- 12.', start)))
    const broken = randomUUID()
    await call(broken, 0, 'save', body)
    assert.equal((await read(broken)).due, null)
    assert.equal((await read(broken)).document.payment_due_date, '2026-11-27')
    console.log('PASS reproduced saved-document / missing-summary regression')

    await db.query(migration)
    assert.equal((await read(broken)).due, '2026-11-27')
    assert.equal((await read(broken)).payment_terms, 'Agreed date')
    assert.equal(Number((await read(broken)).balance), 15224)
    const repairedVersion = (await read(broken)).version
    await db.query(migration)
    assert.equal((await read(broken)).version, repairedVersion)
    console.log('PASS repair recovers explicit terms and is idempotent')

    const fresh = randomUUID()
    await call(fresh, 0, 'save', body)
    assert.equal((await read(fresh)).due, '2026-11-27')
    await call(fresh, 1, 'save', { ...body, document: { ...body.document, payment_due_date: '' } })
    assert.equal((await read(fresh)).due, null)
    await assert.rejects(call(randomUUID(), 0, 'save', { ...body, document: { ...body.document, payment_due_date: '2026-02-30' } }))
    console.log('PASS new drafts persist dates, clear dates, and reject invalid dates')

    await db.query("update delivery_challans set delivery_status='received',paid_amount=10000 where id=$1", [broken])
    const version = (await read(broken)).version, request = randomUUID()
    const patch = { payment_due_date: '2027-01-31', payment_terms: 'Revised agreement', reason: 'Customer agreed' }
    await call(broken, version, 'payment_terms', patch, request)
    await call(broken, version, 'payment_terms', patch, request)
    assert.equal((await read(broken)).version, version + 1)
    assert.equal((await read(broken)).due, '2027-01-31')
    assert.equal(Number((await read(broken)).balance), 5224)
    const events = (await db.query("select previous_terms from delivery_challan_events where challan_id=$1 and action='payment_terms'", [broken])).rows
    assert.equal(events.length, 1)
    assert.equal(events[0].previous_terms.payment_due_date, '2026-11-27')
    await assert.rejects(call(broken, version, 'payment_terms', patch), /changed/)
    await call(broken, version + 1, 'payment_terms', { payment_due_date: '', payment_terms: '', reason: 'Remove deadline' })
    await db.query(migration)
    assert.equal((await read(broken)).due, null)
    assert.equal((await read(broken)).document.payment_due_date, '2026-11-27')
    console.log('PASS issued terms changes/clears are audited, retry-safe, and protected from backfill')
} finally {
    await db.end()
    await root.query(`drop database ${name}`)
    await root.end()
}
