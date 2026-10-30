import React from 'react'
import {readFileSync} from 'node:fs'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe,it,expect,vi,afterEach} from 'vitest'
import {founderReplySchema,patchTicketSchema,validateTicketState,type FounderTicketDetail,type Ticket} from '@/lib/support/contracts'
import {founderReplyPayload,founderPrivateResolvePayload,founderTabQuery,founderTabFromQuery} from '@/lib/support/founder-reply'
import {SupportThread,FounderInboxTabs,FounderTicketRow,SupportListError,fetchSupportJson} from '@/components/support/support-workspace'

const id='33333333-3333-4333-8333-333333333333',org='22222222-2222-4222-8222-222222222222',key='44444444-4444-4444-8444-444444444444'
const ticket:Ticket={id,orgId:org,subject:'Rate book not saving',category:'costing',priority:'normal',status:'in_progress',source:'in_app',requesterBound:true,createdAt:'2026-10-01T10:00:00Z',updatedAt:'2026-10-04T10:00:00Z',version:4,nextAction:'Founder to investigate',followUpDueAt:null,nextUpdateDueAt:null,needsFounderReply:true,resolvedAt:null,resolutionCode:null,resolutionSummary:null,externalReference:null,firstPublicFounderReplyAt:null,reopenedCount:0,factoryName:'Patel Textiles',planLabel:'Lite'}
const detail:FounderTicketDetail={ticket,messages:[{id:'m1',authorKind:'customer',messageKind:'initial_intake',body:'The rate book shows an error.',createdAt:'2026-10-01T10:00:00Z',messageSeq:1}],events:[],asOf:'2026-10-04T10:00:00Z',nextMessageBefore:null,nextEventBefore:null,internalNotes:[{id:'n1',body:'Checked the logs.',createdAt:'2026-10-02T10:00:00Z'}],nextNoteBefore:null}
afterEach(()=>{vi.unstubAllGlobals()})

describe('founder reply payload',()=>{
 it('Send keeps the ticket open and waits for the customer',()=>{
  const payload=founderReplyPayload({body:'We are on it.',resolve:false,ticket:{version:4,nextUpdateDueAt:null},clientRequestId:key})
  expect(payload).toEqual({body:'We are on it.',expectedVersion:4,clientRequestId:key,status:'in_progress',nextAction:'Wait for the customer',nextUpdateDueAt:null,followUpDueAt:null,externalReference:null,promiseFulfilled:false})
  expect(founderReplySchema.parse(payload)).toBeTruthy()
 })
 it('Send and resolve records the reply as the resolution summary',()=>{
  const payload=founderReplyPayload({body:'Fixed: save again.',resolve:true,ticket:{version:4,nextUpdateDueAt:null},clientRequestId:key})
  expect(payload).toMatchObject({status:'resolved',nextAction:'Resolved',resolutionCode:'explained_behavior',resolutionSummary:'Fixed: save again.',promiseFulfilled:false})
  const parsed=founderReplySchema.parse(payload);expect(validateTicketState(parsed,true,true)).toBeNull()
 })
 it('marks the old promise fulfilled when the ticket has one',()=>{
  for(const resolve of [false,true])expect(founderReplyPayload({body:'Update',resolve,ticket:{version:2,nextUpdateDueAt:'2026-10-05T10:00:00Z'},clientRequestId:key}).promiseFulfilled).toBe(true)
 })
})

describe('internal-only tickets',()=>{
 it('resolve privately records an outcome without a public reply',()=>{
  const payload=founderPrivateResolvePayload({summary:'Explained on the phone.',ticket:{version:3,category:'costing',priority:'normal'},clientRequestId:key})
  expect(payload).toMatchObject({expectedVersion:3,status:'resolved',nextAction:'Resolved',resolutionCode:'explained_behavior',resolutionSummary:'Explained on the phone.',category:'costing',priority:'normal',nextUpdateDueAt:null,followUpDueAt:null,externalReference:null})
  const parsed=patchTicketSchema.parse(payload);expect(validateTicketState(parsed,false,false)).toBeNull()
 })
 it('the thread offers resolve privately for an open internal-only ticket and no reply box',()=>{
  const html=renderToStaticMarkup(<SupportThread founder id={id} initialDetail={{...detail,messages:[],ticket:{...ticket,requesterBound:false}}}/>)
  expect(html).toContain('Resolve privately (not delivered)');expect(html).toMatch(/<details open=""/);expect(html).not.toContain('Send and resolve')
  const resolved=renderToStaticMarkup(<SupportThread founder id={id} initialDetail={{...detail,messages:[],ticket:{...ticket,requesterBound:false,status:'resolved'}}}/>)
  expect(resolved).not.toContain('Resolve privately')
 })
 it('customer-bound tickets do not offer resolve privately',()=>{expect(renderToStaticMarkup(<SupportThread founder id={id} initialDetail={detail}/>)).not.toContain('Resolve privately')})
})

