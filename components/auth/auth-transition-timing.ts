/**
 * One full round of the auth marks: the loom's two picks and take-up, and the
 * spool's sway along its barrel. Must match `--auth-round` in app/globals.css.
 */
export const AUTH_TRANSITION_ROUND_MS = 1600

/** Matches the `auth-transition-leave` animation in app/globals.css. */
export const AUTH_TRANSITION_LEAVE_MS = 180

export function prefersReducedMotion() {
    try {
        return typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
        return false
    }
}
