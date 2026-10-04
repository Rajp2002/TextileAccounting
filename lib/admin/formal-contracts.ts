import { z } from 'zod'

export const formalKinds = ['privacy', 'security'] as const
export const privacyStatuses = ['pending', 'acknowledged', 'escalated', 'resolved'] as const
export const incidentStatuses = ['reported', 'triaging', 'contained', 'investigating', 'monitoring', 'closed'] as const
export const privacyCategories = ['access', 'correction', 'deletion', 'consent', 'security', 'grievance', 'other'] as const
export const incidentTypes = ['account_compromise', 'unauthorized_access', 'billing_security', 'suspicious_message', 'service_vulnerability', 'availability', 'other'] as const
export const identityStates = ['pending', 'verified', 'not_required', 'failed'] as const
export const severities = ['unassessed', 'low', 'medium', 'high', 'critical'] as const
export const outcomeCodes = ['response_recorded', 'request_fulfilled', 'partially_fulfilled', 'declined_with_reason', 'withdrawn', 'duplicate', 'remediated', 'no_incident_found'] as const
const instant = z.iso.datetime({ offset: true })
const safeRef = z.string().trim().min(3).max(300).refine(value => {
    if (/[<>\u0000-\u001f]/.test(value)) return false
    if (!/^[a-z]+:/i.test(value)) return true
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
}, 'Use a safe reference or HTTPS link without credentials.')
const action = z.string().trim().min(3).max(500)
const createBase = {
    clientRequestId: z.uuid(), title: z.string().trim().min(3).max(160), body: z.string().trim().min(10).max(5000),
    orgId: z.uuid().nullable().default(null), requesterUserId: z.uuid().nullable().default(null),
    contactEmail: z.email().max(254).nullable().default(null), receivedAt: instant,
    nextAction: action, followUpDueAt: instant, sourceReference: safeRef,
}
export const createFormalSchema = z.discriminatedUnion('kind', [
    z.object({ ...createBase, kind: z.literal('privacy'), category: z.enum(privacyCategories), source: z.enum(['manual_email', 'manual_phone', 'manual_whatsapp', 'other']) }).strict(),
    z.object({ ...createBase, kind: z.literal('security'), category: z.enum(incidentTypes), source: z.enum(['customer', 'provider', 'monitoring', 'internal', 'other']) }).strict(),
]).refine(value => !value.requesterUserId || !!value.orgId, { message: 'A verified requester needs a factory binding.', path: ['requesterUserId'] })
const concurrency = { clientRequestId: z.uuid(), expectedVersion: z.number().int().min(0).max(2147483646) }
export const adoptFormalSchema = z.object({ ...concurrency, nextAction: action, followUpDueAt: instant }).strict().refine(value => value.expectedVersion === 0, 'Only unmanaged records can start case handling.')
export const noteFormalSchema = z.object({ ...concurrency, body: z.string().trim().min(1).max(10000) }).strict().refine(value => value.expectedVersion > 0, 'Start case handling before adding a note.')
export const updateFormalSchema = z.object({
    ...concurrency, status: z.enum([...privacyStatuses, ...incidentStatuses]), nextAction: action, followUpDueAt: instant.nullable(),
    severity: z.enum(severities).optional(), identityState: z.enum(identityStates).optional(), identityEvidenceRef: safeRef.nullable().optional(),
    acknowledgedAt: instant.nullable().optional(), acknowledgementEvidenceRef: safeRef.nullable().optional(),
    outcomeCode: z.enum(outcomeCodes).nullable().optional(), outcomeSummary: z.string().trim().min(3).max(2000).nullable().optional(),
    outcomeEvidenceRef: safeRef.nullable().optional(), responseRecordedAt: instant.nullable().optional(),
    reason: z.string().trim().min(3).max(500),
}).strict().refine(value => value.expectedVersion > 0, 'Start case handling before making changes.')
export const formalListSchema = z.object({ kind: z.enum(formalKinds).default('privacy'), queue: z.enum(['all', 'open', 'due', 'unmanaged']).default('open'), search: z.string().trim().max(160).default(''), limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().max(700).optional() }).strict()
export const formalCursorSchema = z.object({ id: z.uuid(), sortAt: instant, asOf: instant, kind: z.enum(formalKinds), queue: z.enum(['all', 'open', 'due', 'unmanaged']), search: z.string().max(160) }).strict()
export const formalItemSchema = z.object({
    id: z.uuid(), kind: z.enum(formalKinds), orgId: z.uuid().nullable(), title: z.string(), status: z.string(), severity: z.string().nullable(),
    identityState: z.string().nullable(), recordedAt: instant.nullable(), sortAt: instant, internalTargetDate: z.string().nullable(),
    managed: z.boolean(), version: z.number().int().nonnegative(), nextAction: z.string().nullable(), followUpDueAt: instant.nullable(),
}).strict()
const revisionValues = z.object({ status: z.string(), severity: z.string().nullable(), identityState: z.string().nullable(), identityEvidenceRef: z.string().nullable(),
    acknowledgedAt: instant.nullable(), acknowledgementEvidenceRef: z.string().nullable(), outcomeCode: z.string().nullable(), outcomeSummary: z.string().nullable(),
    outcomeEvidenceRef: z.string().nullable(), responseRecordedAt: instant.nullable(), closedAt: instant.nullable(), nextAction: z.string(), followUpDueAt: instant.nullable(), retainedProofHash: z.string().nullable(), identityVerifiedAt: instant.nullable(),
}).strict()
export const formalDetailSchema = z.object({
    record: formalItemSchema.extend({ body: z.string().nullable(), contactEmail: z.string().nullable(), category: z.string(), source: z.string().nullable(),
        receivedAt: instant.nullable(), requesterBound: z.boolean(), acknowledgedAt: instant.nullable(), acknowledgementEvidenceRef: z.string().nullable(),
        identityEvidenceRef: z.string().nullable(), outcomeCode: z.string().nullable(), outcomeSummary: z.string().nullable(), outcomeEvidenceRef: z.string().nullable(),
        responseRecordedAt: instant.nullable(), closedAt: instant.nullable(), sourceReference: z.string().nullable(),
        existingAssessment: z.string().nullable(), existingAssessmentDueAt: instant.nullable(),
    }).strict(),
    notes: z.array(z.object({ id: z.uuid(), body: z.string(), createdAt: instant }).strict()),
    events: z.array(z.object({ id: z.uuid(), eventType: z.string(), before: z.record(z.string(), z.unknown()), after: z.record(z.string(), z.unknown()), createdAt: instant }).strict()),
    revisions: z.array(z.object({ id: z.uuid(), version: z.number().int().positive(), before: z.union([revisionValues, z.object({}).strict()]), after: revisionValues, createdAt: instant }).strict()).max(100),
    nextHistoryCursor: z.object({ id: z.uuid(), createdAt: instant }).strict().nullable(), asOf: instant,
}).strict().refine(value => value.notes.length + value.events.length + value.revisions.length <= 100, 'History must be bounded.')
export const formalMutationResultSchema = z.object({ id: z.uuid(), kind: z.enum(formalKinds), version: z.number().int().positive(), requestId: z.uuid() }).strict()
export type FormalKind = typeof formalKinds[number]
export type FormalItem = z.infer<typeof formalItemSchema>
export type FormalDetail = z.infer<typeof formalDetailSchema>
export type FormalMutationResult = z.infer<typeof formalMutationResultSchema>
export type FormalList = { items: FormalItem[]; nextCursor: string | null; asOf: string }
