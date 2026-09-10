/**
 * Session emphasis coordinator:
 * Enforces at most one animated halo across the entire signed-in user's browser-tab session,
 * surviving reloads and route navigation.
 */

function getSessionKey(userId: string): string {
    return `weavly:tour-session-animation:v1:${userId}`
}

export function isReducedMotionPreferred(): boolean {
    if (typeof window === 'undefined') return true
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
        return false
    }
}

/**
 * Checks whether the tab session animation budget has already been claimed.
 */
export function hasClaimedSessionAnimation(userId: string): boolean {
    if (typeof window === 'undefined') return true
    if (!userId) return true
    try {
        return window.sessionStorage.getItem(getSessionKey(userId)) === 'granted'
    } catch {
        // Storage restricted or error: suppress motion rather than risk repeating it
        return true
    }
}

/**
 * Atomically attempts to claim the animation budget for this signed-in tab session.
 * Returns true if granted, false if already claimed or restricted.
 */
export function claimSessionAnimation(userId: string): boolean {
    if (typeof window === 'undefined') return false
    if (!userId) return false
    if (isReducedMotionPreferred()) return false

    try {
        const key = getSessionKey(userId)
        if (window.sessionStorage.getItem(key) === 'granted') {
            return false
        }
        window.sessionStorage.setItem(key, 'granted')
        return true
    } catch {
        // If sessionStorage fails, suppress motion rather than repeat
        return false
    }
}

/**
 * For testing purposes only: clears the tab session animation grant.
 */
export function __resetSessionAnimationForTesting(userId: string): void {
    if (typeof window === 'undefined') return
    try {
        window.sessionStorage.removeItem(getSessionKey(userId))
    } catch {}
}
