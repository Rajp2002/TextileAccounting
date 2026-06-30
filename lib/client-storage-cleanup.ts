export const REACT_QUERY_PERSISTENCE_KEY = 'REACT_QUERY_OFFLINE_CACHE'

export const USER_CACHE_EXACT_KEYS = [
    REACT_QUERY_PERSISTENCE_KEY,
    'weavly-uid',
    'weavly_skip_fixed_staff',
]

export const USER_CACHE_KEY_PREFIXES = [
    'production_meters_',
    'weavly-estimator-draft-',
]

export function isUserCacheKey(key: string) {
    return USER_CACHE_EXACT_KEYS.includes(key) ||
        USER_CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
}

export function clearUserCacheFromStorage(storage: Storage) {
    const keysToRemove: string[] = []
    for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)
        if (key && isUserCacheKey(key)) keysToRemove.push(key)
    }

    for (const key of keysToRemove) storage.removeItem(key)

    return keysToRemove
}

export async function clearOfflineMutationQueue() {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return false

    try {
        const { db } = await import('@/lib/db')
        await db.mutations.clear()
        return true
    } catch (error) {
        console.warn('Unable to clear offline mutation queue during session cleanup', error)
        return false
    }
}

export async function clearClientSessionState() {
    if (typeof window === 'undefined') {
        return {
            localStorageKeys: [] as string[],
            sessionStorageCleared: false,
            offlineQueueCleared: false,
        }
    }

    let localStorageKeys: string[] = []
    let sessionStorageCleared = false

    try {
        localStorageKeys = clearUserCacheFromStorage(window.localStorage)
    } catch (error) {
        console.warn('Unable to clear local user cache during session cleanup', error)
    }

    try {
        window.sessionStorage.clear()
        sessionStorageCleared = true
    } catch (error) {
        console.warn('Unable to clear session storage during session cleanup', error)
    }

    const offlineQueueCleared = await clearOfflineMutationQueue()

    return {
        localStorageKeys,
        sessionStorageCleared,
        offlineQueueCleared,
    }
}
