import { z } from 'zod'
export const statuses = ['new','in_progress','waiting_on_customer','waiting_on_fix','resolved'] as const
export const categories = ['onboarding','costing','production','inventory','payroll','billing_access','bug','other'] as const
export const priorities = ['critical','high','normal','low'] as const
export const resolutionCodes = ['explained_behavior','setup_corrected','bug_fixed','billing_access_corrected','duplicate','cannot_reproduce','feature_request_recorded'] as const
export const sources = ['in_app','manual_email','manual_phone','manual_whatsapp'] as const
export const queues = ['all','new','needs_reply','answered','unanswered','updates_due','followups_due','waiting_on_customer','waiting_on_fix','billing_access','reopened','critical'] as const
const body = z.string().trim().min(1).max(10000)
const nextAction = z.string().trim().min(1).max(500)
const instant = z.iso.datetime({offset:true}).nullable().optional()
export const createTicketSchema = z.object({subject:z.string().trim().min(3).max(160),category:z.enum(categories),body,clientRequestId:z.uuid()}).strict()
export const manualTicketSchema = createTicketSchema.extend({orgId:z.uuid(),requesterUserId:z.uuid().nullable().optional(),source:z.enum(['manual_email','manual_phone','manual_whatsapp'])}).strict()
export const customerReplySchema = z.object({body,clientRequestId:z.uuid()}).strict()
const stateFields = {status:z.enum(statuses),nextAction,followUpDueAt:instant,nextUpdateDueAt:instant,externalReference:z.string().trim().max(500).nullable().optional(),resolutionCode:z.enum(resolutionCodes).nullable().optional(),resolutionSummary:z.string().trim().min(1).max(10000).nullable().optional()}
export const founderReplySchema = z.object({body,expectedVersion:z.number().int().positive(),clientRequestId:z.uuid(),...stateFields,promiseFulfilled:z.boolean().default(false)}).strict()
export const internalNoteSchema = z.object({body,expectedVersion:z.number().int().positive(),clientRequestId:z.uuid()}).strict()
export const patchTicketSchema = z.object({expectedVersion:z.number().int().positive(),clientRequestId:z.uuid(),...stateFields,category:z.enum(categories),priority:z.enum(priorities),reason:z.string().trim().max(500).optional()}).strict()
export const listTicketSchema = z.object({queue:z.enum(queues).default('all'),status:z.enum(statuses).optional(),orgId:z.uuid().optional(),limit:z.coerce.number().int().min(1).max(100).default(25),cursor:z.string().max(500).optional()}).strict()
export type Ticket = {id:string;orgId:string;subject:string;category:typeof categories[number];priority:typeof priorities[number];status:typeof statuses[number];source:typeof sources[number];requesterBound:boolean;createdAt:string;updatedAt:string;version:number;nextAction:string;followUpDueAt:string|null;nextUpdateDueAt:string|null;needsFounderReply:boolean;resolvedAt:string|null;resolutionCode:string|null;resolutionSummary:string|null;externalReference?:string|null;firstPublicFounderReplyAt:string|null;reopenedCount:number;sortRank?:number;factoryName?:string|null;planLabel?:string|null}
export type PublicMessage = {id:string;authorKind:'customer'|'founder';messageKind:'initial_intake'|'public_reply';body:string;createdAt:string;messageSeq:number}
export type PublicEvent = {id:string;eventType:string;createdAt:string;before:Record<string,unknown>;after:Record<string,unknown>}
export type CustomerTicketDetail = {ticket:Ticket;messages:PublicMessage[];events:PublicEvent[];asOf:string;nextMessageBefore:number|null;nextEventBefore:{id:string;createdAt:string}|null}
export type FounderTicketDetail = CustomerTicketDetail & {internalNotes:Array<{id:string;body:string;createdAt:string}>;nextNoteBefore:{id:string;createdAt:string}|null}
export type TicketList = {items:Ticket[];nextCursor:string|null;totalMatching:number;asOf:string}
export type SupportSummary = {asOf:string;unanswered:number;needsReply:number;overduePromises:number;overdueFollowUps:number;reopened:number;waitingOnFix:number;critical:number;attention:Array<{id:string;ticketId:string;orgId:string;subject:string;status:string;priority:string;observedAt:string;nextUpdateDueAt:string|null;followUpDueAt:string|null;sortRank:number;nextAction:string;reason:string}>}
export function validExternalReference(value:string|null|undefined) {
 if (!value) return true
 if (/^[a-z]+:/i.test(value)) { try { const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password } catch{return false} }
 return !/[<>\u0000-\u001f]/.test(value)
}
export function validateTicketState(input:{status:string;nextAction:string;followUpDueAt?:string|null;nextUpdateDueAt?:string|null;externalReference?:string|null;resolutionCode?:string|null;resolutionSummary?:string|null},bound:boolean,publicReply:boolean) {
 if(!validExternalReference(input.externalReference)) return 'Use a safe reference or HTTPS link.'
 if(input.status==='waiting_on_customer' && (!bound || !publicReply || !input.followUpDueAt)) return 'A public question and internal follow-up date are required.'
 if(input.status==='waiting_on_fix' && (!input.nextUpdateDueAt || !input.externalReference)) return 'A fix reference and customer update due date are required.'
 if(input.status==='resolved' && (!input.resolutionCode || !input.resolutionSummary || (bound && !publicReply))) return bound?'Send a public resolution summary with an outcome code.':'Record a private outcome with an outcome code.'
 return null
}
