// Isolated PostgreSQL/WASM verification; never connects to a Supabase project.
// PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/qa/base-fixed-salary-sql.mjs
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
process.on('uncaughtException', error => { console.error(error.message, error.where ?? ''); process.exit(1) })
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
const sql = async (query, params = []) => (await db.query(query, params)).rows
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE SCHEMA private;
  CREATE TABLE auth.users(id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
  CREATE TABLE public.organizations(id uuid PRIMARY KEY);
  CREATE TABLE public.profiles(id uuid PRIMARY KEY, org_id uuid, role text);
  CREATE TABLE public.estimator_quotes(id uuid PRIMARY KEY, org_id uuid, worker_rate_per_m numeric DEFAULT 0, record_kind text DEFAULT 'costing', is_archived boolean DEFAULT false, UNIQUE(org_id,id));
  CREATE FUNCTION public.org_has_subscription_tier(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
  CREATE TABLE public.factory_cost_profile(factory_id uuid PRIMARY KEY, overhead_items jsonb DEFAULT '[]', overhead_mode text DEFAULT 'monthly_expenses', monthly_output_m numeric DEFAULT 10000, overhead_override_per_m numeric, updated_at timestamptz DEFAULT now());
  GRANT USAGE ON SCHEMA public,auth TO authenticated;
  GRANT SELECT ON public.profiles TO authenticated;
`)
const migrations = [
    '20260829090000_base_production_core.sql',
    '20260829203707_add_base_worker_shift_availability.sql',
    '20260830000000_base_production_core_security_hardening.sql',
    '20260830100000_base_operational_loop.sql',
    '20260830110000_base_machine_first_production.sql',
    '20260830120000_base_settlement_finalizes_batches.sql',
    '20260830130000_add_base_payroll_history_snapshots.sql',
    '20260901000000_base_payroll_readiness_guard.sql',
    '20260901110000_base_production_correction_history.sql',
    '20260901110002_base_payroll_period_continuity.sql',
    '20260901110003_base_production_reviewed_save.sql',
    '20260901110004_base_payroll_audited_reversal.sql',
    '20260901110005_base_reviewed_write_cutover.sql',
    '20260903155014_base_production_machine_register.sql',
    '20260903162305_base_fixed_salary_payroll.sql',
]
for (const file of migrations) {
    try { await db.exec(readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8')) }
    catch (error) { console.error(`Migration failed: ${file}`, error.message); throw error }
}
console.log(`Applied ${migrations.length} real Base migrations in isolated PostgreSQL`)
const org = randomUUID(), otherOrg = randomUUID(), owner = randomUUID(), otherOwner = randomUUID(), supervisor = randomUUID()
await sql('INSERT INTO organizations VALUES ($1),($2)', [org, otherOrg])
await sql('INSERT INTO auth.users VALUES ($1),($2),($3)', [owner, otherOwner, supervisor])
await sql("INSERT INTO profiles VALUES ($1,$2,'owner'),($3,$4,'owner'),($5,$2,'supervisor')", [owner, org, otherOwner, otherOrg, supervisor])
await sql(`INSERT INTO factory_cost_profile(factory_id,overhead_items) VALUES ($1, '[{"id":"manual-salary","label":"Fixed Salary Factory Staff","category":"admin","isPreset":true,"source":"manual","monthlyAmount":90000},{"id":"rent","label":"Rent","category":"rent","isPreset":true,"source":"manual","monthlyAmount":10000}]')`, [org])
const asUser = async id => { await db.exec('RESET ROLE'); await sql("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec('SET ROLE authenticated') }
const reject = async (query, params, pattern) => { await assert.rejects(() => sql(query, params), pattern) }
await asUser(owner)
const [worker] = await sql("INSERT INTO base_production_workers(org_id,name,pay_type,role,monthly_salary,start_date) VALUES ($1,'Salary QA','fixed_monthly','Supervisor',31000,'2026-08-01') RETURNING *", [org])
assert.deepEqual(worker.salary_history, [{ effective_from: '2026-08-01', monthly_salary: 31000 }])
await reject("UPDATE base_production_workers SET salary_history='[]' WHERE id=$1", [worker.id], /maintained automatically/)
await reject("UPDATE base_production_workers SET pay_type='piece_rate' WHERE id=$1", [worker.id], /pay type cannot/)
await reject("UPDATE base_production_workers SET is_active=false WHERE id=$1", [worker.id], /last working day/)
await sql('INSERT INTO base_worker_advances(org_id,worker_id,amount,created_by) VALUES ($1,$2,20000,$3)', [org,worker.id,owner])
const expected = { client_request_id: randomUUID(), period_start: '2026-08-01', gross_pay: 31000, advance_deducted: 15500, net_payout: 15500, advance_balance_before: 20000 }
const settle = payload => sql("SELECT settle_base_worker_payroll_reviewed($1,'2026-08-31','cash',$2) result", [worker.id, payload])
await assert.rejects(() => settle({ ...expected, gross_pay: 999 }), /changed since review/)
assert.equal((await sql('SELECT count(*)::integer count FROM base_payroll_settlements'))[0].count, 0)
const [paid] = await settle(expected)
assert.equal(paid.result.gross_pay, 31000)
assert.equal(paid.result.net_payout, 15500)
assert.equal((await settle(expected))[0].result.idempotent, true)
const [line] = await sql('SELECT * FROM base_payroll_settlement_lines WHERE settlement_id=$1', [paid.result.settlement_id])
assert.equal(line.source_kind, 'fixed_salary')
assert.equal(Number(line.gross_pay), 31000)
assert.equal(Number(line.meters), 0)
assert.equal(Number(line.worker_rate_snapshot), 31000)
await reject("UPDATE base_production_workers SET monthly_salary=35000,salary_effective_from='2026-08-15' WHERE id=$1", [worker.id], /effective date/)
await reject("UPDATE base_production_workers SET end_date='2026-08-10' WHERE id=$1", [worker.id], /paid days/)
await sql("UPDATE base_production_workers SET monthly_salary=36000,salary_effective_from=(now() AT TIME ZONE 'Asia/Kolkata')::date WHERE id=$1", [worker.id])
assert.equal(Number((await sql('SELECT gross_pay FROM base_payroll_settlement_lines WHERE id=$1', [line.id]))[0].gross_pay), 31000)
await sql("SELECT reverse_base_payroll_settlement($1,'Payment not actually made',true)", [paid.result.settlement_id])
assert.equal(Number((await sql('SELECT recovered_amount FROM base_worker_advances WHERE worker_id=$1', [worker.id]))[0].recovered_amount), 0)
assert.equal((await sql('SELECT status FROM base_payroll_settlements WHERE id=$1', [paid.result.settlement_id]))[0].status, 'reversed')
assert.equal((await settle({ ...expected, client_request_id: randomUUID() }))[0].result.gross_pay, 31000)
await asUser(otherOwner)
assert.equal((await sql('SELECT count(*)::integer count FROM base_production_workers'))[0].count, 0)
await assert.rejects(() => settle({ ...expected, client_request_id: randomUUID() }), /Worker not found/)
await asUser(supervisor)
assert.equal((await sql('SELECT count(*)::integer count FROM base_production_workers'))[0].count, 0)
await assert.rejects(() => settle({ ...expected, client_request_id: randomUUID() }), /access is required/)
await asUser(owner)
await db.exec('RESET ROLE')
const [profile] = await sql('SELECT * FROM factory_cost_profile WHERE factory_id=$1', [org])
assert.equal(profile.overhead_items.filter(item => item.source === 'base_salary_derived').length, 1)
assert.equal(profile.overhead_items.reduce((sum,item) => sum + item.monthlyAmount, 0), 46000)
assert.equal(Number(profile.overhead_override_per_m), 4.6)
await sql("UPDATE factory_cost_profile SET overhead_mode='direct',overhead_override_per_m=9 WHERE factory_id=$1", [org])
await asUser(owner)
await sql("UPDATE base_production_workers SET is_active=false,end_date='2026-08-31' WHERE id=$1", [worker.id])
await db.exec('RESET ROLE')
const [inactiveProfile] = await sql('SELECT * FROM factory_cost_profile WHERE factory_id=$1', [org])
assert.equal(inactiveProfile.overhead_items.find(item => item.source === 'base_salary_derived').monthlyAmount, 0)
assert.equal(Number(inactiveProfile.overhead_override_per_m), 9)
await reject('INSERT INTO base_production_entries(org_id,worker_id,job_id,production_date,meters,worker_rate_snapshot) VALUES ($1,$2,$3,current_date,10,5)', [org,worker.id,randomUUID()], /not machine production/)
const [leap] = await sql(`SELECT sum(gross_pay) total FROM private.base_salary_lines('[{"effective_from":"2024-02-15","monthly_salary":29000}]','2024-02-15','2024-02-29')`)
assert.equal(Number(leap.total),15000)
const [changed] = await sql(`SELECT sum(gross_pay) total FROM private.base_salary_lines('[{"effective_from":"2026-08-01","monthly_salary":30000},{"effective_from":"2026-09-16","monthly_salary":36000}]','2026-08-01','2026-09-30')`)
assert.equal(Number(changed.total),63000)
const costing = randomUUID(), job = randomUUID()
await sql('INSERT INTO estimator_quotes(id,org_id,worker_rate_per_m) VALUES ($1,$2,2)', [costing,org])
await asUser(owner)
const [piece] = await sql("INSERT INTO base_production_workers(org_id,name,rate_per_meter) VALUES ($1,'Piece QA',2) RETURNING id", [org])
await sql("INSERT INTO base_production_jobs(id,org_id,costing_id,quality_label,target_meters,status,start_date) VALUES ($1,$2,$3,'Piece regression',1000,'active','2026-08-01')", [job,org,costing])
await sql("INSERT INTO base_production_entries(org_id,worker_id,job_id,production_date,meters,worker_rate_snapshot,client_request_id) VALUES ($1,$2,$3,'2026-08-15',200,2,$4)", [org,piece.id,job,randomUUID()])
const [piecePaid] = await sql("SELECT settle_base_worker_payroll_reviewed($1,'2026-08-31','cash',$2) result", [piece.id,{client_request_id:randomUUID(),period_start:'2026-08-01',gross_pay:400,advance_deducted:0,net_payout:400,advance_balance_before:0}])
assert.equal(piecePaid.result.gross_pay,400)
assert.equal((await sql('SELECT source_kind FROM base_payroll_settlement_lines WHERE settlement_id=$1',[piecePaid.result.settlement_id]))[0].source_kind,'legacy_entry')
assert.equal((await sql("SELECT has_function_privilege('authenticated','private.base_salary_lines(jsonb,date,date)','EXECUTE') allowed"))[0].allowed,false)
console.log('PASS: salary settlement, exact review, retry, immutable lines, recovery, reversal, tenant/role isolation, overhead replacement, direct override, leaving date, production rejection, leap-month proration')
console.log('PASS: multi-month rate-change proration, piece-rate settlement regression, helper execute privileges')
await db.close()
