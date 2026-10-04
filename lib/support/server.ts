import 'server-only'
import { getVerifiedIdentity } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireFounder } from '@/lib/admin/founder'
import { founderOnlyIdentity } from '@/lib/admin/founder-email'
import { AdminError, adminErrorResponse } from '@/lib/admin/errors'
import { checkAuthRateLimit,isUserRevoked } from '@/lib/rate-limit'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { listTicketSchema,createTicketSchema,manualTicketSchema,customerReplySchema,founderReplySchema,internalNoteSchema,patchTicketSchema,validExternalReference,type TicketList,type CustomerTicketDetail,type FounderTicketDetail,type SupportSummary } from './contracts'

export function supportEnabled(){return process.env.WEAVLY_SUPPORT_ENABLED==='true' && (process.env.NODE_ENV!=='production'||process.env.WEAVLY_SUPPORT_PRODUCTION_APPROVED==='true')}
function assertSupportEnabled(){if(!supportEnabled())throw new AdminError('SUPPORT_DISABLED',503,'In-app support is not enabled. Use the published contact or recovery route.')}
export async function requireSupportOwner(){
 assertSupportEnabled()
 const identity=await getVerifiedIdentity()
 if(!identity||await isUserRevoked(identity.user.id))throw new AdminError('UNAUTHENTICATED',401,'Please sign in again.')
 if(founderOnlyIdentity(identity.user.email,identity.profile.role)||identity.profile.role!=='owner'||!identity.profile.org_id)throw new AdminError('FORBIDDEN',403,'Owner support access is required.')
 const {data,error}=await createAdminClient().from('organizations').select('id').eq('id',identity.profile.org_id).maybeSingle()
 if(error)throw new AdminError('UNAVAILABLE',503,'Support access is unavailable.')
 if(!data)throw new AdminError('FORBIDDEN',403,'Support access could not be verified.')
 return {userId:identity.user.id,orgId:identity.profile.org_id}
}
async function principal(founder:boolean){return founder?await requireFounder():{...await requireSupportOwner(),sessionId:null}}
export function supportJson(value:unknown,status=200){return NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}})}
export {adminErrorResponse as supportError}
export function assertSupportOrigin(request:Request){
 const origin=request.headers.get('origin');const fetchSite=request.headers.get('sec-fetch-site')
 if(!origin||origin!==new URL(request.url).origin||(fetchSite&&fetchSite!=='same-origin'))throw new AdminError('FORBIDDEN',403,'Please submit from this application.')
}
export async function supportBody(request:Request){
 assertSupportOrigin(request)
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AdminError('INVALID_INPUT',400,'JSON input is required.')
 const body=await request.text()
 if(body.length>25000)throw new AdminError('INVALID_INPUT',400,'The request is too large.')
 try{return JSON.parse(body) as unknown}catch{throw new AdminError('INVALID_INPUT',400,'Check the request input.')}
}
function parse<T>(schema:z.ZodType<T>,value:unknown):T{
 const parsed=schema.safeParse(value)
 if(!parsed.success)throw new AdminError('INVALID_INPUT',400,'Check the highlighted fields.',z.flattenError(parsed.error).fieldErrors as Record<string,string[]>)
 return parsed.data
}
function dbError(error:{code?:string;message?:string}):never{
 if(error.code==='40001'||error.code==='23505')throw new AdminError('CONFLICT',409,'This ticket changed or this request key was already used. Refresh before trying again.')
 if(error.code==='P0002')throw new AdminError('NOT_FOUND',404,'Ticket not found.')
 if(error.code==='42501')throw new AdminError('FORBIDDEN',403,'Support access could not be verified.')
 if(error.code==='22023'||error.code==='23514'||error.code==='22P02'||error.code==='23502')throw new AdminError('INVALID_INPUT',400,'Check the ticket state, required dates, and reference.')
 throw new AdminError('UNAVAILABLE',503,'Support is unavailable. Your message has not been confirmed sent.')
}
export async function listSupportTickets(filters:unknown={},founder=true):Promise<TicketList>{
 const who=await principal(founder);const parsed=parse(listTicketSchema,filters);let cursor:unknown
 if(parsed.cursor){try{cursor=JSON.parse(Buffer.from(parsed.cursor,'base64url').toString());parse(z.object({id:z.uuid(),updatedAt:z.iso.datetime({offset:true}),rank:z.number().int().min(0).max(7),asOf:z.iso.datetime({offset:true})}).strict(),cursor)}catch{throw new AdminError('INVALID_INPUT',400,'Invalid page cursor.')}}
 const {data,error}=await createAdminClient().rpc('admin_support_read',{p_actor_id:who.userId,p_session_id:who.sessionId,p_operation:'list',p_filters:{...parsed,cursor}})
 if(error)dbError(error)
 const result=data as TicketList;const hasMore=result.items.length>parsed.limit;result.items=result.items.slice(0,parsed.limit)
 const last=result.items.at(-1);return {...result,nextCursor:hasMore&&last?Buffer.from(JSON.stringify({id:last.id,updatedAt:last.updatedAt,rank:last.sortRank??0,asOf:result.asOf})).toString('base64url'):null}
}
export async function readSupportTicket(id:string,founder:true,filters?:unknown):Promise<FounderTicketDetail>
export async function readSupportTicket(id:string,founder:false,filters?:unknown):Promise<CustomerTicketDetail>
export async function readSupportTicket(id:string,founder:boolean,filters:unknown={}):Promise<FounderTicketDetail|CustomerTicketDetail>{
 const who=await principal(founder);parse(z.uuid(),id)
 const parsed=parse(z.object({messageBefore:z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),eventBeforeId:z.uuid().optional(),eventBeforeAt:z.iso.datetime({offset:true}).optional(),noteBeforeId:z.uuid().optional(),noteBeforeAt:z.iso.datetime({offset:true}).optional()}).strict(),filters)
 if(!!parsed.eventBeforeId!==!!parsed.eventBeforeAt||!!parsed.noteBeforeId!==!!parsed.noteBeforeAt)throw new AdminError('INVALID_INPUT',400,'Invalid history cursor.')
 if(!founder&&(parsed.noteBeforeId||parsed.noteBeforeAt))throw new AdminError('FORBIDDEN',403,'Private history is unavailable.')
 const {data,error}=await createAdminClient().rpc('admin_support_read',{p_actor_id:who.userId,p_session_id:who.sessionId,p_operation:'detail',p_ticket_id:id,p_filters:parsed})
 if(error)dbError(error);return data
}
export async function getSupportSummary():Promise<SupportSummary>{
 const who=await requireFounder();const {data,error}=await createAdminClient().rpc('admin_support_read',{p_actor_id:who.userId,p_session_id:who.sessionId,p_operation:'summary'})
 if(error)dbError(error);return data
}
export async function mutateSupport(founder:boolean,operation:'create'|'reply'|'note'|'patch',id:string|null,input:unknown){
 const who=await principal(founder);assertSupportEnabled()
 if(await checkAuthRateLimit(`support:${who.userId}`)!==null)throw new AdminError('THROTTLED',429,'Please wait before trying again.')
 if(id)parse(z.uuid(),id)
 const schema=operation==='create'?(founder?manualTicketSchema:createTicketSchema):operation==='reply'?(founder?founderReplySchema:customerReplySchema):operation==='note'?internalNoteSchema:patchTicketSchema
 const payload=parse(schema as z.ZodType<Record<string,unknown>&{clientRequestId:string}>,input)
 if(!validExternalReference(payload.externalReference as string|undefined))throw new AdminError('INVALID_INPUT',400,'Use a safe reference or HTTPS link.')
 const {clientRequestId,...validated}=payload
 const {data,error}=await createAdminClient().rpc('admin_support_mutate',{p_actor_id:who.userId,p_session_id:who.sessionId,p_operation:operation,p_ticket_id:id,p_payload:validated,p_request_id:clientRequestId})
 if(error)dbError(error);return data
}
export function supportFilters(request:Request){return Object.fromEntries(new URL(request.url).searchParams.entries())}
