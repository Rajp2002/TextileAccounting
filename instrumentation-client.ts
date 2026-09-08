import * as Sentry from "@sentry/nextjs"
import { isFreeTelemetryEvent } from '@/lib/free-telemetry'
import { redactSentryEvent } from "@/lib/sentry-redaction"

const freePage = () => typeof window !== 'undefined' && /^\/free(?:\/|$)/.test(window.location.pathname)

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: freePage() ? 0 : 0.1,
    enableLogs: true,
    debug: false,
    integrations: [
        Sentry.replayIntegration({
            maskAllText: true,
            maskAllInputs: true,
            blockAllMedia: true,
            block: ['[data-free-costing]'],
        }),
    ],
    beforeSendTransaction(event) { return freePage() || isFreeTelemetryEvent(event) ? null : event },
    beforeSendLog(log) { return freePage() ? null : log },
    beforeBreadcrumb(breadcrumb) { return freePage() ? null : breadcrumb },
    beforeSend(event) {
        return freePage() || isFreeTelemetryEvent(event) ? null : redactSentryEvent(event)
    },
})

export function onRouterTransitionStart(...args: Parameters<typeof Sentry.captureRouterTransitionStart>) {
    try {
        performance.mark('route_navigation_start')
    } catch {
        // Performance marks are diagnostic only.
    }
    return Sentry.captureRouterTransitionStart(...args)
}
