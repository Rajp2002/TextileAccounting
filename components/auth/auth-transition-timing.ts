/**
 * One full round of the auth marks: the loom's two picks and take-up, and the
 * spool's sway along its barrel. Must match `--auth-round` in app/globals.css.
 */
export const AUTH_TRANSITION_ROUND_MS = 1600

function prefersReducedMotion() {
    try {
        return typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
        return false
    }
}

/**
 * How much longer an overlay opened at `startedAt` must stay so its mark
 * completes one round. Reduced motion shows a still mark, so it never waits.
 */
export function transitionHoldMs(startedAt: number, now: number, reducedMotion: boolean): number {
    if (reducedMotion) return 0
    return Math.max(0, Math.round(AUTH_TRANSITION_ROUND_MS - (now - startedAt)))
}

/**
 * Resolves with the time held once the overlay opened at `startedAt`
 * (a `performance.now()` reading) has shown one full round. A request that
 * already took longer than a round resolves at once.
 */
export function holdForTransitionRound(startedAt: number): Promise<number> {
    const hold = transitionHoldMs(startedAt, performance.now(), prefersReducedMotion())
    if (hold === 0) return Promise.resolve(0)
    return new Promise((resolve) => setTimeout(() => resolve(hold), hold))
}
