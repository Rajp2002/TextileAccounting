import 'server-only'
import { randomUUID } from 'node:crypto'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getVerifiedIdentity } from '@/lib/auth'
import { isUserRevoked } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminError } from './errors'
import { safeFounderReturnPath } from './routes'
import { founderEmailAllowed } from './founder-email'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const FOUNDER_CAPABILITIES = Object.freeze(['factories:read', 'support:read', 'support:write', 'payments:read', 'system:read', 'audit:read'] as const)
export type FounderPrincipal = { userId: string; sessionId: string; capabilities: typeof FOUNDER_CAPABILITIES }
export type FounderCandidate = { userId: string; sessionId: string; aal: 'aal1' | 'aal2' }

export function founderConsoleEnabled() {
    return process.env.WEAVLY_ADMIN_ENABLED === 'true'
        && (process.env.NODE_ENV !== 'production' || process.env.WEAVLY_ADMIN_PRODUCTION_APPROVED === 'true')
}

export function founderMfaEnrollmentEnabled() {
    return founderConsoleEnabled() && process.env.WEAVLY_ADMIN_MFA_ENROLLMENT_ENABLED === 'true'
        && (process.env.NODE_ENV !== 'production' || process.env.WEAVLY_ADMIN_MFA_SETUP_APPROVED === 'true')
}

function assertEnabled() {
    if (!founderConsoleEnabled()) throw new AdminError('ADMIN_DISABLED', 503, 'Founder console is not enabled.')
}

/** These claims come exclusively from Auth.getClaims, which verifies the token.
 * parseJWT/getSession/request-supplied assurance or metadata are never accepted. */
export function validateFounderClaims(claims: Record<string, unknown>, userId: string, projectUrl: string, now = Date.now()): FounderCandidate {
    let issuer: string
    try { issuer = `${new URL(projectUrl).href.replace(/\/$/, '')}/auth/v1` }
    catch { throw new AdminError('UNAVAILABLE', 503, 'Identity verification is unavailable.') }
    const audience = claims.aud
    const correctAudience = audience === 'authenticated' || (Array.isArray(audience) && audience.includes('authenticated'))
    if (claims.iss !== issuer || claims.sub !== userId || !UUID.test(userId)
        || typeof claims.session_id !== 'string' || !UUID.test(claims.session_id)
        || !correctAudience || claims.role !== 'authenticated'
        || typeof claims.exp !== 'number' || claims.exp * 1000 <= now
        || typeof claims.iat !== 'number' || claims.iat * 1000 > now + 60_000
        || (claims.aal !== 'aal1' && claims.aal !== 'aal2')) {
        throw new AdminError('UNAUTHENTICATED', 401, 'Please sign in again.')
    }
    return { userId, sessionId: claims.session_id, aal: claims.aal }
}

async function verifiedCandidate(): Promise<FounderCandidate> {
    const identity = await getVerifiedIdentity()
    if (!identity || await isUserRevoked(identity.user.id)) throw new AdminError('UNAUTHENTICATED', 401, 'Please sign in again.')
    if (identity.profile.role !== 'admin') throw new AdminError('FORBIDDEN', 403, 'Founder access is required.')
    if (!identity.user.email_confirmed_at || !founderEmailAllowed(identity.user.email)) {
        throw new AdminError('FORBIDDEN', 403, 'Founder access is required.')
    }
    // Do not cache claims: MFA may replace an AAL1 token within this action.
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims) throw new AdminError('UNAUTHENTICATED', 401, 'Please sign in again.')
    return validateFounderClaims(data.claims, identity.user.id, process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
}

async function sessionOperation(candidate: FounderCandidate, operation: 'candidate' | 'establish' | 'check' | 'touch'): Promise<void> {
    const { data, error } = await createAdminClient().rpc('admin_founder_session', {
        p_user_id: candidate.userId, p_session_id: candidate.sessionId, p_operation: operation,
    })
    if (error) throw new AdminError('UNAVAILABLE', 503, 'Founder authorization is unavailable.')
    if (!data || typeof data !== 'object' || !('allowed' in data) || !data.allowed) {
        const code = data && typeof data === 'object' && 'code' in data && typeof data.code === 'string' ? data.code : 'FORBIDDEN'
        const status = code === 'MFA_REQUIRED' || code === 'SESSION_REQUIRED' || code === 'SESSION_EXPIRED' ? 401 : 403
        throw new AdminError(code, status, code === 'MFA_REQUIRED' ? 'Complete founder verification.' : 'Founder access could not be verified.')
    }
}

