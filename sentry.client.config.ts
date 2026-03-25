import * as Sentry from "@sentry/nextjs"

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Capture 10% of transactions in production — keeps costs low
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replays: 10% of errors only (no session-wide recording to protect user privacy)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,

    debug: false,

    integrations: [
        Sentry.replayIntegration({
            maskAllText: true,      // Mask all text to avoid capturing sensitive input
            blockAllMedia: true,    // Block screenshots of media
        }),
    ],

    // Scrub PII from events before sending to Sentry
    beforeSend(event) {
        // Remove user email from breadcrumbs (DPDP compliance)
        if (event.user?.email) {
            event.user = { ...event.user, email: '[redacted]' }
        }
        return event
    },
})
