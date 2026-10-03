import { beforeEach,describe,it,expect,vi } from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({session:vi.fn(),grant:vi.fn(),rollout:vi.fn(),access:vi.fn(),rpc:vi.fn(),rate:vi.fn()}))
vi.mock('../lib/auth',()=>({getCachedSession:mocks.session}))
vi.mock('../lib/free-account',()=>({getFreeGrant:mocks.grant,getFreeRollout:mocks.rollout,finishFreeProvisioning:vi.fn()}))
vi.mock('../lib/subscription',()=>({getOrgPlanAccess:mocks.access}))
vi.mock('../lib/rate-limit',()=>({checkAuthRateLimit:mocks.rate}))
vi.mock('../lib/supabase/admin',()=>({createAdminClient:()=>({rpc:mocks.rpc,from:()=>({select:()=>({eq:()=>({single:async()=>({data:{owner_id:'11111111-1111-4111-8111-111111111111',is_locked_down:false,name:'test'}})})})})})}))
import {calculateFreeSubmission,freeError} from '../lib/free-service'
import {makeFreeEstimate} from '../lib/free-estimator-defaults'
import {issueFreeRequest} from '../lib/free-request-identity'
import {calcFullTotals,COSTING_CALCULATION_VERSION} from '../lib/estimator'
const user='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222'
function valid(){const state=makeFreeEstimate();state.warpRows[0]={...state.warpRows[0],calcDenier:100,beamEnds:4000,yarnRate:200};state.weftRows[0]={...state.weftRows[0],calcDenier:150,picks:60,reedSpace:150,yarnRate:230};state.perPickCostPaisa=.16;state.overheadOverridePerM=2;return state}
function token(subjectId=user){return issueFreeRequest({subjectId,engineVersion:COSTING_CALCULATION_VERSION,keyId:'test',keys:{test:'a'.repeat(32)},serverTime:new Date(),lifetimeMs:86400000})}
beforeEach(()=>{
 vi.clearAllMocks();process.env.WEAVLY_FREE_SIGNING_KEY_ID='test';process.env.WEAVLY_FREE_SIGNING_KEYS=JSON.stringify({test:'a'.repeat(32)})
 mocks.session.mockResolvedValue({user:{id:user,app_metadata:{}},profile:{role:'owner',org_id:org}})
 mocks.grant.mockResolvedValue({subjectId:user,state:'active'});mocks.access.mockResolvedValue({effectiveTier:'free'});mocks.rollout.mockResolvedValue({estimation_enabled:true});mocks.rate.mockResolvedValue(null);mocks.rpc.mockResolvedValue({data:{used:1,remaining:1}})
})
describe('Free service response and authorization boundary',()=>{
 it('returns the authoritative engine result only after a committed receipt',async()=>{
  const estimate=valid(),result=await calculateFreeSubmission({estimate,requestToken:token()})
  expect(result.totals).toEqual(calcFullTotals(estimate));expect(mocks.rpc).toHaveBeenCalledOnce()
  const args=mocks.rpc.mock.calls[0][1];expect(Object.keys(args).sort()).toEqual(['p_user_id','p_org_id','p_request_id','p_input_binding','p_engine_version','p_issued_at','p_label','p_estimate','p_result','p_totals'].sort())
  expect(mocks.rpc.mock.calls[0][0]).toBe('complete_free_saved_costing');expect(args.p_estimate).toEqual(estimate);expect(args.p_result.productionCostPerM).toBeGreaterThan(0)
  expect(args.p_input_binding).toMatch(/^[a-f0-9]{64}$/);expect(args.p_org_id).toBe(org)
 })
 it('withholds a fresh result on exhausted quota or ambiguous commit failure',async()=>{
  mocks.rpc.mockResolvedValue({error:{message:'FREE_QUOTA_EXHAUSTED'}})
  await expect(calculateFreeSubmission({estimate:valid(),requestToken:token()})).rejects.toThrow('FREE_QUOTA_EXHAUSTED')
  mocks.rpc.mockResolvedValue({error:{message:'connection lost'}})
  await expect(calculateFreeSubmission({estimate:valid(),requestToken:token()})).rejects.toThrow('FREE_RETRY_SAME_REQUEST')
 })
 it('does not debit validation failures, foreign identities or guests',async()=>{
  await expect(calculateFreeSubmission({estimate:makeFreeEstimate(),requestToken:token()})).rejects.toThrow('FREE_INVALID_INPUT')
  await expect(calculateFreeSubmission({estimate:valid(),requestToken:token(org)})).rejects.toThrow()
  mocks.session.mockResolvedValue(null);await expect(calculateFreeSubmission({estimate:valid(),requestToken:token()})).rejects.toThrow('FREE_AUTH_REQUIRED');expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it('keeps suspension, short-term throttling and paused metering distinct',async()=>{
  mocks.grant.mockResolvedValue({subjectId:user,state:'suspended'});await expect(calculateFreeSubmission({estimate:valid()})).rejects.toThrow('FREE_ACCESS_INACTIVE')
  mocks.grant.mockResolvedValue({subjectId:user,state:'active'});mocks.rate.mockResolvedValue(Date.now()+60000);await expect(calculateFreeSubmission({estimate:valid()})).rejects.toThrow('FREE_THROTTLED')
  mocks.rate.mockResolvedValue(null);mocks.rollout.mockResolvedValue({estimation_enabled:false});await expect(calculateFreeSubmission({estimate:valid()})).rejects.toThrow('FREE_PAUSED');expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it('does not meter verified paid access even while Free estimation is paused',async()=>{
  mocks.access.mockResolvedValue({effectiveTier:'lite'});mocks.rollout.mockResolvedValue({estimation_enabled:false})
  const paid=await calculateFreeSubmission({estimate:valid()});expect(paid.paid).toBe(true);expect(paid.outcome).toBe('paid_result');expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it('returns non-content warning fields without charging until explicit acknowledgement',async()=>{
  const estimate=valid();estimate.warpRows[0].yarnRate=1500
  const result=await calculateFreeSubmission({estimate,requestToken:token()});expect(result.needsAcknowledgement).toBe(true);expect(result.outcome).toBe('review_required');expect(Object.keys(result).sort()).toEqual(['needsAcknowledgement','outcome','warningFields'])
  expect(mocks.rpc).not.toHaveBeenCalled()
  const saved=await calculateFreeSubmission({estimate,requestToken:token(),warningsAcknowledged:true});expect(saved.outcome).toBe('saved');expect(mocks.rpc).toHaveBeenCalledOnce()
 })
 it('INVARIANT CS-3: production without a valid signing key refuses before any debit and logs setting names only',async()=>{
  vi.stubEnv('NODE_ENV','production');delete process.env.WEAVLY_FREE_SIGNING_KEYS
  const log=vi.spyOn(console,'error').mockImplementation(()=>{})
  try{
   await expect(calculateFreeSubmission({estimate:valid(),requestToken:token()})).rejects.toThrow('FREE_SIGNING_KEY_UNAVAILABLE');expect(mocks.rpc).not.toHaveBeenCalled()
   log.mockClear();process.env.WEAVLY_FREE_SIGNING_KEYS=JSON.stringify({test:'short-secret-value'})
   await expect(calculateFreeSubmission({estimate:valid(),requestToken:token()})).rejects.toThrow('FREE_SIGNING_KEY_UNAVAILABLE');expect(mocks.rpc).not.toHaveBeenCalled()
   expect(log).toHaveBeenCalledOnce();expect(String(log.mock.calls[0][0])).toContain('WEAVLY_FREE_SIGNING_KEYS');expect(JSON.stringify(log.mock.calls)).not.toContain('short-secret-value')
   const response=freeError(new Error('FREE_SIGNING_KEY_UNAVAILABLE'));expect(response.status).toBe(503);expect(await response.json()).toEqual({code:'FREE_TEMPORARY_ERROR'})
  }finally{log.mockRestore();vi.unstubAllEnvs()}
 })
})
