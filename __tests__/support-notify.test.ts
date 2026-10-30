import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({set:vi.fn(),redis:vi.fn(),plan:vi.fn(),capture:vi.fn(),ticket:vi.fn(),message:vi.fn(),org:vi.fn()}))
vi.mock('@/lib/rate-limit',()=>({getRedis:mocks.redis}))
vi.mock('@/lib/subscription',()=>({getOrgPlanAccess:mocks.plan}))
vi.mock('@sentry/nextjs',()=>({captureException:mocks.capture}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({from:(table:string)=>{
 const terminal=table==='support_tickets'?mocks.ticket:table==='support_messages'?mocks.message:mocks.org
 const chain:Record<string,unknown>={};for(const name of ['select','eq','order','limit'])chain[name]=()=>chain
 chain.maybeSingle=terminal;chain.single=terminal;return chain
}})}))
import {notifyFounderOfCustomerMessage,buildFounderEmail} from '@/lib/support/notify'
const ticketId='44444444-4444-4444-8444-444444444444',requestId='55555555-5555-4555-8555-555555555555',org='22222222-2222-4222-8222-222222222222'
const fetchMock=vi.fn()
function sent(){return JSON.parse(fetchMock.mock.calls[0][1].body as string)}
beforeEach(()=>{
 vi.clearAllMocks();vi.stubGlobal('fetch',fetchMock);vi.stubEnv('RESEND_API_KEY','test-key');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://textile-accounting.vercel.app')
 vi.spyOn(console,'error').mockImplementation(()=>{})
 fetchMock.mockResolvedValue({ok:true,status:200})
 mocks.set.mockResolvedValue('OK');mocks.redis.mockReturnValue({set:mocks.set})
 mocks.plan.mockResolvedValue({effectiveTier:'lite'})
 mocks.ticket.mockResolvedValue({data:{subject:'Rate book not saving',category:'costing',org_id:org},error:null})
 mocks.message.mockResolvedValue({data:{body:'The rate book shows an error.\nPlease help.'},error:null})
 mocks.org.mockResolvedValue({data:{name:'Patel Textiles'},error:null})
})
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})
describe('founder support email',()=>{
 it('sends a new-ticket email to the founder',async()=>{
  await notifyFounderOfCustomerMessage({kind:'created',ticketId,requestId})
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url,init]=fetchMock.mock.calls[0];expect(url).toBe('https://api.resend.com/emails');expect(init.method).toBe('POST');expect(init.headers.Authorization).toBe('Bearer test-key')
  const body=sent();expect(body.to).toEqual(['rajpatel86420@gmail.com']);expect(body.from).toBe('Weavly Support <onboarding@resend.dev>');expect(body.subject).toBe('New ticket · Patel Textiles (Lite): Rate book not saving')
  expect(body.html).toContain(`https://textile-accounting.vercel.app/admin/support/${ticketId}`);expect(body.html).toContain('The rate book shows an error.<br>Please help.');expect(body.text).toContain(`https://textile-accounting.vercel.app/admin/support/${ticketId}`)
  expect(mocks.capture).not.toHaveBeenCalled()
 })
 it('uses the customer-replied subject',async()=>{
  await notifyFounderOfCustomerMessage({kind:'customer_reply',ticketId,requestId})
  expect(sent().subject).toBe('Customer replied · Patel Textiles: Rate book not saving')
 })
 it('sends once for a repeated request id',async()=>{
  mocks.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null)
  await notifyFounderOfCustomerMessage({kind:'created',ticketId,requestId});await notifyFounderOfCustomerMessage({kind:'created',ticketId,requestId})
  expect(fetchMock).toHaveBeenCalledTimes(1);expect(mocks.set).toHaveBeenCalledWith(`support-email:${requestId}`,'1',{nx:true,ex:86400})
 })
 it('sends when redis is unavailable',async()=>{
  mocks.redis.mockReturnValue(null);await notifyFounderOfCustomerMessage({kind:'created',ticketId,requestId});expect(fetchMock).toHaveBeenCalledTimes(1)
  mocks.redis.mockReturnValue({set:vi.fn().mockRejectedValue(new Error('redis down'))});await notifyFounderOfCustomerMessage({kind:'created',ticketId,requestId});expect(fetchMock).toHaveBeenCalledTimes(2)
 })
 it('escapes html and truncates long messages',()=>{
  const message='<script>x</script>'+'a'.repeat(5000)
  const email=buildFounderEmail({kind:'created',ticketId,subject:'S'.repeat(200),category:'bug',factory:'A & B "Mills"',plan:'Lite',message,siteUrl:'https://textile-accounting.vercel.app'})
  expect(email.html).toContain('&lt;script&gt;');expect(email.html).not.toContain('<script>');expect(email.html).toContain('A &amp; B &quot;Mills&quot;')
  expect(email.text).toContain(message.slice(0,4000)+'…');expect(email.text).not.toContain(message.slice(0,4001))
  expect(email.subject.length).toBe(150)
 })
 it('does not throw when the key is missing',async()=>{
  vi.stubEnv('RESEND_API_KEY','')
  await expect(notifyFounderOfCustomerMessage({kind:'created',ticketId,requestId})).resolves.toBeUndefined()
  expect(fetchMock).not.toHaveBeenCalled();expect(mocks.capture).toHaveBeenCalledTimes(1)
 })
 it('reports a non-2xx response to Sentry',async()=>{
  fetchMock.mockResolvedValue({ok:false,status:500})
  await expect(notifyFounderOfCustomerMessage({kind:'created',ticketId,requestId})).resolves.toBeUndefined()
  expect(mocks.capture).toHaveBeenCalledWith(expect.any(Error),{tags:{support_email:true}})
 })
 it('reports a failed ticket read without throwing',async()=>{
  mocks.ticket.mockResolvedValue({data:null,error:{code:'XX000'}})
  await expect(notifyFounderOfCustomerMessage({kind:'created',ticketId,requestId})).resolves.toBeUndefined()
  expect(fetchMock).not.toHaveBeenCalled();expect(mocks.capture).toHaveBeenCalledTimes(1)
 })
})
