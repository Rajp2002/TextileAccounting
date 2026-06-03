import * as Sentry from "@sentry/nextjs"

export function register() {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
        debug: false,
    })
}

export const onRequestError = Sentry.captureRequestError
