/**
 * Internal request header Proxy sets after verifying the access token: the
 * token's user id and org id, so server code can start the profile, plan and
 * organization reads while Auth re-verifies the session. Proxy deletes any
 * browser-supplied value first. It confers nothing: every read started from
 * it is used only when the verified identity names the same ids.
 */
export const SESSION_HINT_HEADER = 'x-weavly-session-hint'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function formatSessionHintHeader(userId: string, orgId: unknown): string | null {
    if (!UUID.test(userId)) return null
    return typeof orgId === 'string' && UUID.test(orgId) ? `${userId}:${orgId}` : userId
}

export function parseSessionHintHeader(value: string | null | undefined): { userId: string; orgId: string | null } | null {
    if (!value) return null
    const [userId, orgId, extra] = value.split(':')
    if (extra !== undefined || !userId || !UUID.test(userId)) return null
    if (orgId !== undefined && !UUID.test(orgId)) return null
    return { userId, orgId: orgId ?? null }
}