async function withDenialAudit<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation() }
    catch (error) {
        if (error instanceof AdminError && ['FORBIDDEN','MFA_REQUIRED','SESSION_REQUIRED','SESSION_EXPIRED','UNAUTHENTICATED'].includes(error.code)) {
            // A denied request may lack a valid profile/grant. Authenticate its
            // actor independently, then record only a fixed reason and target.
            const supabase = await createClient()
            const { data: userData } = await supabase.auth.getUser()
            const { data: claimsData } = await supabase.auth.getClaims()
            if (userData.user && claimsData?.claims) {
                let candidate: FounderCandidate | null = null
                try { candidate = validateFounderClaims(claimsData.claims,userData.user.id,process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') }
                catch { /* Invalid tokens never supply an audit actor. */ }
                if (candidate) {
                    const { error: auditError } = await createAdminClient().rpc('admin_record_denial', {
                        p_actor_id: candidate.userId, p_session_id: candidate.sessionId,
                        p_reason_code: error.code, p_request_id: error.requestId,
                    })
                    if (auditError) throw new AdminError('AUDIT_UNAVAILABLE',503,'Access verification is unavailable.')
                }
            }
        }
        throw error
    }
}

export async function requireFounderCandidate(): Promise<FounderCandidate> {
    return withDenialAudit(async () => {
        assertEnabled()
        const candidate = await verifiedCandidate()
        await sessionOperation(candidate, 'candidate')
        return candidate
    })
}

export async function establishFounderSession(): Promise<FounderPrincipal> {
    return withDenialAudit(async () => {
        assertEnabled()
        const candidate = await verifiedCandidate()
        if (candidate.aal !== 'aal2') throw new AdminError('MFA_REQUIRED', 401, 'Complete founder verification.')
        await sessionOperation(candidate, 'establish')
        return { userId: candidate.userId, sessionId: candidate.sessionId, capabilities: FOUNDER_CAPABILITIES }
    })
}
export const startFounderSession = establishFounderSession

export async function requireFounder(): Promise<FounderPrincipal> {
    return withDenialAudit(async () => {
        assertEnabled()
        const candidate = await verifiedCandidate()
        if (candidate.aal !== 'aal2') throw new AdminError('MFA_REQUIRED', 401, 'Complete founder verification.')
        await sessionOperation(candidate, 'check')
        return { userId: candidate.userId, sessionId: candidate.sessionId, capabilities: FOUNDER_CAPABILITIES }
    })
}

export async function requireFounderPage(): Promise<FounderPrincipal> {
    try { return await requireFounder() }
    catch (error) {
        const returnTo = safeFounderReturnPath((await headers()).get('x-pathname'))
        const query = new URLSearchParams({ returnTo })
        if (error instanceof AdminError && ['MFA_REQUIRED', 'SESSION_REQUIRED'].includes(error.code)) redirect(`/admin/verify?${query}`)
        query.set('denied', '1')
        redirect(`/admin/login?${query}`)
    }
}

/** Only an explicit same-origin interactive endpoint calls this. Reads/polling
 * never extend idle time. The database rejects already-expired sessions. */
export async function touchFounderSession(): Promise<void> {
    const principal = await requireFounder()
    await sessionOperation({ ...principal, aal: 'aal2' }, 'touch')
}

/** Revocation deliberately does not depend on profile/grant availability: those
 * can be revoked or unavailable while an existing founder session still needs
 * invalidating. Fresh Auth identity plus verified claims bind the actor. */
export async function revokeFounderSession(): Promise<'revoked' | 'not_applicable'> {
    return revokeFounderSessionsOf(await verifyFounderRevocationActor())
}

/** The actor a revocation binds to, from a fresh Auth identity and verified
 * claims; null when there is no signed-in user. Only a live provider session
 * verifies, so log out finishes this before it ends that session. Log out
 * passes its own client so the session is read and refreshed once. */
export async function verifyFounderRevocationActor(
    supabase?: Awaited<ReturnType<typeof createClient>>,
): Promise<FounderCandidate | null> {
    const client = supabase ?? await createClient()
    const { data: identity, error: identityError } = await client.auth.getUser()
    if (identityError) throw new AdminError('SIGNOUT_UNAVAILABLE',503,'Sign-out verification is unavailable.')
    if (!identity.user) return null
    const { data: token, error: tokenError } = await client.auth.getClaims()
    if (tokenError || !token?.claims) throw new AdminError('SIGNOUT_UNAVAILABLE',503,'Sign-out verification is unavailable.')
    return validateFounderClaims(token.claims, identity.user.id, process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
}

/** Revokes every founder session of a verified actor. The database marks them
 * by user id and never reads the provider session, so log out runs this
 * alongside its provider sign-out. */
export async function revokeFounderSessionsOf(candidate: FounderCandidate | null): Promise<'revoked' | 'not_applicable'> {
    if (!candidate) return 'not_applicable'
    const { data, error } = await createAdminClient().rpc('admin_founder_session', {
        p_user_id: candidate.userId, p_session_id: candidate.sessionId, p_operation: 'revoke',
    })
    if (error || !data || typeof data !== 'object' || !('allowed' in data) || data.allowed !== true
        || !('revoked' in data) || typeof data.revoked !== 'boolean') {
        throw new AdminError('SIGNOUT_UNAVAILABLE',503,'Founder sign-out could not be confirmed.')
    }
    return data.revoked ? 'revoked' : 'not_applicable'
}

export async function adminRecordAudit(
    principal: FounderPrincipal, action: string, targetType: string, targetId: string,
    requestId = randomUUID(), safe: { before?: Record<string, unknown>; after?: Record<string, unknown>; reasonCode?: string; outcome?: 'success' | 'denied' | 'failure' } = {},
): Promise<void> {
    const { error } = await createAdminClient().rpc('admin_record_audit', {
        p_actor_id: principal.userId, p_session_id: principal.sessionId, p_action: action,
        p_target_type: targetType, p_target_id: targetId, p_outcome: safe.outcome ?? 'success',
        p_request_id: requestId, p_reason_code: safe.reasonCode ?? null,
        p_before_safe: safe.before ?? null, p_after_safe: safe.after ?? null,
    })
    if (error) throw new AdminError('AUDIT_UNAVAILABLE', 503, 'This operation could not be audited.', undefined, requestId)
}

/** Compatibility only, pending AD00 operational approval. These capabilities
 * are intentionally absent from the release-one console and off by default. */
export async function requireLegacyFounder(operation: string, access: 'read' | 'write' | 'export' = 'read') {
    const principal = await requireFounder()
    if (access === 'read' && process.env.WEAVLY_ADMIN_LEGACY_READS_ENABLED !== 'true') {
        await adminRecordAudit(principal, `legacy.${operation}`, 'legacy', operation, undefined, { outcome: 'denied', reasonCode: 'legacy_reads_disabled' })
        throw new AdminError('LEGACY_READ_DISABLED', 403, 'This retained read operation requires separate operational approval.')
    }
    // The bounded formal-register DAL has its own read gate. Enabling it must
    // not also expose the old unbounded reference actions.
    if (access === 'read' && process.env.WEAVLY_ADMIN_LEGACY_REFERENCE_ACTIONS_ENABLED !== 'true') {
        await adminRecordAudit(principal, `legacy.${operation}`, 'legacy', operation, undefined, { outcome: 'denied', reasonCode: 'legacy_reference_actions_disabled' })
        throw new AdminError('LEGACY_READ_DISABLED', 403, 'Use the retained formal record views for this operation.')
    }
    if (access !== 'read' && process.env.WEAVLY_ADMIN_LEGACY_OPERATIONS_ENABLED !== 'true') {
        await adminRecordAudit(principal, `legacy.${operation}`, 'legacy', operation, undefined, { outcome: 'denied', reasonCode: 'legacy_operations_disabled' })
        throw new AdminError('LEGACY_OPERATION_DISABLED', 403, 'This retained operation requires separate operational approval.')
    }
    // This records authorization only. It cannot establish that a later
    // compatibility action completed or that its outcome was audited atomically.
    await adminRecordAudit(principal, `legacy.authorize.${operation}`, 'legacy', operation)
    return { ...principal, user: { id: principal.userId } }
}
