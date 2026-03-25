import * as Sentry from "@sentry/nextjs"

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Log errors from server actions / API routes
    debug: false,

    // Scrub PII from server-side events
    beforeSend(event) {
        if (event.user?.email) {
            event.user = { ...event.user, email: '[redacted]' }
        }
        return event
    },
})
