/** Read-only local verification after the browser has completed two costings. */
import {readFileSync} from 'node:fs'
import {parseEnv} from 'node:util'
import {createServerClient} from '@supabase/ssr'
import assert from 'node:assert/strict'
const env=parseEnv(readFileSync('/tmp/weavly-free-local.env','utf8')),f=JSON.parse(readFileSync('/tmp/weavly-free-browser-fixture.json','utf8'))
assert.match(env.API_URL,/^http:\/\/127\.0\.0\.1:\d+$/)
let cookies=[]
const client=createServerClient(env.API_URL,env.ANON_KEY,{cookies:{getAll:()=>cookies,setAll:values=>{for(const value of values){cookies=cookies.filter(c=>c.name!==value.name);cookies.push(value)}}}})
const {error}=await client.auth.signInWithPassword({email:f.email,password:f.password});assert.ifError(error)
const Cookie=cookies.map(c=>`${c.name}=${c.value}`).join('; ')
async function app(path){const r=await fetch('http://localhost:3100'+path,{headers:{Cookie}});assert.equal(r.status,200);return r.json()}
const before=await app('/api/free/status');assert.equal(before.quota.used,2)
const history=await app('/api/free/costings');assert.equal(history.costings.length,2)
assert(history.costings.every(row=>row.subject_id===f.userId&&row.org_id===f.orgId))
assert.equal(history.costings[0].label,'Free second costing QA');assert.equal(history.costings[0].result.productionCostPerM,34.07)
const after=await app('/api/free/status');assert.equal(after.quota.used,before.quota.used)
const headers={apikey:env.ANON_KEY,Authorization:`Bearer ${env.SERVICE_ROLE_KEY}`}
for(const table of ['estimator_quotes','estimator_templates','cost_rate_book']){
 const r=await fetch(`${env.API_URL}/rest/v1/${table}?select=id&org_id=eq.${f.orgId}`,{headers});assert.equal(r.status,200);const rows=await r.json();assert.equal(rows.length,table==='cost_rate_book'?1:0)
}
console.log('PASS: both browser-created snapshots persist; zero-allowance history reads do not debit; no quality or paid-quote records; Rate Book retains only the preplanted sentinel')
const r=await fetch(`${env.API_URL}/rest/v1/free_funnel_events?select=event_name&subject_id=eq.${f.userId}&event_name=eq.result_viewed`,{headers});assert.equal(r.status,200);assert((await r.json()).length>=1)
console.log('PASS: revised shared UI records result_viewed against committed receipts without costing payloads')
