import * as Sentry from "@sentry/nextjs"

const tracesSampleRate = process.env.NODE_ENV === "production" ? 0.1 : 1.0

function redactSensitiveText(value: string) {
    return value
        .replace(/\b\d{4}\s\d{4}\s\d{4}\b|\b\d{12}\b/g, "[AADHAAR_REDACTED]")
        .replace(/\b[0-9]{9,18}\b/g, "[BANK_AC_REDACTED]")
        .replace(/\b(?:\+91|91|0)?[6-9]\d{9}\b/g, "[PHONE_REDACTED]")
}

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        Sentry.init({
            dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
            tunnel: '/api/sentry-tunnel',
            tracesSampleRate,
            debug: false,
            beforeSend(event) {
                if (event.user?.email) {
                    event.user = { ...event.user, email: "[redacted]" }
                }
                return event
            },
        })
    }

    if (process.env.NEXT_RUNTIME === "edge") {
        Sentry.init({
            dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
            tunnel: '/api/sentry-tunnel',
            tracesSampleRate,
            debug: false,
            beforeSend(event) {
                if (event.message) event.message = redactSensitiveText(event.message)
                return event
            },
        })
    }
}

export const onRequestError = Sentry.captureRequestError
