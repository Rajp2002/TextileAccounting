/** Exercise existing trusted activation transaction using a synthetic LOCAL order. No gateway call. */
import {readFileSync} from 'node:fs'
import {parseEnv} from 'node:util'
import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
const fixturePath=process.argv[2]??'/tmp/weavly-free-ui-fixture.json'
assert.match(fixturePath,/^\/tmp\/weavly-free-[^/]+\.json$/)
const e=parseEnv(readFileSync('/tmp/weavly-free-local.env','utf8')),f=JSON.parse(readFileSync(fixturePath,'utf8'))
assert.match(e.API_URL,/^http:\/\/127\.0\.0\.1:\d+$/)
const headers={apikey:e.ANON_KEY,Authorization:`Bearer ${e.SERVICE_ROLE_KEY}`,'Content-Type':'application/json'}
async function call(path,body,expected=200){const r=await fetch(e.API_URL+'/rest/v1/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});const text=await r.text();assert.equal(r.status,expected,text);return text?JSON.parse(text):null}
const previous=(await call('org_subscriptions?select=razorpay_order_id,razorpay_payment_id&org_id=eq.'+f.orgId+'&plan_tier=eq.lite'))[0]
const order=previous?.razorpay_order_id??'order_free_local_'+randomUUID(),payment=previous?.razorpay_payment_id??'pay_free_local_'+randomUUID()
if(!previous)await call('org_subscriptions',{org_id:f.orgId,plan_tier:'lite',plan_id:'weavly_lite_2026',status:'created',billing_model:'upfront_first_year_plus_annual_renewal',checkout_purchase_type:'initial_purchase',checkout_amount_paise:299900,checkout_currency:'INR',razorpay_order_id:order},201)
const p={p_org_id:f.orgId,p_razorpay_order_id:order,p_razorpay_payment_id:payment,p_amount_paise:299900,p_method:'upi',p_plan_tier:'lite',p_purchase_type:'initial_purchase',p_currency:'INR'}
for(const change of [{p_amount_paise:1},{p_currency:'USD'},{p_org_id:randomUUID()}])await call('rpc/activate_order_billing_purchase',{...p,...change},change.p_org_id&&previous?.razorpay_payment_id?409:400)
assert.equal((await call('estimator_quotes?select=id&org_id=eq.'+f.orgId)).length,0)
const result=await call('rpc/activate_order_billing_purchase',p);assert.equal(result.success,true)
assert.equal((await call('rpc/activate_order_billing_purchase',p)).alreadyProcessed,true)
assert.equal((await call('free_funnel_events?select=event_id&subject_id=eq.'+f.userId+'&event_name=eq.paid_activation')).length,1)
assert.equal((await call('estimator_quotes?select=id&org_id=eq.'+f.orgId)).length,0)
console.log('PASS: wrong amount/currency/account rejected; local captured activation succeeds once; retry deduplicates; exactly one paid activation event; no automatic costing save')
