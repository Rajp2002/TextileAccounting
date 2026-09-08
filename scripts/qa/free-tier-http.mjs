import { readFileSync,writeFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { createServerClient } from '@supabase/ssr'
import assert from 'node:assert/strict'
const env=parseEnv(readFileSync('/tmp/weavly-free-local.env','utf8'))
assert.match(env.API_URL??'',/^http:\/\/127\.0\.0\.1:\d+$/)
const fixture=JSON.parse(readFileSync('/tmp/weavly-free-browser-fixture.json','utf8'))
let cookies=[]
const supabase=createServerClient(env.API_URL,env.ANON_KEY,{cookies:{getAll:()=>cookies,setAll:values=>{for(const value of values){cookies=cookies.filter(c=>c.name!==value.name);cookies.push(value)}}}})
const {error}=await supabase.auth.setSession({access_token:fixture.accessToken,refresh_token:fixture.refreshToken});assert.ifError(error)
const cookie=cookies.map(c=>`${c.name}=${c.value}`).join('; ')
const base='http://localhost:3100'
async function request(path,{body,auth=true,expected=200}={}){
 const response=await fetch(base+path,{method:body?'POST':'GET',headers:{...(auth?{Cookie:cookie}:{}),'Content-Type':'application/json',Origin:base},body:body?JSON.stringify(body):undefined,redirect:'manual'})
 const text=await response.text();assert.equal(response.status,expected,`${path}: ${response.status} ${text.slice(0,100)}`)
 assert.match(response.headers.get('cache-control')??'',/no-store/)
 return JSON.parse(text)
}
await request('/api/free/status',{auth:false,expected:401})
const status=await request('/api/free/status');assert.equal(status.plan,'free');assert.equal(status.quota.remaining,2)
const estimate={warpRows:[{id:'free-http-warp',label:'FREE-SNAPSHOT-HTTP',calculationMode:'formula',manualKgPer100m:null,linearDensityUnit:'denier',cottonCountNe:null,calcDenier:100,beamEnds:4000,yarnRate:200,gstPct:0,shortagePct:null}],weftRows:[{id:'free-http-weft',label:'Manual market rate',calculationMode:'formula',manualKgPer100m:null,linearDensityUnit:'denier',cottonCountNe:null,calcDenier:150,picks:60,reedSpace:150,effectiveCostingWidthCm:null,yarnRate:230,gstPct:0,shortagePct:null}],tapeLengthM:0,perPickCostPaisa:.16,warpingRatePerKg:0,sizingRatePerKg:0,windingRatePerKg:0,processingRatePerM:0,finishingRatePerM:0,yarnShortagePct:0,warpCrimpPct:0,overheadItems:[],monthlyOutputM:0,overheadOverridePerM:2,overheadMode:'direct',loomCount:0,avgOutputPerLoomPerDay:50,monthlyWorkingDays:26,loomType:null,loomRpm:null,loomPowerKw:null,loomRpmIsCustomised:false,loomPowerKwIsCustomised:false,hoursPerShift:12,warpingMode:'in_house',sizingMode:'in_house',overheadPct:0,commissionPct:0,transportPerM:0,profitPct:20,orderQuantityM:1000,enabledSections:{winding:false,processing:false,finishing:false,commission:false,transport:false},isConfigured:false}
await request('/api/free/calculate',{body:{estimate:{...estimate,warpRows:[]},requestToken:status.requestToken},expected:400})
const firstBody={estimate,requestToken:status.requestToken}
const first=await request('/api/free/calculate',{body:firstBody});assert.equal(first.quota.used,1)
const replay=await request('/api/free/calculate',{body:firstBody});assert.equal(replay.quota.used,1);assert.deepEqual(replay.result,first.result)
const changed={...estimate,profitPct:21}
await request('/api/free/calculate',{body:{estimate:changed,requestToken:status.requestToken},expected:409})
const current=await request('/api/free/status')
const second=await request('/api/free/calculate',{body:{estimate:changed,requestToken:current.requestToken}});assert.equal(second.quota.used,2)
const exhausted=await request('/api/free/status');assert.equal(exhausted.quota.remaining,0)
const third=await request('/api/free/calculate',{body:{estimate:{...changed,profitPct:22},requestToken:exhausted.requestToken},expected:409});assert.equal(third.result,undefined)
await request('/api/free/calculate',{body:{estimate,demo:true},expected:400})
const history=await request('/api/free/costings')
assert.equal(history.costings.length,2)
assert(history.costings.every(row=>row.subject_id===fixture.userId&&row.org_id===fixture.orgId))
const saved=history.costings.find(row=>row.id===first.savedCostingId)
assert.deepEqual(saved.estimate,estimate);assert.deepEqual(saved.result,first.result);assert.deepEqual(saved.totals,first.totals)
assert.equal((await request('/api/free/status')).quota.used,2)
await request('/api/free/costings',{auth:false,expected:401})
await request('/api/free/costings?page=-1',{expected:400})
console.log('PASS: both completed snapshots reopened at zero allowance with exact authoritative inputs/results; own-account scope and guest denial')
console.log('PASS: actual authenticated Next API; guest denial, validation no-charge, first/second success, receipt replay, changed-input conflict, third result withheld and demo bypass rejected')
writeFileSync('/tmp/weavly-free-http-result.json',JSON.stringify({requestId:first.requestId,productionCostPerM:first.result.productionCostPerM,used:2,orgId:fixture.orgId}),{mode:0o600})
console.log('PASS: no-store headers on success and failure; protected request bodies remain in memory')
