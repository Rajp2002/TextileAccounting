/**
 * One full round of the auth marks: the loom's two picks and take-up, and the
 * spool's sway along its barrel. Must match `--auth-round` in app/globals.css.
 */
export const AUTH_TRANSITION_ROUND_MS = 1600

export type AuthNavigationKind = 'sign-in' | 'sign-out'

/**
 * How long the browser keeps the old page up after a full-page navigation
 * starts, until the next page paints. Used until this device has measured its
 * own (see `rememberPageLoadMs`).
 */
export const DEFAULT_PAGE_LOAD_MS: Record<AuthNavigationKind, number> = {
    'sign-in': 700,
    'sign-out': 350,
}

const MIN_PAGE_LOAD_MS = 100
// A cold start must not pull the navigation so early that the round is cut short.
const MAX_PAGE_LOAD_MS = AUTH_TRANSITION_ROUND_MS - 100

const PAGE_LOAD_STORAGE_KEY = 'weavly:auth-page-load-ms'
const NAVIGATION_MARK_STORAGE_KEY = 'weavly:auth-navigation'
const NAVIGATION_MARK_TTL_MS = 30_000

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function browserStorage(area: 'localStorage' | 'sessionStorage'): KeyValueStorage | null {
    try {
        return typeof window === 'undefined' ? null : window[area]
    } catch {
        return null
    }
}

function prefersReducedMotion() {
    try {
        return typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
        return false
    }
}

function clampPageLoadMs(ms: number) {
    return Math.round(Math.min(MAX_PAGE_LOAD_MS, Math.max(MIN_PAGE_LOAD_MS, ms)))
}

function readLearnedPageLoads(storage: KeyValueStorage | null): Partial<Record<AuthNavigationKind, number>> {
    try {
        const parsed: unknown = JSON.parse(storage?.getItem(PAGE_LOAD_STORAGE_KEY) ?? 'null')
        if (typeof parsed !== 'object' || parsed === null) return {}
        const learned: Partial<Record<AuthNavigationKind, number>> = {}
        for (const kind of ['sign-in', 'sign-out'] as const) {
            const value = (parsed as Record<string, unknown>)[kind]
            if (typeof value === 'number' && Number.isFinite(value)) learned[kind] = clampPageLoadMs(value)
        }
        return learned
    } catch {
        return {}
    }
}

/**
 * How long the page after this kind of navigation takes to paint on this
 * device: what it measured last time, or a typical figure the first time.
 */
export function expectedPageLoadMs(
    kind: AuthNavigationKind,
    storage: KeyValueStorage | null = browserStorage('localStorage'),
): number {
    return readLearnedPageLoads(storage)[kind] ?? DEFAULT_PAGE_LOAD_MS[kind]
}

/** Folds a measured page load into what the device expects next time. */
export function rememberPageLoadMs(
    kind: AuthNavigationKind,
    measuredMs: number,
    storage: KeyValueStorage | null = browserStorage('localStorage'),
) {
    if (!storage || !Number.isFinite(measuredMs) || measuredMs <= 0) return
    const measured = clampPageLoadMs(measuredMs)
    const learned = readLearnedPageLoads(storage)
    const previous = learned[kind]
    learned[kind] = previous === undefined ? measured : Math.round((previous + measured) / 2)
    try {
        storage.setItem(PAGE_LOAD_STORAGE_KEY, JSON.stringify(learned))
    } catch {
        // Learning is an optimisation; the default lead still applies.
    }
}

/** Notes that this tab is about to leave for the page after an auth step. */
export function markAuthNavigation(
    kind: AuthNavigationKind,
    now: number = Date.now(),
    storage: KeyValueStorage | null = browserStorage('sessionStorage'),
) {
    try {
        storage?.setItem(NAVIGATION_MARK_STORAGE_KEY, JSON.stringify({ kind, at: now }))
    } catch {
        // Learning is an optimisation; never delay or block navigation.
    }
}

function readAuthNavigationMark(now: number, storage: KeyValueStorage | null): AuthNavigationKind | null {
    try {
        const parsed: unknown = JSON.parse(storage?.getItem(NAVIGATION_MARK_STORAGE_KEY) ?? 'null')
        if (typeof parsed !== 'object' || parsed === null) return null
        const { kind, at } = parsed as { kind?: unknown; at?: unknown }
        if (kind !== 'sign-in' && kind !== 'sign-out') return null
        if (typeof at !== 'number' || now - at > NAVIGATION_MARK_TTL_MS || now < at) return null
        return kind
    } catch {
        return null
    }
}

/** Which auth navigation just landed here, if one did a moment ago. Leaves the mark in place. */
export function peekAuthNavigationMark(
    now: number = Date.now(),
    storage: KeyValueStorage | null = browserStorage('sessionStorage'),
): AuthNavigationKind | null {
    return readAuthNavigationMark(now, storage)
}

/** Like `peekAuthNavigationMark`, and the mark is used up so one load is measured once. */
export function takeAuthNavigationMark(
    now: number = Date.now(),
    storage: KeyValueStorage | null = browserStorage('sessionStorage'),
): AuthNavigationKind | null {
    const kind = readAuthNavigationMark(now, storage)
    try {
        storage?.removeItem(NAVIGATION_MARK_STORAGE_KEY)
    } catch {
        // A stale mark expires on its own.
    }
    return kind
}

/**
 * How much longer an overlay opened at `startedAt` must wait before the page
 * change starts, so the next page (which takes `pageLoadMs` to paint, with the
 * old page still showing meanwhile) appears as the mark completes one round.
 * Reduced motion shows a still mark, so it never waits.
 */
export function transitionHoldMs(
    startedAt: number,
    now: number,
    reducedMotion: boolean,
    pageLoadMs = 0,
): number {
    if (reducedMotion) return 0
    return Math.max(0, Math.round(AUTH_TRANSITION_ROUND_MS - pageLoadMs - (now - startedAt)))
}

/**
 * Resolves with the time held once it is time to leave the page: one page load
 * before the overlay opened at `startedAt` (a `performance.now()` reading)
 * finishes its round. A request that already took longer resolves at once.
 */
export function holdForTransitionRound(startedAt: number, pageLoadMs = 0): Promise<number> {
    const hold = transitionHoldMs(startedAt, performance.now(), prefersReducedMotion(), pageLoadMs)
    if (hold === 0) return Promise.resolve(0)
    return new Promise((resolve) => setTimeout(() => resolve(hold), hold))
}
