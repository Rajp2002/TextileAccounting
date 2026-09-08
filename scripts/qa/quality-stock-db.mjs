/** Disposable, loopback-only PostgreSQL integration tests. Never points at Supabase.
 * STOCK_TEST_DATABASE_URL=postgresql://...@127.0.0.1:5432/postgres npm run test:stock-db
 * The supplied local account must be able to create roles and databases.
 */
import pg from 'pg'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
const url = new URL(process.env.STOCK_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres')
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Stock tests only run on a disposable local PostgreSQL database.')
const root = new pg.Client({ connectionString: url.href }); await root.connect()
const database = `weavly_stock_test_${Date.now()}`
const testUrl = new URL(url); testUrl.pathname = `/${database}`
const connections = []
async function connect(actor) {
    const db = new pg.Client({ connectionString: testUrl.href }); await db.connect(); connections.push(db)
    if (actor) {
        await db.query('set role authenticated')
        await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [actor, JSON.stringify({ sub: actor, role: 'authenticated', org_id: actor === '10000000-0000-4000-8000-000000000002' ? '20000000-0000-4000-8000-000000000002' : '20000000-0000-4000-8000-000000000001', user_role: actor === '10000000-0000-4000-8000-000000000003' ? 'supervisor' : 'owner' })])
    }
    return db
}
const owner = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002', supervisor = '10000000-0000-4000-8000-000000000003'
const org = '20000000-0000-4000-8000-000000000001'
const worker = '50000000-0000-4000-8000-000000000001', machine = '60000000-0000-4000-8000-000000000001', cottonJob = '40000000-0000-4000-8000-000000000001'
const dates = Array.from({ length: 8 }, (_, index) => new Date(Date.now() - (8-index)*86400000).toISOString().slice(0,10))
let checks = 0
async function test(name, fn) { await fn(); checks++; console.log(`PASS ${name}`) }
function row(meters, job = cottonJob) { return { worker_id: worker, entry_status: meters ? 'entered' : 'zero', meters,
    allocations: meters ? [{ machine_id: machine, job_id: job, meters }] : [], machine_records: [{ machine_id: machine, state: meters ? 'entered' : 'not_running' }] } }
