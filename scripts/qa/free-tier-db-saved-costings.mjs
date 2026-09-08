/** Isolated local-only verification of atomic saved snapshots. */
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
const exec=promisify(execFile),container='supabase_db_weavly-free-sprint-20260908'
const sql=async query=>(await exec('docker',['exec',container,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1','-c',query])).stdout.trim()
const user=randomUUID(),org=randomUUID(),issued=new Date().toISOString()
const call=(id,label='Snapshot',binding='a'.repeat(64))=>`SET ROLE service_role; SELECT public.complete_free_saved_costing('${user}','${org}','${id}','${binding}','v1','${issued}','${label}','{"manual":true}','{"productionCostPerM":34.07}','{"totalProductionCostPerM":34.07}');`
const result=async(...args)=>JSON.parse((await sql(call(...args))).split('\n').at(-1))
try{
 await sql(`INSERT INTO auth.users(id,email) VALUES('${user}','${user}@free.test'); INSERT INTO public.organizations(id,name,owner_id,product_experience,onboarding_complete) VALUES('${org}','FREE-SAVED-TEST','${user}','base',true); INSERT INTO public.profiles(id,org_id,role) VALUES('${user}','${org}','owner'); INSERT INTO public.free_account_subjects(id,beta_allowed,verified_at) VALUES('${user}',true,now()); INSERT INTO public.free_account_grants(org_id,subject_id) VALUES('${org}','${user}'); UPDATE public.free_rollout SET estimation_enabled=true;`)
 await assert.rejects(sql(call(randomUUID(),'')),e=>String(e.stderr).includes('check constraint'))
 assert.equal(Number(await sql(`SELECT count(*) FROM public.free_weekly_usage WHERE subject_id='${user}'`)),0)
 assert.equal(Number(await sql(`SELECT count(*) FROM public.free_calculation_receipts WHERE subject_id='${user}'`)),0)
 console.log('PASS: snapshot constraint failure rolls back both quota and receipt')
 const id=randomUUID(),duplicates=await Promise.all(Array.from({length:10},()=>result(id)))
 assert(duplicates.every(r=>r.used===1&&r.savedCostingId===id))
 assert.equal(Number(await sql(`SELECT count(*) FROM public.free_saved_costings WHERE subject_id='${user}'`)),1)
 await result(id,'Changed label')
 assert.equal(await sql(`SELECT label FROM public.free_saved_costings WHERE id='${id}'`),'Snapshot')
 console.log('PASS: 10 concurrent duplicate submissions save and debit exactly once; snapshot stays immutable on retry')
 const raced=await Promise.allSettled(Array.from({length:20},()=>result(randomUUID())))
 assert.equal(raced.filter(r=>r.status==='fulfilled').length,1)
 assert.equal(Number(await sql(`SELECT count(*) FROM public.free_saved_costings WHERE subject_id='${user}'`)),2)
 assert.equal(Number(await sql(`SELECT used FROM public.free_weekly_usage WHERE subject_id='${user}'`)),2)
 for(const table of ['estimator_quotes','estimator_templates','cost_rate_book'])assert.equal(Number(await sql(`SELECT count(*) FROM public.${table} WHERE org_id='${org}'`)),0)
 console.log('PASS: one remaining allowance admits one of 20 concurrent requests; no paid costing/quality/Rate Book propagation')
 for(const role of ['anon','authenticated']){
  await assert.rejects(sql(`SET ROLE ${role}; SELECT * FROM public.free_saved_costings`),e=>String(e.stderr).includes('permission denied'))
  await assert.rejects(sql(call(randomUUID()).replace('service_role',role)),e=>String(e.stderr).includes('permission denied'))
 }
 await sql(`DELETE FROM public.free_calculation_receipts WHERE subject_id='${user}'`)
 assert.equal(Number(await sql(`SELECT count(*) FROM public.free_saved_costings WHERE subject_id='${user}'`)),2)
 console.log('PASS: client roles cannot read/write snapshots directly; receipt expiry does not remove saved history')
 await sql(`DELETE FROM public.profiles WHERE org_id='${org}'; DELETE FROM public.organizations WHERE id='${org}'`)
 assert.equal(Number(await sql(`SELECT count(*) FROM public.free_saved_costings WHERE subject_id='${user}'`)),0)
 console.log('PASS: account organization deletion cascades saved snapshot content')
}finally{await sql(`DELETE FROM public.profiles WHERE org_id='${org}'; DELETE FROM public.organizations WHERE id='${org}'; DELETE FROM auth.users WHERE id='${user}';`)}
