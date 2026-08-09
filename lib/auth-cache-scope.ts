/**
 * The browser cache boundary is derived from identity that the server has
 * already verified.  Only the opaque scope is sent to client persistence
 * helpers; raw user/org identifiers never become storage keys.
 */
export const AUTH_CACHE_VERSION = 's22-v1'
export const REACT_QUERY_PERSISTENCE_KEY = 'REACT_QUERY_OFFLINE_CACHE'
export const SCOPED_QUERY_PERSISTENCE_PREFIX = `${REACT_QUERY_PERSISTENCE_KEY}:${AUTH_CACHE_VERSION}:`
export const LEGACY_MUTATION_SCOPE = 'legacy-unscoped'

export type VerifiedPrincipal = {
    userId: string
    organizationId?: string | null
}

function hashPart(value: string, seed: number) {
    let hash = seed >>> 0
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619) >>> 0
    }
    return hash.toString(16).padStart(8, '0')
}

function opaquePrincipalHash(value: string) {
    return `${hashPart(value, 2166136261)}${hashPart(value, 2654435761)}`
}

export function isPrincipalCacheScope(value: unknown): value is string {
    return typeof value === 'string' && /^s22-v1:[a-f0-9]{16}$/.test(value)
}

export function createPrincipalCacheScope(principal: VerifiedPrincipal): string | null {
    const userId = principal.userId.trim()
    if (!userId) return null

    const organizationId = principal.organizationId?.trim() || 'onboarding'
    return `${AUTH_CACHE_VERSION}:${opaquePrincipalHash(`${userId}:${organizationId}`)}`
}

export function getQueryPersistenceKey(scope: string): string {
    if (!isPrincipalCacheScope(scope)) {
        throw new Error('A verified principal cache scope is required for persistence.')
    }

    return `${SCOPED_QUERY_PERSISTENCE_PREFIX}${scope.slice(`${AUTH_CACHE_VERSION}:`.length)}`
}
