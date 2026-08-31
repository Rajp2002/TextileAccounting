/** Isolated SQL regression proof. Uses PGlite; never connects to Supabase.
 * Run with BASE_PGLITE_MODULE pointing to an installed PGlite module if it is
 * not in this project's dependencies. No production credentials are read.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const specifier = process.env.BASE_PGLITE_MODULE
const { PGlite } = await import(specifier ? pathToFileURL(specifier).href : '@electric-sql/pglite')
const db = new PGlite()
const migration = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8')
const org = '11111111-1111-4111-8111-111111111111'
const owner = '22222222-2222-4222-8222-222222222222'
const worker = '33333333-3333-4333-8333-333333333333'
const job = '44444444-4444-4444-8444-444444444444'
const costing = '55555555-5555-4555-8555-555555555555'
const checks = []
try {
    // Only external auth/organization dependencies are stubbed. Base tables,
    // settlement writer, history triggers and readiness guard are real SQL.
    await db.exec(`
      CREATE SCHEMA auth; CREATE SCHEMA private;
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE public.organizations(id uuid PRIMARY KEY);
      CREATE TABLE public.profiles(id uuid PRIMARY KEY, org_id uuid, role text);
      CREATE TABLE public.estimator_quotes(id uuid PRIMARY KEY, org_id uuid, worker_rate_per_m numeric, UNIQUE(org_id,id));
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION private.base_production_core_access(org uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND org_id=org AND role='owner') $$;
    `)
    const core = await migration('20260829090000_base_production_core.sql')
    await db.exec(core.slice(0, core.indexOf('-- One access predicate')))
    for (const file of ['20260830100000_base_operational_loop.sql', '20260830110000_base_machine_first_production.sql', '20260830130000_add_base_payroll_history_snapshots.sql', '20260830120000_base_settlement_finalizes_batches.sql', '20260901000000_base_payroll_readiness_guard.sql', '20260901110000_base_production_correction_history.sql', '20260901110002_base_payroll_period_continuity.sql', '20260901110003_base_production_reviewed_save.sql', '20260901110004_base_payroll_audited_reversal.sql', '20260901110005_base_reviewed_write_cutover.sql']) await db.exec(await migration(file))
    await db.exec(`
      INSERT INTO auth.users VALUES ('${owner}'); INSERT INTO organizations VALUES ('${org}');
      INSERT INTO profiles VALUES ('${owner}','${org}','owner');
      INSERT INTO estimator_quotes(id,org_id) VALUES ('${costing}','${org}');
      INSERT INTO base_production_workers(id,org_id,name,rate_per_meter) VALUES ('${worker}','${org}','Synthetic worker',8);
      INSERT INTO base_production_jobs(id,org_id,costing_id,quality_label,target_meters,start_date) VALUES ('${job}','${org}','${costing}','Synthetic quality',1000,'2026-01-01');
      INSERT INTO base_production_entries(org_id,job_id,worker_id,production_date,meters,worker_rate_snapshot) VALUES ('${org}','${job}','${worker}','2026-01-31',100,8);
      INSERT INTO base_worker_advances(org_id,worker_id,amount) VALUES ('${org}','${worker}',1000);
      SELECT set_config('request.jwt.claim.sub','${owner}',false);
    `)
    await db.exec('CREATE TRIGGER validate_base_production_entry BEFORE INSERT ON base_production_entries FOR EACH ROW EXECUTE FUNCTION public.validate_base_production_entry()')
    const reviewed = { client_request_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', period_start: '2026-01-31', gross_pay: 800, advance_deducted: 400, net_payout: 400, advance_balance_before: 1000 }
    const pay = (expected = reviewed, mode = 'cash') => db.query('SELECT public.settle_base_worker_payroll_reviewed($1,$2,$3,$4::jsonb) AS result', [worker, '2026-02-01', mode, JSON.stringify(expected)])
    await assert.rejects(pay({ ...reviewed, net_payout: 399 }), /Payroll changed since review/)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM base_payroll_settlements')).rows[0].n, 0)
    assert.equal((await db.query('SELECT recovered_amount::float AS n FROM base_worker_advances')).rows[0].n, 0)
    checks.push('stale review rolls back settlement, history and advance recovery')
    const first = (await pay()).rows[0].result
    assert.equal(first.period_start, '2026-01-31')
    assert.equal(first.gross_pay, 800)
    assert.equal(first.net_payout, 400)
    assert.equal((await db.query('SELECT sum(gross_pay)::float AS n FROM base_payroll_settlement_lines')).rows[0].n, 800)
    checks.push('first payment includes prior-month earnings and immutable lines')
    const retry = (await pay()).rows[0].result
    assert.equal(retry.settlement_id, first.settlement_id)
    assert.equal(retry.idempotent, true)
    assert.equal((await db.query('SELECT recovered_amount::float AS n FROM base_worker_advances')).rows[0].n, 400)
    await assert.rejects(pay(reviewed, 'upi'), /different details/)
    checks.push('retry does not double-pay or recover an advance twice')
    await db.exec(`INSERT INTO base_production_entries(org_id,job_id,worker_id,production_date,meters,worker_rate_snapshot) VALUES ('${org}','${job}','${worker}','2026-02-15',25,8)`)
    const next = (await db.query('SELECT public.settle_base_worker_payroll_reviewed($1,$2,$3,$4::jsonb) AS result', [worker, '2026-03-01', 'cash', JSON.stringify({ client_request_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', period_start: '2026-02-02', gross_pay: 200, advance_deducted: 100, net_payout: 100, advance_balance_before: 600 })])).rows[0].result
    assert.equal(next.period_start, '2026-02-02')
    assert.equal(next.gross_pay, 200)
    checks.push('later settlement continues across month boundary without double counting')
    const reverse = id => db.query('SELECT public.reverse_base_payroll_settlement($1,$2,true) AS result', [id, 'Marked paid before handing over cash'])
    await assert.rejects(reverse(first.settlement_id), /later settlement depends/)
    await reverse(next.settlement_id)
    assert.equal((await db.query('SELECT last_recovered_period_end::text AS value FROM base_worker_advances')).rows[0].value, '2026-02-01')
    assert.equal((await db.query('SELECT recovered_amount::float AS n FROM base_worker_advances')).rows[0].n, 400)
    await reverse(first.settlement_id)
    assert.equal((await db.query('SELECT recovered_amount::float AS n FROM base_worker_advances')).rows[0].n, 0)
    assert.equal((await db.query('SELECT sum(gross_pay)::float AS n FROM base_payroll_settlement_lines')).rows[0].n, 1000)
    assert.equal((await reverse(first.settlement_id)).rows[0].result.idempotent, true)
    await assert.rejects(pay(), /request was reversed/)
    const replacement = (await pay({ ...reviewed, client_request_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })).rows[0].result
    assert.notEqual(replacement.settlement_id, first.settlement_id)
    assert.equal((await db.query('SELECT recovered_amount::float AS n FROM base_worker_advances')).rows[0].n, 400)
    checks.push('reversal preserves original lines, restores exact advances, rejects dependent reversal and old payment replay')
    // An older receipt without exact advance provenance must fail closed.
    await db.query('DELETE FROM base_payroll_advance_recoveries WHERE settlement_id=$1', [replacement.settlement_id])
    await assert.rejects(reverse(replacement.settlement_id), /no complete per-advance/)
    checks.push('legacy payment without advance provenance cannot be reversed automatically')

    const workerB = '66666666-6666-4666-8666-666666666666'
    await db.exec(`INSERT INTO base_production_workers(id,org_id,name,rate_per_meter) VALUES ('${workerB}','${org}','Synthetic coworker',8)`)
    const rows = [
      {worker_id: worker, entry_status:'entered', meters:10, notes:'Paper register', allocations:[{machine_id:'77777777-7777-4777-8777-777777777770',job_id:job,meters:10}]},
      {worker_id: workerB, entry_status:'entered', meters:20, notes:null, allocations:[{machine_id:'77777777-7777-4777-8777-777777777771',job_id:job,meters:20}]},
    ]
    // Dated contexts make these single-machine worker totals ready for payroll.
    for (const [index, workerId] of [worker, workerB].entries()) {
      const machineId = `77777777-7777-4777-8777-77777777777${index}`
      await db.query('INSERT INTO base_production_machines(id,org_id,name) VALUES ($1,$2,$3)', [machineId,org,`QA loom ${index}`])
      await db.query("INSERT INTO base_worker_machine_assignments(org_id,worker_id,machine_id,shift,effective_from) VALUES ($1,$2,$3,'day','2026-01-01')",[org,workerId,machineId])
      await db.query("INSERT INTO base_machine_job_contexts(org_id,machine_id,job_id,effective_from) VALUES ($1,$2,$3,'2026-01-01')",[org,machineId,job])
    }
    const { randomUUID } = await import('node:crypto')
    const save = (payload, requestId, revision = null, reason = null) => db.query('SELECT public.save_base_daily_production_reviewed($1,$2,$3,$4::jsonb,$5,$6) AS result', ['2026-04-01','day',requestId,JSON.stringify(payload),reason,revision])
    const originalRequest = randomUUID()
    const saved = (await save(rows, originalRequest)).rows[0].result
    const revision = async () => (await db.query('SELECT updated_at::text AS value FROM base_production_batches WHERE id=$1',[saved.batch_id])).rows[0].value
    const originalRevision = await revision()
    assert.equal((await save(rows, originalRequest)).rows[0].result.idempotent, true)
    await assert.rejects(save(rows, randomUUID(), originalRevision), /Explain why/)
    const corrected = structuredClone(rows); corrected[1].meters = 22; corrected[1].allocations[0].meters = 22
    await save(corrected, randomUUID(), originalRevision, 'Corrected paper reading')
    await assert.rejects(save(rows, randomUUID(), originalRevision, 'Stale second device'), /changed after it was opened/)
    assert.equal((await save(rows, originalRequest)).rows[0].result.idempotent, true)
    assert.equal((await db.query('SELECT meters::float AS value FROM base_daily_production_entries WHERE batch_id=$1 AND worker_id=$2',[saved.batch_id,workerB])).rows[0].value,22)
    checks.push('corrections require reason, reject stale revisions, and retain old request receipts without overwriting later edits')
    const workerAEntry = (await db.query('SELECT id FROM base_daily_production_entries WHERE batch_id=$1 AND worker_id=$2',[saved.batch_id,worker])).rows[0].id
    await db.query('SELECT public.settle_base_worker_payroll_reviewed($1,$2,$3,$4::jsonb)', [worker,'2026-04-01','cash',JSON.stringify({client_request_id:randomUUID(),period_start:'2026-02-02',gross_pay:280,advance_deducted:140,net_payout:140,advance_balance_before:600})])
    const paidRevision = await revision()
    const unpaidCorrection = structuredClone(corrected); unpaidCorrection[1].meters = 25; unpaidCorrection[1].allocations[0].meters = 25
    await save(unpaidCorrection, randomUUID(), paidRevision, 'Unpaid coworker correction')
    assert.equal((await db.query('SELECT id FROM base_daily_production_entries WHERE batch_id=$1 AND worker_id=$2',[saved.batch_id,worker])).rows[0].id,workerAEntry)
    const badCorrection = structuredClone(unpaidCorrection); badCorrection[0].meters = 11; badCorrection[0].allocations[0].meters = 11
    await assert.rejects(save(badCorrection, randomUUID(), await revision(), 'Attempt paid row edit'), /Paid worker entries are protected/)
    assert.equal((await db.query('SELECT meters::float AS value FROM base_daily_production_entries WHERE batch_id=$1 AND worker_id=$2',[saved.batch_id,workerB])).rows[0].value,25)
    await assert.rejects(db.query('INSERT INTO base_production_entries(org_id,job_id,worker_id,production_date,meters,worker_rate_snapshot) VALUES ($1,$2,$3,$4,1,8)',[org,job,worker,'2026-03-15']), /backdated work requires/)
    checks.push('legacy production insert also rejects work hidden behind a paid period')
    checks.push('unpaid coworker can be corrected while paid row identity, notes, earnings and receipt remain protected')
    await db.exec("SELECT set_config('request.jwt.claim.sub','',false)")
    await assert.rejects(pay(), /access is required/)
    assert.equal((await db.query("SELECT has_function_privilege('anon', 'public.settle_base_worker_payroll_reviewed(uuid,date,text,jsonb)', 'EXECUTE') AS allowed")).rows[0].allowed, false)
    assert.equal((await db.query("SELECT has_function_privilege('authenticated', 'public.settle_base_worker_payroll(uuid,date,text)', 'EXECUTE') AS allowed")).rows[0].allowed, false)
    checks.push('unauthenticated request and anonymous execution rejected')
    console.log(JSON.stringify({ passed: checks.length, checks, environment: 'isolated PGlite; no remote writes' }, null, 2))
} finally {
    await db.close()
}
