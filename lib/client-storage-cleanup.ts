import {
    getQueryPersistenceKey,
    isPrincipalCacheScope,
    LEGACY_MUTATION_SCOPE,
    REACT_QUERY_PERSISTENCE_KEY,
    SCOPED_QUERY_PERSISTENCE_PREFIX,
} from './auth-cache-scope'
import { getActiveQueryScope } from './query-client-registry'

export { REACT_QUERY_PERSISTENCE_KEY }

export const USER_CACHE_EXACT_KEYS = [
    REACT_QUERY_PERSISTENCE_KEY,
    'weavly-uid',
    'weavly_skip_fixed_staff',
]

export const USER_CACHE_KEY_PREFIXES = [
    'production_meters_',
    'weavly-estimator-draft-',
]

const TRANSITION_STORAGE_KEYS = new Set([
    'weavly:signin-trace',
    'weavly:logout-trace',
])

export type ClientSessionCleanupResult = {
    localStorageKeys: string[]
    sessionStorageKeys: string[]
    offlineQueueCleared: boolean
    legacyQueueCleared: boolean
    errors: string[]
}

export type ClientSessionCleanupOptions = {
    /** The retired verified scope. Unknown identity must remain memory-only. */
    scope?: string | null
    /** When false, only legacy data is removed; the active scope is retained. */
    clearScope?: boolean
    /** Legacy data is quarantined and can be removed during idle cleanup. */
    includeLegacy?: boolean
    /** Keep the current standalone-PWA session marker during auth-boundary cleanup. */
    preservePwaSession?: boolean
}

export function isLegacyUserCacheKey(key: string) {
    return USER_CACHE_EXACT_KEYS.includes(key) ||
        USER_CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
}

export function isScopedQueryCacheKey(key: string) {
    return key.startsWith(SCOPED_QUERY_PERSISTENCE_PREFIX)
}

export function isUserCacheKey(key: string) {
    return isLegacyUserCacheKey(key) || isScopedQueryCacheKey(key)
}

/**
 * Remove only legacy keys plus the explicitly retired scope. Calling this
 * without a scope never enumerates or deletes another principal's cache.
 */
export function clearUserCacheFromStorage(
    storage: Storage,
    options: { scope?: string | null; clearScope?: boolean; includeLegacy?: boolean } = {},
) {
    const scope = isPrincipalCacheScope(options.scope) ? options.scope : null
    const clearScope = options.clearScope ?? true
    const includeLegacy = options.includeLegacy ?? true
    const scopedKey = scope && clearScope ? getQueryPersistenceKey(scope) : null
    const keysToRemove: string[] = []

    for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)
        if (!key) continue

        const shouldRemove = (includeLegacy && isLegacyUserCacheKey(key)) ||
            (scopedKey !== null && key === scopedKey)
        if (shouldRemove) keysToRemove.push(key)
    }

    for (const key of keysToRemove) storage.removeItem(key)
    return keysToRemove
}

export async function clearOfflineMutationQueue(scope?: string | null) {
    if (typeof window === 'undefined' || !isPrincipalCacheScope(scope)) return false

    try {
        const { db } = await import('./db')
        await db.mutations
            .toCollection()
            .filter((mutation) => mutation.scope === scope)
            .delete()
        return true
    } catch (error) {
        console.warn('Unable to clear retired offline mutation scope', error)
        return false
    }
}

export async function clearLegacyOfflineMutationQueue() {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return false

    try {
        // Import the database object instead of the helper function. The
        // helper can be missing from the Turbopack dynamic module shape in
        // development, which made every auth boundary emit a warning during
        // login and logout.
        const { db } = await import('./db')
        await db.mutations
            .toCollection()
            .filter((mutation) => mutation.scope === LEGACY_MUTATION_SCOPE)
            .delete()
        return true
    } catch (error) {
        console.warn('Unable to clear legacy offline mutation scope', error)
        return false
    }
}

function clearLegacySessionStorage(storage: Storage, preservePwaSession: boolean) {
    const keysToRemove = [
        ...(preservePwaSession ? [] : ['weavly_pwa_session_alive']),
    ].filter((key) => !TRANSITION_STORAGE_KEYS.has(key))

    for (const key of keysToRemove) storage.removeItem(key)
    return keysToRemove
}

export async function clearClientSessionState(
    options: ClientSessionCleanupOptions = {},
): Promise<ClientSessionCleanupResult> {
    const result: ClientSessionCleanupResult = {
        localStorageKeys: [],
        sessionStorageKeys: [],
        offlineQueueCleared: false,
        legacyQueueCleared: false,
        errors: [],
    }

    if (typeof window === 'undefined') return result

    const scope = isPrincipalCacheScope(options.scope)
        ? options.scope
        : getActiveQueryScope()
    const clearScope = options.clearScope ?? Boolean(scope)
    const includeLegacy = options.includeLegacy ?? true
    const preservePwaSession = options.preservePwaSession ?? false

    try {
        result.localStorageKeys = clearUserCacheFromStorage(window.localStorage, {
            scope,
            clearScope,
            includeLegacy,
        })
    } catch (error) {
        result.errors.push('localStorage')
        console.warn('Unable to clear browser cache during session cleanup', error)
    }

    try {
        result.sessionStorageKeys = clearLegacySessionStorage(window.sessionStorage, preservePwaSession)
    } catch (error) {
        result.errors.push('sessionStorage')
        console.warn('Unable to clear session flags during session cleanup', error)
    }

    result.offlineQueueCleared = clearScope
        ? await clearOfflineMutationQueue(scope)
        : false
    if (includeLegacy) result.legacyQueueCleared = await clearLegacyOfflineMutationQueue()
    return result
}

export function scheduleClientSessionCleanup(
    options: ClientSessionCleanupOptions & {
        onComplete?: (result: ClientSessionCleanupResult) => void
    } = {},
) {
    if (typeof window === 'undefined') return

    const { onComplete, ...cleanupOptions } = options
    const run = () => {
        void clearClientSessionState(cleanupOptions)
            .then((result) => onComplete?.(result))
            .catch((error) => {
                console.warn('Deferred browser session cleanup failed', error)
                onComplete?.({
                    localStorageKeys: [],
                    sessionStorageKeys: [],
                    offlineQueueCleared: false,
                    legacyQueueCleared: false,
                    errors: ['deferred-cleanup'],
                })
            })
    }

    const idleWindow = window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
    }
    if (idleWindow.requestIdleCallback) {
        idleWindow.requestIdleCallback(run, { timeout: 1000 })
    } else {
        window.setTimeout(run, 0)
    }
}
