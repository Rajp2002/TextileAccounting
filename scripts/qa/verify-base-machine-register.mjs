// Isolated PostgreSQL regression harness. No connection to a Supabase project.
// Install @electric-sql/pglite in a temporary directory, then set PGLITE_MODULE
// to its dist/index.js when running this script. No repository dependency needed.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'

if (!process.env.PGLITE_MODULE) throw new Error('Set PGLITE_MODULE to an installed @electric-sql/pglite/dist/index.js')
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db = new PGlite()
const org = randomUUID(), owner = randomUUID(), worker = randomUUID(), other = randomUUID(), job = randomUUID()
const machines = [randomUUID(), randomUUID(), randomUUID()]
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
function sqlFunction(path, name) {
    const text = read(path)
    const start = text.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`)
    assert.ok(start >= 0, name)
    return text.slice(start, text.indexOf('$function$;', start) + '$function$;'.length)
}

try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA private;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''test.actor'', true), '''')::uuid';
      CREATE TABLE profiles(id uuid PRIMARY KEY, org_id uuid, role text);
      CREATE FUNCTION private.base_production_core_access(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND org_id = $1 AND role = ''owner'')';
      CREATE TABLE base_production_batches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid, production_date date, shift text, status text, client_request_id uuid, created_by uuid, updated_by uuid, updated_at timestamptz DEFAULT clock_timestamp());
      CREATE TABLE base_production_workers(id uuid PRIMARY KEY, org_id uuid, rate_per_meter numeric);
      CREATE TABLE base_production_machines(id uuid PRIMARY KEY, org_id uuid, name text, custom_label text, machine_type text DEFAULT 'rapier', is_active boolean DEFAULT true);
      CREATE TABLE base_production_jobs(id uuid PRIMARY KEY, org_id uuid, quality_label text, worker_rate_per_meter numeric, status text DEFAULT 'active');
      CREATE TABLE base_worker_machine_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid, worker_id uuid, machine_id uuid, shift text DEFAULT 'day', active boolean DEFAULT true, effective_from date DEFAULT '2026-01-01', effective_to date, created_at timestamptz DEFAULT now());
      CREATE TABLE base_machine_job_contexts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid, machine_id uuid, job_id uuid, active boolean DEFAULT true, effective_from date DEFAULT '2026-01-01', effective_to date, created_at timestamptz DEFAULT now());
      CREATE TABLE base_payroll_settlements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid, worker_id uuid, status text DEFAULT 'paid', period_end date);
      CREATE TABLE base_daily_production_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid, batch_id uuid REFERENCES base_production_batches(id), worker_id uuid, entry_status text, meters numeric, worker_rate_snapshot numeric, machine_id uuid, job_id uuid, machine_label text, job_label text, assignment_snapshot jsonb, allocation_mode text, notes text, created_by uuid);
      CREATE TABLE base_daily_production_allocations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid, entry_id uuid REFERENCES base_daily_production_entries(id) ON DELETE CASCADE, worker_id uuid, assignment_id uuid, machine_id uuid, job_id uuid, meters numeric CHECK(meters > 0), worker_rate_snapshot numeric, machine_label text, job_label text, assignment_snapshot jsonb, created_by uuid);
      CREATE TABLE base_production_batch_revisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid, batch_id uuid, revision_number integer, change_kind text, correction_reason text, before_snapshot jsonb, after_snapshot jsonb, changed_by uuid);
      CREATE TABLE base_production_save_receipts(org_id uuid, client_request_id uuid, batch_id uuid, request_payload jsonb, response jsonb, PRIMARY KEY(org_id, client_request_id));
    `)
    await db.query("SELECT set_config('test.actor', $1, false)", [owner])
    await db.query("INSERT INTO profiles VALUES ($1,$2,'owner')", [owner, org])
    await db.query('INSERT INTO base_production_workers VALUES ($1,$3,2),($2,$3,3)', [worker, other, org])
    await db.query("INSERT INTO base_production_jobs(id,org_id,quality_label,worker_rate_per_meter) VALUES ($1,$2,'Cotton',2)", [job, org])
    for (const [i, machine] of machines.entries()) {
        await db.query('INSERT INTO base_production_machines(id,org_id,name) VALUES ($1,$2,$3)', [machine, org, `Loom ${i + 1}`])
        await db.query('INSERT INTO base_worker_machine_assignments(org_id,worker_id,machine_id) VALUES ($1,$2,$3)', [org, worker, machine])
        await db.query('INSERT INTO base_machine_job_contexts(org_id,machine_id,job_id) VALUES ($1,$2,$3)', [org, machine, job])
    }
    await db.exec(sqlFunction('supabase/migrations/20260901110004_base_payroll_audited_reversal.sql', 'public.save_base_daily_production'))
    await db.exec(sqlFunction('supabase/migrations/20260901110000_base_production_correction_history.sql', 'private.base_production_batch_snapshot'))
    await db.exec(sqlFunction('supabase/migrations/20260901110000_base_production_correction_history.sql', 'public.save_base_daily_production_with_reason'))
    await db.exec(read('supabase/migrations/20260903155014_base_production_machine_register.sql'))
    await db.exec('SET ROLE anon')
    await assert.rejects(() => db.query("SELECT public.save_base_daily_production_reviewed('2026-09-01','day',$1,'[]',null,null)", [randomUUID()]), /permission denied/)
    await db.exec('RESET ROLE')

    const payload = [ { worker_id: worker, entry_status: 'entered', meters: 125, allocations: [{ machine_id: machines[0], job_id: job, meters: 125 }], machine_records: machines.map((machine_id, i) => ({ machine_id, state: ['entered', 'not_running', 'pending'][i] })) } ]
    const request = randomUUID()
    const save = async (entries, id = randomUUID(), revision = null, reason = null, date = '2026-09-01') => {
        const result = await db.query('SELECT public.save_base_daily_production_reviewed($1,$2,$3,$4::jsonb,$5,$6) AS result', [date, 'day', id, JSON.stringify(entries), reason, revision])
        return result.rows[0].result
    }
    const batch = () => db.query('SELECT *, updated_at::text AS revision FROM base_production_batches ORDER BY production_date')
    const first = await save(payload, request)
    assert.equal(first.total_meters, 125)
    let saved = (await batch()).rows[0]
    assert.equal(saved.machine_records.length, 3)
    assert.deepEqual(saved.machine_records.map(r => r.state).sort(), ['entered','not_running','pending'])
    assert.equal((await db.query('SELECT sum(meters * worker_rate_snapshot)::float AS pay FROM base_daily_production_allocations')).rows[0].pay, 250)
    assert.equal((await save(payload, request)).idempotent, true)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM base_production_batch_revisions')).rows[0].n, 1)
    const changed = structuredClone(payload)
    changed[0].machine_records[2].state = 'not_running'
    await assert.rejects(() => save(changed, request), /already recorded different/)
    await assert.rejects(() => save(changed), /shift changed/)
    const corrected = await save(changed, randomUUID(), saved.revision, 'Paper register checked')
    assert.equal(corrected.total_meters, 125)
    const receipt = (await db.query('SELECT * FROM base_production_batch_revisions WHERE revision_number = 2')).rows[0]
    assert.equal(receipt.before_snapshot.machine_records.find(r => r.machine_id === machines[2]).state, 'pending')
    assert.equal(receipt.after_snapshot.machine_records.find(r => r.machine_id === machines[2]).state, 'not_running')
    saved = (await batch()).rows[0]
    const malformed = structuredClone(changed)
    malformed[0].machine_records[0].state = 'not_running'
    await assert.rejects(() => save(malformed, randomUUID(), saved.revision, 'Invalid state'), /must match/)
    const duplicate = structuredClone(changed)
    duplicate[0].machine_records.push(duplicate[0].machine_records[0])
    await assert.rejects(() => save(duplicate, randomUUID(), saved.revision, 'Duplicate'), /appear once/)
    const forged = structuredClone(changed)
    forged[0].machine_records.push({ machine_id: randomUUID(), state: 'pending' })
    await assert.rejects(() => save(forged, randomUUID(), saved.revision, 'Foreign machine'), /dated worker assignment/)
    await db.query('INSERT INTO base_payroll_settlements(org_id,worker_id,period_end) VALUES ($1,$2,$3)', [org, worker, '2026-09-01'])
    const paidChanged = structuredClone(changed)
    paidChanged[0].machine_records[2].state = 'pending'
    await assert.rejects(() => save(paidChanged, randomUUID(), saved.revision, 'Cannot change paid'), /Paid worker machine records/)
    assert.equal((await batch()).rows[0].revision, saved.revision, 'Failed paid correction rolls back the whole batch')
    assert.equal((await db.query('SELECT count(*)::int AS n FROM base_production_batch_revisions')).rows[0].n, 2)
    const mixed = [...changed, { worker_id: other, entry_status: 'blank', meters: null, allocations: [], machine_records: [] }]
    await save(mixed, randomUUID(), saved.revision, 'Keep paid worker unchanged')
    assert.equal((await db.query('SELECT sum(meters * worker_rate_snapshot)::float AS pay FROM base_daily_production_allocations')).rows[0].pay, 250)
    await db.query("SELECT set_config('test.actor', $1, false)", [randomUUID()])
    await assert.rejects(() => save(payload), /access is required/)
    await db.query("SELECT set_config('test.actor', $1, false)", [owner])
    const stopped = [{ ...payload[0], entry_status: 'zero', meters: 0, allocations: [], machine_records: machines.map((machine_id, i) => ({ machine_id, state: i === 0 ? 'not_running' : 'pending' })) }]
    await save(stopped, randomUUID(), null, null, '2026-09-02')
    const second = (await batch()).rows[1]
    assert.deepEqual(second.machine_records.map(r => r.state).sort(), ['not_running', 'pending', 'pending'])
    await db.query("UPDATE base_production_batches SET status = 'finalized' WHERE id = $1", [second.id])
    await assert.rejects(() => save(stopped, randomUUID(), second.revision, 'Finalized', '2026-09-02'), /finalized/)
    await db.exec("UPDATE base_payroll_settlements SET status = 'reversed'")
    const legacy = structuredClone(payload)
    delete legacy[0].machine_records
    await save(legacy, randomUUID(), null, null, '2026-08-31')
    const old = (await db.query("SELECT updated_at::text AS revision FROM base_production_batches WHERE production_date = '2026-08-31'")).rows[0]
    await db.exec("UPDATE base_payroll_settlements SET status = 'paid'; UPDATE base_worker_machine_assignments SET active = false")
    legacy[0].machine_records = [{ machine_id: machines[0], state: 'entered' }]
    await db.exec('SET ROLE authenticated')
    await save(legacy, randomUUID(), old.revision, 'Carry historical paid allocation', '2026-08-31')
    await db.exec('RESET ROLE')
    console.log('PASS: real production writer + reviewed register migration: mixed output, zero/pending persistence, pay totals, retries, revisions, invalid/foreign/duplicate records, paid rollback, legacy paid/retired assignments, owner/anonymous permissions, finalized guard.')
} catch (error) {
    console.error(error.message, error.where ?? '')
    process.exitCode = 1
} finally { await db.close() }
