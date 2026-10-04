import 'server-only'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminRecordAudit, requireFounder } from './founder'
import { ApiError } from './errors'
import { retentionCursorSchema, retentionQuerySchema, retentionReadSchema, type RetentionReview } from './retention-contracts'
import { formalOperationsEnabled } from './formal'

/** Read-only retained-record policy review. Installing a policy/hold is a separate reviewed operator setup. */
export async function getRetentionReview(query: unknown = {}): Promise<RetentionReview> {
    const principal = await requireFounder(), requestId = randomUUID()
    if (!formalOperationsEnabled()) {
        await adminRecordAudit(principal, 'retention.review.read', 'retention', 'policy_review', requestId, { outcome: 'denied', reasonCode: 'formal_disabled' })
        throw new ApiError('FORMAL_DISABLED', 403, 'Formal case handling is not enabled.', undefined, requestId)
    }
    let input, cursor = null
    try {
        input = retentionQuerySchema.parse(query)
        if (input.cursor) cursor = retentionCursorSchema.parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')))
    } catch { throw new ApiError('INVALID_QUERY', 400, 'Choose a valid retention review page.', undefined, requestId) }
    let result
    try {
        result = await createAdminClient().rpc('admin_retention_review', {
            p_actor_id: principal.userId, p_session_id: principal.sessionId, p_limit: input.limit,
            p_cursor_at: cursor?.at ?? null, p_cursor_id: cursor?.id ?? null, p_as_of: cursor?.asOf ?? null,
        })
    } catch { throw new ApiError('SOURCE_UNAVAILABLE', 503, 'Retention review is unavailable.', undefined, requestId) }
    const parsed = retentionReadSchema.safeParse(result.data)
    if (result.error || !parsed.success) throw new ApiError('SOURCE_UNAVAILABLE', 503, 'Retention review is unavailable.', undefined, requestId)
    const value = parsed.data, items = value.holds.items.slice(0, input.limit), last = items.at(-1)
    await adminRecordAudit(principal, 'retention.review.read', 'retention', 'policy_review', requestId, { after: { count: items.length } })
    return {
        ...value,
        holds: { ...value.holds, items, nextCursor: value.holds.items.length > input.limit && last
            ? Buffer.from(JSON.stringify({ at: last.placedAt, id: last.id, asOf: value.asOf })).toString('base64url') : null },
        requestId,
    }
}
