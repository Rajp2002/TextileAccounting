/**
 * The Sentry release reaches the browser at runtime, never through the bundle.
 *
 * Compiling the commit SHA into client code put it inside the shared Sentry
 * chunk, so that chunk (about 150 KB brotli) changed on every deploy and every
 * user re-downloaded and recompiled it on their next open. The root layout
 * writes `window.SENTRY_RELEASE` (the global Sentry's own plugin uses) and the
 * client SDK reads it here.
 */

type ReleaseWindow = Window & { SENTRY_RELEASE?: { id?: unknown } }

/** Static inline script for the root head (deploy-time value, no user input). */
export function buildSentryReleaseScript(release: string): string {
    return `window.SENTRY_RELEASE={id:${JSON.stringify(release).replace(/</g, '\\u003c')}};`
}

export function readRuntimeSentryRelease(): string | undefined {
    if (typeof window === 'undefined') return undefined
    const id = (window as ReleaseWindow).SENTRY_RELEASE?.id
    return typeof id === 'string' && id ? id : undefined
}

/** Fills the release on events sent before the head script was parsed. */
export function withRuntimeRelease<T extends { release?: string }>(event: T): T {
    if (!event.release) {
        const release = readRuntimeSentryRelease()
        if (release) event.release = release
    }
    return event
}
