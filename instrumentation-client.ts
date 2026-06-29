import * as Sentry from "@sentry/nextjs"
import { redactSentryEvent } from "@/lib/sentry-redaction"

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    enableLogs: true,
    debug: false,
    integrations: [
        Sentry.replayIntegration({
            maskAllText: true,
            maskAllInputs: true,
            blockAllMedia: true,
        }),
    ],
    beforeSend(event) {
        return redactSentryEvent(event)
    },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
