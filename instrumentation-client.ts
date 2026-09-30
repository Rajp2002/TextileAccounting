import * as Sentry from "@sentry/nextjs"
import { isFreeTelemetryEvent } from '@/lib/free-telemetry'
import { redactSentryEvent } from "@/lib/sentry-redaction"

const freePage = () => typeof window !== 'undefined' && /^\/free(?:\/|$)/.test(window.location.pathname)
const replaysOnErrorSampleRate = freePage() ? 0 : 0.1

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate,
    enableLogs: true,
    debug: false,
    // Session Replay is added by loadReplayWhenIdle() below.
    integrations: [],
    beforeSendTransaction(event) { return freePage() || isFreeTelemetryEvent(event) ? null : event },
    beforeSendLog(log) { return freePage() ? null : log },
    beforeBreadcrumb(breadcrumb) { return freePage() ? null : breadcrumb },
    beforeSend(event) {
        return freePage() || isFreeTelemetryEvent(event) ? null : redactSentryEvent(event)
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
    return Sentry.captureRouterTransitionStart(...args)
}