describe('founder thread screen',()=>{
 const html=renderToStaticMarkup(<SupportThread founder id={id} initialDetail={detail}/>)
 it('is the conversation, one reply box with two buttons, and collapsed notes',()=>{
  expect(html).toContain('The rate book shows an error.')
  expect(html).toMatch(/<button[^>]*>Send<\/button>/);expect(html).toMatch(/<button[^>]*>Send and resolve<\/button>/)
  expect(html).toMatch(/<details[^>]*><summary[^>]*>Private founder notes<\/summary>/);expect(html).toContain('Checked the logs.')
  expect(html).toContain('Patel Textiles');expect(html).toContain('Lite')
 })
 it('has no ticket-state panel or promise checkbox',()=>{
  for(const removed of ['Save ticket state','Founder’s next action','Promised customer update','fulfills the outstanding update promise','type="checkbox"'])expect(html).not.toContain(removed)
  const source=readFileSync('components/support/support-workspace.tsx','utf8')
  for(const removed of ['Save ticket state','Founder’s next action','Promised customer update','fulfills the outstanding update promise'])expect(source).not.toContain(removed)
 })
 it('the customer thread keeps its own reply button and shows no founder controls',()=>{
  const customer=renderToStaticMarkup(<SupportThread founder={false} id={id} initialDetail={{...detail,ticket:{...ticket,factoryName:undefined,planLabel:undefined}}}/>)
  expect(customer).toContain('Send reply');expect(customer).not.toContain('Send and resolve');expect(customer).not.toContain('Private founder notes')
 })
})

describe('founder inbox',()=>{
 it('shows exactly the tabs Needs reply, Answered, Resolved',()=>{
  const html=renderToStaticMarkup(<FounderInboxTabs value="needs_reply" onChange={()=>{}}/>)
  expect([...html.matchAll(/role="tab"[^>]*>([^<]+)</g)].map(match=>match[1])).toEqual(['Needs reply','Answered','Resolved'])
  expect(html).toMatch(/aria-selected="true"[^>]*>Needs reply</)
 })
 it('maps tabs to queries and keeps the needs_reply deep link',()=>{
  expect(founderTabQuery('needs_reply')).toEqual({queue:'needs_reply'});expect(founderTabQuery('answered')).toEqual({queue:'answered'});expect(founderTabQuery('resolved')).toEqual({queue:'all',status:'resolved'})
  expect(founderTabFromQuery('needs_reply')).toBe('needs_reply');expect(founderTabFromQuery('answered')).toBe('answered');expect(founderTabFromQuery('updates_due')).toBe('needs_reply');expect(founderTabFromQuery(null)).toBe('needs_reply')
 })
 it('rows show subject, factory and plan, category and updated time',()=>{
  const html=renderToStaticMarkup(<FounderTicketRow ticket={ticket}/>)
  expect(html).toContain('Rate book not saving');expect(html).toContain('Patel Textiles · Lite');expect(html).toContain('Costing');expect(html).toContain('Updated');expect(html).toContain(`/admin/support/${id}`)
  expect(html).not.toContain('Founder to investigate')
 })
 it('shows the list error for an unavailable queue',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:400,json:async()=>({code:'INVALID_INPUT',message:'Check the ticket state, required dates, and reference.'})}))
  const error=await fetchSupportJson('/api/admin/support?queue=answered').catch((e:Error)=>e)
  expect(error).toBeInstanceOf(Error);expect((error as Error).message).toBe('Check the ticket state, required dates, and reference.')
  const html=renderToStaticMarkup(<SupportListError message={(error as Error).message} onRetry={()=>{}}/>)
  expect(html).toContain('role="alert"');expect(html).toContain('Check the ticket state, required dates, and reference.')
 })
})