async function save(db, date, meters, expected = null, reason = null, request = randomUUID()) {
    const payload = [date,'day',request,JSON.stringify([row(meters)]),reason,expected]
    const res = await db.query('select public.save_base_daily_production_reviewed($1,$2,$3,$4,$5,$6) result', payload)
    return { result: res.rows[0].result, payload }
}
async function stamp(db,date) { return (await db.query('select updated_at::text from base_production_batches where org_id=$1 and production_date=$2 and shift=\'day\'', [org,date])).rows[0]?.updated_at ?? null }
async function board(db) { return (await db.query('select public.get_quality_stock_board() result')).rows[0].result }
async function balance(db,label='cotton') { return Number((await board(db)).qualities.find(q=>q.quality_key===label)?.meters ?? 0) }
async function adjust(db, meters, kind='opening', expected=null, request=randomUUID(), label='Cotton') {
    return (await db.query('select public.record_quality_stock_adjustment($1,$2,$3,$4,$5,$6) result',[label,meters,kind,'Verified local test count',request,expected])).rows[0].result
}
try {
    for (const role of ['anon','authenticated','service_role','supabase_auth_admin']) {
        if (!(await root.query('select 1 from pg_roles where rolname=$1',[role])).rowCount) await root.query(`create role ${role}${role==='service_role'?' bypassrls':''}`)
    }
    await root.query(`create database ${database}`)
    const admin = await connect()
    await admin.query(`create schema auth; create schema extensions; create schema storage;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb,created_at timestamptz,updated_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function auth.role() returns text language sql stable as $$select current_user::text$$;
      grant usage on schema auth to authenticated,anon,service_role;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key,bucket_id text,name text,owner uuid,metadata jsonb);
      create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`)
    const migration = '20260908171502_quality_metre_stock.sql'
    let replayed = 0
    for (const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql') && f<migration).sort()) {
        const sql = readFileSync(`supabase/migrations/${file}`,'utf8')
        // Only these unrelated external-message schedules require unavailable Supabase extensions.
        if (sql.includes('CREATE EXTENSION IF NOT EXISTS pg_cron')) continue
        try { await admin.query(sql); replayed++ } catch (error) { throw new Error(`Historical migration ${file}: ${error.message}`) }
    }
    console.log(`Replayed ${replayed} historical migrations; skipped 4 external WhatsApp schedules.`)
    await admin.query(readFileSync('scripts/qa/fixtures/quality-stock.sql','utf8'))
    const a = await connect(owner), b = await connect(owner), outsider = await connect(other), floor = await connect(supervisor)
    await save(a,dates[0],100)
    const legacyOrder=randomUUID(), legacySale=randomUUID()
    await admin.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)")
    await admin.query("insert into orders(id,org_id,party_name,quality_label,total_target_meters,deadline) values($1,$2,'Historical dispatch fixture','Legacy Cotton',500,current_date+10)",[legacyOrder,org])
    const legacyLot=(await admin.query(`insert into fabric_stock_lots(org_id,quality_label,source_type,order_id,original_taka_count,available_taka_count,meters_per_taka,original_meters,available_meters) values($1,'Legacy Cotton','order',$2,10,9,50,500,450) returning id`,[org,legacyOrder])).rows[0].id
    await admin.query("insert into fabric_stock_sales(id,org_id,stock_lot_id,taka_sold,meters_sold,price_per_meter,cost_per_meter,pending_dispatch_meters,party_name) values($1,$2,$3,1,50,40,20,50,'Historical dispatch fixture')",[legacySale,org,legacyLot])
    await admin.query(readFileSync(`supabase/migrations/${migration}`,'utf8'))
    await test('cutover preserves historical production and legacy lots without importing them',async()=>{
        const data=await board(a); assert.equal(data.total_meters,0);assert.equal(data.cutover.historical_production_meters,100);assert.equal(data.cutover.legacy_lot_count,1)
        assert.equal((await admin.query('select count(*)::int n from fabric_stock_lots')).rows[0].n,1)
        assert.equal((await admin.query('select sum(meters)::numeric n from base_daily_production_allocations')).rows[0].n,'100.00')
    })
    await test('production creates quality stock exactly once on reviewed-save retries',async()=>{
        const saved=await save(a,dates[1],75.25);assert.equal(await balance(a),75.25)
        await a.query('select public.save_base_daily_production_reviewed($1,$2,$3,$4,$5,$6)',saved.payload)
        assert.equal(await balance(a),75.25);assert.equal((await board(a)).movements.length,1)
        const changed=[...saved.payload];changed[3]=JSON.stringify([row(80)])
        await assert.rejects(a.query('select public.save_base_daily_production_reviewed($1,$2,$3,$4,$5,$6)',changed),/different production/)
    })
    await test('opening is additive once, normalizes labels, and validates retry payloads',async()=>{
        const request=randomUUID();await adjust(a,50,'opening',null,request,'  COTTON  ');assert.equal(await balance(a),125.25)
        assert.equal((await adjust(a,50,'opening',null,request,'cotton')).duplicate,true)
        await assert.rejects(adjust(a,55,'opening',null,request),/different stock change/)
        await assert.rejects(adjust(a,50),/already recorded/)
    })
    await test('production replacement emits only the final net delta; zero reverses production',async()=>{
        await save(a,dates[1],95.25,await stamp(a,dates[1]),'Correct measured output');assert.equal(await balance(a),145.25)
        assert.equal((await board(a)).movements[0].meters_delta,20)
        await save(a,dates[1],0,await stamp(a,dates[1]),'Reverse duplicate output');assert.equal(await balance(a),50)
        assert.equal((await board(a)).movements[0].meters_delta,-95.25)
    })
    await test('historical corrections apply only the difference from the cutover baseline',async()=>{
        await save(a,dates[0],110,await stamp(a,dates[0]),'Historical measurement correction');assert.equal(await balance(a),60)
        const before=await stamp(a,dates[0]);await assert.rejects(save(a,dates[0],0,before,'Reverse historical output'),/exceeds available stock/)
        assert.equal(await balance(a),60);assert.equal(await stamp(a,dates[0]),before)
    })
    await test('reviewed balance corrections reject stale totals and repeated requests do not duplicate',async()=>{
        const request=randomUUID();await adjust(a,120,'correction',60,request);assert.equal(await balance(a),120)
        assert.equal((await adjust(a,120,'correction',60,request)).duplicate,true)
        await assert.rejects(adjust(a,115,'correction',60),/Stock changed/)
    })
    await test('simultaneous production in separate shifts loses no metres',async()=>{
        await Promise.all([save(a,dates[2],30),save(b,dates[3],40)])
        assert.equal(await balance(a),190)
    })
    await test('simultaneous retries of one production request save once',async()=>{
        const request=randomUUID();await Promise.all([save(a,dates[4],25,null,null,request),save(b,dates[4],25,null,null,request)])
        assert.equal(await balance(a),215)
    })
    await test('two reviewed stock corrections cannot overwrite one another',async()=>{
        const results=await Promise.allSettled([adjust(a,216,'correction',215),adjust(b,217,'correction',215)])
        assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
        assert.ok([216,217].includes(await balance(a)))
    })
    await test('job quality changes transfer production without changing total available metres',async()=>{
        const before=Number((await board(a)).total_meters)
        // Ensure sufficient pre-cutover stock before reclassifying all historical output.
        await adjust(a,before+100,'correction',before)
        await admin.query('update base_production_jobs set quality_label=$1 where id=$2',['Cotton Reclassified',cottonJob])
        assert.equal(Number((await board(a)).total_meters),before+100)
        assert.equal(await balance(a,'cotton reclassified'),205)
        await admin.query('update base_production_jobs set quality_label=$1 where id=$2',['Cotton',cottonJob])
        assert.equal(await balance(a),before+100)
    })
    await test('stock tables and RPCs isolate owners, reject supervisors and direct writes',async()=>{
        assert.equal((await board(outsider)).total_meters,0);assert.equal((await board(floor)).total_meters,0)
        await assert.rejects(adjust(floor,10),/Production access/)
        await assert.rejects(a.query('update quality_stock set meters=999'),/permission denied/)
        await assert.rejects(a.query('delete from quality_stock_movements'),/permission denied/)
        const quality=(await board(a)).qualities[0].id
        assert.equal((await outsider.query('select public.get_quality_stock_board($1) result',[quality])).rows[0].result.movements.length,0)
        await assert.rejects(outsider.query('insert into base_production_entries(org_id,job_id,worker_id,meters,worker_rate_snapshot) values($1,$2,$3,50,2)',[org,cottonJob,worker]),/row-level security|permission denied/)
    })
    await test('locked tenants, revoked owners, Lite and missing JWT roles cannot adjust stock',async()=>{
        await admin.query('update organizations set is_locked_down=true where id=$1',[org]);await assert.rejects(adjust(a,0,'correction',await balance(a)),/locked|restricted/i)
        await admin.query('update organizations set is_locked_down=false where id=$1',[org])
        await admin.query('update profiles set access_revoked_at=now() where id=$1',[owner]);await assert.rejects(adjust(a,0,'correction',0),/Production access/);assert.equal((await board(a)).total_meters,0)
        await admin.query('update profiles set access_revoked_at=null where id=$1',[owner])
        await admin.query("update org_subscriptions set plan_tier='lite' where org_id=$1",[org]);await assert.rejects(adjust(a,0,'correction',0),/Production access/)
        await admin.query("update org_subscriptions set plan_tier='base' where org_id=$1",[org])
        await a.query("select set_config('request.jwt.claims','{}',false)");await assert.rejects(adjust(a,0,'correction',0),/Production access/)
        await a.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'authenticated',sub:owner})])
    })
    await test('legacy stock insertions and public sale/adjustment functions are retired',async()=>{
        await assert.rejects(a.query("insert into fabric_stock_lots(org_id,quality_label,original_taka_count,available_taka_count,meters_per_taka,original_meters,available_meters) values($1,'Old',1,1,50,50,50)",[org]),/permission denied|retired/)
        const grants=await admin.query("select p.proname,has_function_privilege('authenticated',p.oid,'execute') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('record_fabric_stock_sale','adjust_fabric_stock_lot','create_party_stock_sale_dispatch_v1')")
        assert.ok(grants.rowCount>0);assert.ok(grants.rows.every(r=>!r.allowed))
        assert.equal((await admin.query('select count(*)::int n from fabric_stock_lots')).rows[0].n,1)
    })
    await test('Full Suite supervisor production and owner corrections use only new quality stock',async()=>{
        await admin.query("update org_subscriptions set plan_tier='premium' where org_id=$1",[org])
        await admin.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)")
        const order=randomUUID(), loom=randomUUID()
        await admin.query("insert into orders(id,org_id,party_name,quality_label,total_target_meters,deadline) values($1,$2,'Historical test order','Supervisor Cotton',10000,current_date+10)",[order,org])
        const oldWorker=(await admin.query("insert into workers(org_id,name,date_of_birth,age_verification_method,age_verification_reference,age_verified_at,age_verified_by) values($1,'Supervisor test worker','1990-01-01','other','Local fixture only',now(),$2) returning id",[org,owner])).rows[0].id
        await admin.query("insert into machines(id,org_id,name,status,current_order_id) values($1,$2,'Supervisor Test Loom','inactive',$3)",[loom,org,order])
        await admin.query("insert into machine_assignments(org_id,machine_id,worker_id,shift) values($1,$2,$3,'day')",[org,loom,oldWorker])
        await admin.query("update machines set status='active' where id=$1",[loom])
        const logs=[{machine_id:loom,worker_id:Number(oldWorker),order_id:order,meters:42.5,date:dates[5],shift:'day',worker_rate_snapshot:2}]
        await floor.query('select * from replace_shift_production_logs($1,false,false)',[JSON.stringify(logs)])
        assert.equal(await balance(a,'supervisor cotton'),42.5)
        logs[0].meters=40
        await a.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'authenticated',sub:owner,org_id:org,user_role:'owner'})])
        await a.query('select * from replace_shift_production_logs($1,true,false)',[JSON.stringify(logs)])
        assert.equal(await balance(a,'supervisor cotton'),40)
        await admin.query('update production_logs set meters=40.125 where machine_id=$1',[loom])
        assert.equal(await balance(a,'supervisor cotton'),40.13)
        const movementCount=(await board(a)).movements.length
        await admin.query("update orders set quality_label='Supervisor Cotton' where id=$1",[order])
        assert.equal((await board(a)).movements.length,movementCount)
        await admin.query('delete from production_logs where machine_id=$1',[loom])
        assert.equal(await balance(a,'supervisor cotton'),0)
        assert.equal((await admin.query('select count(*)::int n from fabric_stock_lots')).rows[0].n,1)
        await admin.query("update org_subscriptions set plan_tier='base' where org_id=$1",[org])
    })
    await test('historical pending dispatch still creates its package without debiting new quality stock',async()=>{
        await admin.query("update org_subscriptions set plan_tier='premium' where org_id=$1",[org])
        const before=(await board(a)).total_meters
        const result=(await a.query('select * from create_stock_sale_dispatch($1,$2,$3,$4,$5,current_date,null,null,null,null,null,null,null,$6,$7)',[org,legacyOrder,[legacySale],[50],[1],owner,randomUUID()])).rows[0]
        assert.equal(Number(result.qty_meters_sent),50)
        assert.equal((await board(a)).total_meters,before)
        assert.equal((await admin.query('select count(*)::int n from dispatch_package_lines where dispatch_id=$1',[result.dispatch_id])).rows[0].n,1)
        assert.equal(Number((await admin.query('select pending_dispatch_meters from fabric_stock_sales where id=$1',[legacySale])).rows[0].pending_dispatch_meters),0)
        await admin.query("update org_subscriptions set plan_tier='base' where org_id=$1",[org])
    })
    await test('history keyset pagination reads more than 50 movements without gaps',async()=>{
        let current=await balance(a)
        for(let i=0;i<55;i++){await adjust(a,current+1,'correction',current);current++}
        const seen=new Set();let cursor=null
        for(;;){const rows=(await a.query('select public.get_quality_stock_board(null,$1,$2) result',[cursor?.created_at??null,cursor?.id??null])).rows[0].result.movements
            for(const movement of rows.slice(0,50)){assert.ok(!seen.has(movement.id));seen.add(movement.id)}
            if(rows.length<=50)break;cursor=rows[49]
        }
        assert.equal(seen.size,(await admin.query('select count(*)::int n from quality_stock_movements where org_id=$1',[org])).rows[0].n)
    })
    console.log(`PASS ${checks} database scenarios on PostgreSQL ${(await admin.query('show server_version')).rows[0].server_version}`)
} finally {
    for(const db of connections) await db.end()
    if (process.env.STOCK_TEST_KEEP === '1') console.log(`Kept local database: ${database}`)
    else await root.query(`drop database if exists ${database} with (force)`)
    await root.end()
}
