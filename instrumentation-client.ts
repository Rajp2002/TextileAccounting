import * as Sentry from "@sentry/nextjs"
import { isFreeTelemetryEvent } from '@/lib/free-telemetry'
import { isSensitiveRoute, isSensitiveTelemetryEvent } from '@/lib/sensitive-routes'
import { redactSentryEvent } from "@/lib/sentry-redaction"
import { readRuntimeSentryRelease, withRuntimeRelease } from "@/lib/sentry-release"

const freePage = () => typeof window !== 'undefined' && /^\/free(?:\/|$)/.test(window.location.pathname)
const sensitivePage = () => typeof window !== 'undefined' && isSensitiveRoute(window.location.pathname)
// Release-one privacy gate: replay stays disabled globally so an owner SPA
// transition cannot carry an already-recording replay into a support thread.
const replaysOnErrorSampleRate = 0

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Read from the page, not compiled in, so this chunk survives deploys.
    release: readRuntimeSentryRelease(),
    // No browser performance tracing: next.config.ts compiles it out of the
    // client bundle. Errors, logs and web vitals are unaffected.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate,
    enableLogs: true,
    debug: false,
    // Session Replay is added by loadReplayWhenIdle() below.
    integrations: [],
    beforeSendTransaction(event) { return freePage() || sensitivePage() || isFreeTelemetryEvent(event) || isSensitiveTelemetryEvent(event) ? null : withRuntimeRelease(event) },
    beforeSendLog(log) { return freePage() || sensitivePage() ? null : log },
    beforeBreadcrumb(breadcrumb) { return freePage() || sensitivePage() ? null : breadcrumb },
    beforeSend(event) {
        if (freePage() || sensitivePage() || isFreeTelemetryEvent(event) || isSensitiveTelemetryEvent(event)) return null
        withRuntimeRelease(event)
        return redactSentryEvent(event)
    },
})

// Replay only records around errors (never on Free pages), yet it is about a
// third of the Sentry client. Importing @sentry/replay directly keeps it in its
// own chunk, so login and every first load skip it until the page is idle.
function loadReplayWhenIdle() {
    if (typeof window === 'undefined' || replaysOnErrorSampleRate === 0) return

    const load = () => {
        import('@sentry/replay')
            .then(({ replayIntegration }) => {
                Sentry.addIntegration(replayIntegration({
                    maskAllText: true,
                    maskAllInputs: true,
                    blockAllMedia: true,
                    block: ['[data-free-costing]'],
                }))
            })
            .catch(() => {
                // Replay is diagnostic only; error reporting keeps working without it.
            })
    }
    const whenIdle = () => {
        if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: 5000 })
        else window.setTimeout(load, 2000)
    }

    if (document.readyState === 'complete') whenIdle()
    else window.addEventListener('load', whenIdle, { once: true })
}

loadReplayWhenIdle()

export function onRouterTransitionStart(...args: Parameters<typeof Sentry.captureRouterTransitionStart>) {
    try {
        performance.mark('route_navigation_start')
    } catch {
        // Performance marks are diagnostic only.
    }
    if (sensitivePage() || args.some(arg => isSensitiveRoute(arg))) return
    return Sentry.captureRouterTransitionStart(...args)
}
