import * as Sentry from "@sentry/nextjs"
import { redactSentryEvent } from "@/lib/sentry-redaction"

import { isFreeTelemetryEvent } from '@/lib/free-telemetry'
import { isSensitiveTelemetryEvent } from '@/lib/sensitive-routes'

const tracesSampleRate = process.env.NODE_ENV === "production" ? 0.1 : 1.0

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        Sentry.init({
            dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
            tracesSampleRate,
            debug: false,
            beforeSendTransaction(event) { return isFreeTelemetryEvent(event) || isSensitiveTelemetryEvent(event) ? null : event },
            beforeSend(event) {
                return isFreeTelemetryEvent(event) || isSensitiveTelemetryEvent(event) ? null : redactSentryEvent(event)
            },
        })
    }

    if (process.env.NEXT_RUNTIME === "edge") {
        Sentry.init({
            dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
            tracesSampleRate,
            debug: false,
            beforeSendTransaction(event) { return isFreeTelemetryEvent(event) || isSensitiveTelemetryEvent(event) ? null : event },
            beforeSend(event) {
                return isFreeTelemetryEvent(event) || isSensitiveTelemetryEvent(event) ? null : redactSentryEvent(event)
            },
        })
    }
}

export const onRequestError = Sentry.captureRequestError
