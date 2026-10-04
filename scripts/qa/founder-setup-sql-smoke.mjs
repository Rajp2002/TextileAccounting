// Disposable loopback smoke test of the manual operator templates.
// Always substitutes reserved synthetic UUID/email fixtures; never reads env
// files or connects to a hosted project. Run from the repository root.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { startDisposableCluster, connect, createSupabaseRoles, installSupabaseStubs, replayMigrations } from '../test-db/cluster.mjs'
const raw = readFileSync('docs/admin-console/FOUNDER_SELF_SETUP.sql', 'utf8')
const fixtureEmail = 'founder@example.test'
const cluster = await startDisposableCluster()
const root = connect(cluster)
await root.connect()
let count = 0
try {
  await createSupabaseRoles(root)
  await root.query('CREATE DATABASE founder_setup_template')
  const base = connect({...cluster, database:'founder_setup_template'})
  await base.connect()
  await installSupabaseStubs(base)
  await replayMigrations(base, 'supabase/migrations')
  const precheck = readFileSync('docs/admin-console/MIGRATION_PRECHECK.sql', 'utf8')
  await base.query('CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text)')
  const rows = [...precheck.matchAll(/\('(\d{14})', '([^']+)'\)/g)]
  assert.equal(rows.length,10)
  for (const row of rows) await base.query('INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES($1,$2)', [row[1],row[2]])
  const precheckResult = await base.query(precheck)
  assert.equal(precheckResult[0].rows.length,10)
  assert(precheckResult[0].rows.every(row=>row.recorded_applied))
  assert(precheckResult[1].rows.every(row=>row.installed))
  await base.query('DELETE FROM supabase_migrations.schema_migrations WHERE version=$1',[rows[0][1]])
  const missingResult = await base.query(precheck)
  assert.equal(missingResult[0].rows.filter(row=>!row.recorded_applied).length,1)
  console.log('PASS migration precheck syntax, complete history/objects and missing-history detection')
  await base.end()
  async function scenario(name, arrange, expectFailure) {
    const database = `setup_${randomUUID().replaceAll('-', '')}`
    await root.query(`CREATE DATABASE ${database} TEMPLATE founder_setup_template`)
    const db = connect({...cluster, database})
    await db.connect()
    const userId = randomUUID()
    try {
      await arrange(db, userId)
      const sql = raw.replace('PASTE_YOUR_AUTH_USER_UUID_HERE',userId).replaceAll('rajpatel86420@gmail.com', fixtureEmail)
      let error
      try { await db.query(sql) } catch(e) { error=e; await db.query('ROLLBACK') }
      if (expectFailure) {
        await db.query('RESET ROLE')
        assert(error && expectFailure.test(error.message), `${name}: expected failure, received ${error?.message}`)
        const result=await db.query('SELECT count(*)::int AS n FROM private.admin_audit_events')
        assert.equal(result.rows[0].n,0, 'Rejected setup must create no audit or partial writes')
      } else {
        assert.equal(error,undefined)
        const p=(await db.query('SELECT role,org_id,access_revoked_at FROM public.profiles WHERE id=$1',[userId])).rows[0]
        assert.deepEqual(p,{role:'admin',org_id:null,access_revoked_at:null})
        const g=(await db.query('SELECT enabled,revoked_at,login_email FROM private.platform_founder_grants WHERE user_id=$1',[userId])).rows[0]
        assert.deepEqual(g,{enabled:true,revoked_at:null,login_email:fixtureEmail})
        await db.query(sql)
        assert.equal((await db.query('SELECT count(*)::int AS n FROM private.admin_audit_events')).rows[0].n,1)
        const sessionId=randomUUID()
        await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal1')",[sessionId,userId])
        await db.query("SELECT set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)")
        await db.query('SET ROLE service_role')
        const aal1=(await db.query("SELECT public.admin_founder_session($1,$2,'establish') AS result",[userId,sessionId])).rows[0].result
        assert.equal(aal1.allowed,false); assert.equal(aal1.code,'MFA_REQUIRED')
        await db.query('RESET ROLE')
        await db.query("UPDATE auth.sessions SET aal='aal2' WHERE id=$1",[sessionId])
        await db.query('SET ROLE service_role')
        const aal2=(await db.query("SELECT public.admin_founder_session($1,$2,'establish') AS result",[userId,sessionId])).rows[0].result
        assert.equal(aal2.allowed,true)
      }
      count++; console.log(`PASS ${name}`)
    } finally { await db.end() }
  }
  const auth = async(db,id,confirmed=true,email=fixtureEmail)=>db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,$3)',[id,email,confirmed?new Date():null])
  await scenario('new dedicated profile, grant and audit; idempotent retry; AAL1 denial/AAL2 grant', auth)
  await scenario('wrong email refused', (db,id)=>auth(db,id,true,'other@example.test'), /UUID\/email not found/)
  await scenario('unconfirmed email refused', (db,id)=>auth(db,id,false), /email unconfirmed/)
  await scenario('deleted owner profile with surviving factory refused', async(db,id)=>{await auth(db,id);await db.query("INSERT INTO public.organizations(id,name,owner_id) VALUES($1,'Synthetic fixture factory',$2)",[randomUUID(),id])}, /Account still owns a factory/)
  await scenario('existing owner profile refused', async(db,id)=>{await auth(db,id);await db.query("INSERT INTO public.profiles(id,role) VALUES($1,'owner')",[id])}, /Existing profile/)
  await scenario('existing revoked admin refused', async(db,id)=>{await auth(db,id);await db.query("INSERT INTO public.profiles(id,role,access_revoked_at) VALUES($1,'admin',now())",[id])}, /Existing profile/)
  await scenario('another founder refused and new profile insertion rolled back', async(db,id)=>{await auth(db,id);const other=randomUUID();await auth(db,other,true,'other@example.test');await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,login_email,grant_reason) VALUES($1,true,'other@example.test','Synthetic fixture')",[other])}, /Another founder/)
  await scenario('revoked grant cannot be reenabled', async(db,id)=>{await auth(db,id);await db.query("INSERT INTO private.platform_founder_grants(user_id,enabled,revoked_at,login_email,grant_reason) VALUES($1,false,now(),$2,'Synthetic fixture')",[id,fixtureEmail])}, /Existing grant/)
  await scenario('ordinary application role denied', async(db,id)=>{await auth(db,id);await db.query('SET ROLE authenticated')}, /permission denied|Run this reviewed setup/)
  console.log(JSON.stringify({passed:count,realCustomerFixtures:false,host:cluster.host}))
} finally { await root.end();cluster.stop() }
