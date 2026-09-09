/** Local Auth + Data API evidence. No production URL or credentials accepted. */
import {readFileSync,writeFileSync} from 'node:fs'
import {parseEnv} from 'node:util'
import {randomUUID,randomBytes} from 'node:crypto'
import assert from 'node:assert/strict'
const envPath=process.argv[2]
assert.match(envPath??'',/^\/tmp\/weavly-free-/)
const env=parseEnv(readFileSync(envPath,'utf8')),url=env.API_URL
assert.match(url??'',/^http:\/\/127\.0\.0\.1:\d+$/)
const adminHeaders={apikey:env.ANON_KEY,Authorization:`Bearer ${env.SERVICE_ROLE_KEY}`,'Content-Type':'application/json'}
async function request(path,{method='GET',body,token,expected=200}={}){
 const response=await fetch(url+path,{method,headers:token?{...adminHeaders,Authorization:`Bearer ${token}`}:{...adminHeaders},body:body===undefined?undefined:JSON.stringify(body)})
 const text=await response.text();assert.equal(response.status,expected,`${method} ${path} returned ${response.status}: ${text.slice(0,150)}`)
 return text?JSON.parse(text):null
}
const suffix=randomUUID().slice(0,8),password=`FreeTest!${randomBytes(12).toString('hex')}`
const user=await request('/auth/v1/admin/users',{method:'POST',body:{email:`free-${suffix}@weavly.test`,password,email_confirm:true,app_metadata:{free_signup:true}},expected:200})
const id=user.id,org=randomUUID()
await request('/rest/v1/organizations',{method:'POST',body:{id:org,name:`FREE-BROWSER-${suffix}`,owner_id:id,product_experience:'base',onboarding_complete:true},expected:201})
await request('/rest/v1/profiles',{method:'POST',body:{id,org_id:org,role:'owner',full_name:'Free Browser Test',email:user.email,phone:'9876543210'},expected:201})
await request('/auth/v1/admin/users/'+id,{method:'PUT',body:{app_metadata:{free_signup:true,role:'owner',org_id:org,onboarding_complete:true}}})
await request('/rest/v1/free_rollout?singleton=eq.true',{method:'PATCH',body:{enrollment_enabled:true,estimation_enabled:true,tour_enabled:true},expected:204})
await request('/rest/v1/rpc/provision_free_account',{method:'POST',body:{p_user_id:id,p_org_id:org,p_verified_at:user.email_confirmed_at},expected:204})
await request('/rest/v1/rpc/provision_free_account',{method:'POST',body:{p_user_id:id,p_org_id:org,p_verified_at:user.email_confirmed_at},expected:204})
const session=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:user.email,password}})
const token=session.access_token
for(const path of ['/rest/v1/cost_rate_book?select=*','/rest/v1/estimator_quotes?select=*','/rest/v1/estimator_templates?select=*'])await request(path,{token,expected:403})
await request('/rest/v1/rpc/free_server_time',{method:'POST',body:{},token,expected:403})
await request('/rest/v1/profiles?select=id,full_name',{token})
await request('/rest/v1/profiles?id=eq.'+id,{method:'PATCH',body:{org_id:randomUUID()},token,expected:403})
console.log('PASS: real Auth login; Data API Rate Book, saved costings, qualities, private RPC and profile reparenting denied')
// A planted paid rate proves the Free boundary is enforced even when data exists.
await request('/rest/v1/cost_rate_book',{method:'POST',body:{org_id:org,name:'FREE-LEAK-SENTINEL',category:'yarn_warp',unit:'per_kg',current_value:987.6543},expected:201})
await request('/rest/v1/cost_rate_book?select=*',{token,expected:403})
writeFileSync('/tmp/weavly-free-browser-fixture.json',JSON.stringify({email:user.email,password,userId:id,orgId:org,accessToken:token,refreshToken:session.refresh_token}),{mode:0o600})
console.log('PASS: fixture credentials stored in a restricted local file; no secrets printed')
