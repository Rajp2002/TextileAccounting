import {beforeEach,describe,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({context:vi.fn(),from:vi.fn(),rpc:vi.fn(),queries:[] as Array<{table:string;filters:unknown[][]}>,receiptError:false}))
vi.mock('@/lib/free-service',()=>({freeContext:mocks.context,freeError:(error:Error)=>Response.json({code:error.message},{status:error.message==='FREE_INVALID_INPUT'?400:503})}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({from:mocks.from,rpc:mocks.rpc})}))
import {GET} from '@/app/api/free/costings/route'
const requestId='33333333-3333-4333-8333-333333333333'
beforeEach(()=>{
 vi.clearAllMocks();mocks.queries.length=0;mocks.receiptError=false
 mocks.context.mockResolvedValue({grant:{subjectId:'owner',state:'active'},profile:{org_id:'factory'},paid:false,access:{effectiveTier:'free'}})
 mocks.rpc.mockResolvedValue({data:'2026-10-04T00:10:00Z'})
 mocks.from.mockImplementation((table:string)=>{
  const query={table,filters:[] as unknown[][]};mocks.queries.push(query)
  const builder={
   select:vi.fn().mockImplementation(()=>builder),
   eq:vi.fn().mockImplementation((...args:unknown[])=>{query.filters.push(['eq',...args]);return builder}),
   in:vi.fn().mockImplementation((...args:unknown[])=>{query.filters.push(['in',...args]);return builder}),
   order:vi.fn().mockImplementation(()=>builder),range:vi.fn().mockImplementation(()=>builder),
   then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(table==='free_saved_costings'
    ?{data:[{id:'saved',created_at:'2026-10-04T00:00:00Z',updated_at:'2026-10-04T00:00:00Z',revision:1}]}
    :mocks.receiptError?{data:null,error:{message:'offline'}}:{data:[{request_id:requestId}]}).then(resolve),
  }
  return builder
 })
})
describe('released revision history lookup',()=>{
 it('restricts confirmed receipts to requested ids and the authenticated owner and organization',async()=>{
  const response=await GET(new Request(`https://example.test/api/free/costings?recalculationRequests=${requestId}`))
  expect(response.status).toBe(200)
  expect((await response.json()).recalculationRequestIds).toEqual([requestId])
  expect(mocks.queries.find(query=>query.table==='free_costing_recalculation_receipts')?.filters).toEqual([
   ['in','request_id',[requestId]],['eq','free_saved_costings.subject_id','owner'],['eq','free_saved_costings.org_id','factory'],
  ])
 })
 it('does not mistake a failed receipt lookup for proof of absence',async()=>{
  mocks.receiptError=true
  const response=await GET(new Request(`https://example.test/api/free/costings?recalculationRequests=${requestId}`))
  expect(response.status).toBe(503)
 })
 it('does not fetch receipt history for an ordinary saved-costings listing',async()=>{
  const response=await GET(new Request('https://example.test/api/free/costings'))
  expect(response.status).toBe(200)
  expect(mocks.queries.map(query=>query.table)).toEqual(['free_saved_costings'])
 })
 it('rejects malformed request identities before querying any data',async()=>{
  const response=await GET(new Request('https://example.test/api/free/costings?recalculationRequests=not-an-id'))
  expect(response.status).toBe(400);expect(mocks.from).not.toHaveBeenCalled()
 })
})
