import 'server-only'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminRecordAudit, requireFounder } from './founder'
import { ApiError } from './errors'

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().max(240).optional() }).strict()
const cursorSchema = z.object({ at: z.string().datetime({ offset: true }), id: z.string().uuid() }).strict()
export type AuditEvent = { id: string; occurred_at: string; actor_id: string | null; session_hash: string | null; action: string; target_type: string; target_id: string; outcome: string; reason_code: string | null; before_safe: Record<string, string | number | boolean | null> | null; after_safe: Record<string, string | number | boolean | null> | null; request_id: string }

export async function getAdminAudit(query: unknown = {}) {
    const principal = await requireFounder(), requestId = randomUUID()
    let input, cursor = null
    try {
        input = querySchema.parse(query)
        if (input.cursor) cursor = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')))
    } catch { throw new ApiError('INVALID_QUERY', 400, 'Choose a valid audit page.', undefined, requestId) }
    const { data, error } = await createAdminClient().rpc('admin_audit_list', {
        p_actor_id: principal.userId, p_session_id: principal.sessionId, p_limit: input.limit, p_cursor_at: cursor?.at ?? null, p_cursor_id: cursor?.id ?? null,
    })
    if (error || !Array.isArray(data)) throw new ApiError('SOURCE_UNAVAILABLE', 503, 'Audit history is unavailable.', undefined, requestId)
    const rows = data as AuditEvent[], items = rows.slice(0, input.limit), last = items.at(-1)
    await adminRecordAudit(principal, 'audit.read', 'audit', 'history', requestId, { after: { count: items.length } })
    return { items, nextCursor: rows.length > input.limit && last ? Buffer.from(JSON.stringify({ at: last.occurred_at, id: last.id })).toString('base64url') : null, asOf: new Date().toISOString(), requestId }
}
