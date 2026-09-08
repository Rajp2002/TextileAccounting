/** An unpaid local checkout cancellation must retain the original Free grant. */
import {readFileSync} from 'node:fs'
import {parseEnv} from 'node:util'
import {randomUUID} from 'node:crypto'
import {createServerClient} from '@supabase/ssr'
import assert from 'node:assert/strict'
const e=parseEnv(readFileSync('/tmp/weavly-free-local.env','utf8')),f=JSON.parse(readFileSync('/tmp/weavly-free-browser-fixture.json','utf8'))
assert.match(e.API_URL,/^http:\/\/127\.0\.0\.1:\d+$/)
const id=randomUUID(),headers={apikey:e.ANON_KEY,Authorization:`Bearer ${e.SERVICE_ROLE_KEY}`,'Content-Type':'application/json'}
let cookies=[]
const client=createServerClient(e.API_URL,e.ANON_KEY,{cookies:{getAll:()=>cookies,setAll:values=>{for(const v of values){cookies=cookies.filter(c=>c.name!==v.name);cookies.push(v)}}}})
const {error}=await client.auth.setSession({access_token:f.accessToken,refresh_token:f.refreshToken});assert.ifError(error)
const cookie=cookies.map(c=>`${c.name}=${c.value}`).join('; ')
const response=await fetch(e.API_URL+'/rest/v1/org_subscriptions',{method:'POST',headers,body:JSON.stringify({id,org_id:f.orgId,plan_id:'weavly_lite_2026',plan_tier:'lite',status:'cancelled',billing_model:'upfront_first_year_plus_annual_renewal',razorpay_order_id:'order_cancelled_local_'+id,checkout_purchase_type:'initial_purchase',checkout_amount_paise:299900,checkout_currency:'INR'})});assert.equal(response.status,201)
try {
 const r=await fetch('http://localhost:3100/api/free/status',{headers:{Cookie:cookie}});assert.equal(r.status,200)
 const status=await r.json();assert.equal(status.plan,'free');assert.equal(status.accessState,'active');assert.equal(status.quota.remaining,0)
 console.log('PASS: production build retains active Free and original exhausted allowance after an unpaid cancelled Lite checkout')
} finally {
 const r=await fetch(e.API_URL+'/rest/v1/org_subscriptions?id=eq.'+id,{method:'DELETE',headers});assert.equal(r.status,204)
}
