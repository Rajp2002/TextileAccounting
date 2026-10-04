import 'server-only'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkAuthRateLimit } from '@/lib/rate-limit'
import { requireFounder, adminRecordAudit, type FounderPrincipal } from './founder'
import { AdminError } from './errors'
import { adoptFormalSchema, createFormalSchema, formalCursorSchema, formalDetailSchema, formalItemSchema, formalKinds, formalListSchema, formalMutationResultSchema, noteFormalSchema, updateFormalSchema, type FormalDetail, type FormalKind, type FormalList } from './formal-contracts'

export function formalOperationsEnabled() {
    return process.env.WEAVLY_ADMIN_FORMAL_ENABLED === 'true'
        && (process.env.NODE_ENV !== 'production' || process.env.WEAVLY_ADMIN_FORMAL_PRODUCTION_APPROVED === 'true')
}
async function authorized() {
    const who = await requireFounder()
    if (!formalOperationsEnabled()) {
        await adminRecordAudit(who, 'formal.access', 'formal_register', 'disabled', undefined, { outcome: 'denied', reasonCode: 'formal_disabled' })
        throw new AdminError('FORMAL_DISABLED', 403, 'Formal case handling is not enabled.')
    }
    return who
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const result = schema.safeParse(value)
    if (!result.success) throw new AdminError('INVALID_INPUT', 400, 'Check the fields and required evidence.', z.flattenError(result.error).fieldErrors as Record<string, string[]>)
    return result.data
}
function sourceDto<T>(schema: z.ZodType<T>, value: unknown): T {
    const result = schema.safeParse(value)
    if (!result.success) throw new AdminError('UNAVAILABLE', 503, 'This source response could not be verified. Keep the draft and retry with the same request key.')
    return result.data
}
function sourceError(error: { code?: string }): never {
    if (error.code === '40001' || error.code === '23505') throw new AdminError('CONFLICT', 409, 'This case changed, or the request key was reused. Refresh before trying again.')
    if (error.code === 'P0002') throw new AdminError('NOT_FOUND', 404, 'Case not found.')
    if (error.code === '42501') throw new AdminError('FORBIDDEN', 403, 'Founder access could not be verified.')
    if (['22023', '22P02', '23514', '23502'].includes(error.code ?? '')) throw new AdminError('INVALID_INPUT', 400, 'Check the case state, dates and required evidence.')
    throw new AdminError('UNAVAILABLE', 503, 'The change or source could not be confirmed. Keep your draft and retry with the same request key.')
}
async function auditedFailure<T>(who: FounderPrincipal, action: string, target: string, requestId: `${string}-${string}-${string}-${string}-${string}`, operation: () => Promise<T>): Promise<T> {
    try { return await operation() } catch (error) {
        const reason = error instanceof AdminError ? error.code.toLowerCase() : 'source_unavailable'
        await adminRecordAudit(who, action, 'formal_case', target, requestId, { outcome: 'failure', reasonCode: reason })
        throw error instanceof AdminError ? error : new AdminError('UNAVAILABLE', 503, 'This source is unavailable.', undefined, requestId)
    }
}
export async function listFormalCases(filters: unknown = {}): Promise<FormalList> {
    const who = await authorized(), requestId = randomUUID()
    return auditedFailure(who, 'formal.list.read', 'bounded_list', requestId, async () => {
        const input = parse(formalListSchema, filters)
        const query: Record<string, unknown> = { queue: input.queue, search: input.search, limit: input.limit }
        if (input.cursor) {
            let raw: unknown
            try { raw = JSON.parse(Buffer.from(input.cursor, 'base64url').toString()) } catch { throw new AdminError('INVALID_INPUT', 400, 'Invalid page cursor.') }
            const cursor = parse(formalCursorSchema, raw)
            if (cursor.kind !== input.kind || cursor.queue !== input.queue || cursor.search !== input.search) throw new AdminError('INVALID_INPUT', 400, 'The page cursor belongs to different filters.')
            Object.assign(query, { cursorAt: cursor.sortAt, cursorId: cursor.id, asOf: cursor.asOf })
        }
        const { data, error } = await createAdminClient().rpc('admin_formal_read', { p_actor_id: who.userId, p_session_id: who.sessionId, p_kind: input.kind, p_filters: query, p_request_id: requestId })
        if (error) sourceError(error)
        const result = sourceDto(z.object({ items: z.array(formalItemSchema).max(101), asOf: z.iso.datetime({ offset: true }) }).strict(), data)
        const items = result.items.slice(0, input.limit), last = items.at(-1)
        const nextCursor = result.items.length > input.limit && last ? Buffer.from(JSON.stringify({ id: last.id, sortAt: last.sortAt, asOf: result.asOf, kind: input.kind, queue: input.queue, search: input.search })).toString('base64url') : null
        return { items, nextCursor, asOf: result.asOf }
    })
}
export async function getFormalCase(kind: unknown, id: unknown, filters: unknown = {}): Promise<FormalDetail> {
    const who = await authorized(), requestId = randomUUID()
    return auditedFailure(who, 'formal.detail.read', 'bounded_detail', requestId, async () => {
        const safeKind = parse(z.enum(formalKinds), kind), safeId = parse(z.uuid(), id)
        const input = parse(z.object({ historyAt: z.iso.datetime({ offset: true }).optional(), historyId: z.uuid().optional() }).strict(), filters)
        if (!!input.historyAt !== !!input.historyId) throw new AdminError('INVALID_INPUT', 400, 'Invalid history cursor.')
        const { data, error } = await createAdminClient().rpc('admin_formal_read', { p_actor_id: who.userId, p_session_id: who.sessionId, p_kind: safeKind, p_id: safeId, p_filters: input, p_request_id: requestId })
        if (error) sourceError(error)
        return sourceDto(formalDetailSchema, data)
    })
}
export async function mutateFormalCase(operation: 'create' | 'adopt' | 'update' | 'note', kind: unknown, id: unknown, input: unknown) {
    const who = await authorized(), failureId = randomUUID()
    return auditedFailure(who, `formal.${operation}`, 'validated_mutation', failureId, async () => {
        if (await checkAuthRateLimit(`formal:${who.userId}`) !== null) throw new AdminError('THROTTLED', 429, 'Please wait before trying again.')
        const schema = operation === 'create' ? createFormalSchema : operation === 'adopt' ? adoptFormalSchema : operation === 'note' ? noteFormalSchema : updateFormalSchema
        const validated = parse(schema as z.ZodType<Record<string, unknown> & { clientRequestId: string }>, input)
        const safeKind = parse(z.enum(formalKinds), operation === 'create' ? validated.kind : kind)
        const safeId = operation === 'create' ? null : parse(z.uuid(), id)
        const { clientRequestId, kind: _kind, ...payload } = validated
        void _kind
        if (operation === 'update') {
            const states = safeKind === 'privacy' ? ['pending', 'acknowledged', 'escalated', 'resolved'] : ['reported', 'triaging', 'contained', 'investigating', 'monitoring', 'closed']
            if (!states.includes(payload.status as string)) throw new AdminError('INVALID_INPUT', 400, 'Choose a state for this case type.')
        }
        const { data, error } = await createAdminClient().rpc('admin_formal_mutate', { p_actor_id: who.userId, p_session_id: who.sessionId, p_kind: safeKind, p_id: safeId, p_operation: operation, p_payload: payload, p_request_id: clientRequestId })
        if (error) sourceError(error)
        return sourceDto(formalMutationResultSchema, data)
    })
}
export type { FormalKind }
