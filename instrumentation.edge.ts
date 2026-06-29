import * as Sentry from "@sentry/nextjs"
import { redactSentryEvent } from "@/lib/sentry-redaction"

export function register() {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
        debug: false,
        beforeSend(event) {
            return redactSentryEvent(event)
        },
    })
}

export const onRequestError = Sentry.captureRequestError
