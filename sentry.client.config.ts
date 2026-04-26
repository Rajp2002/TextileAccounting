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

    // Scrub PII from events before sending to Sentry (DPDP 2026 Compliance)
    beforeSend(event) {
        // Redact email
        if (event.user?.email) {
            event.user = { ...event.user, email: '[redacted]' }
        }

        // Deeply scrub breadcrumbs and extra data for PII patterns
        const piiRegex = {
            aadhaar: /\b\d{4}\s\d{4}\s\d{4}\b|\b\d{12}\b/g, // 12-digit Aadhaar (with or without spaces)
            bankAccount: /\b[0-9]{9,18}\b/g,               // 9-18 digit bank account numbers
            phone: /\b(?:\+91|91|0)?[6-9]\d{9}\b/g         // Indian phone numbers
        }

        const redact = (str: string) => str
            .replace(piiRegex.aadhaar, '[AADHAAR_REDACTED]')
            .replace(piiRegex.bankAccount, '[BANK_AC_REDACTED]')
            .replace(piiRegex.phone, '[PHONE_REDACTED]')

        // Scrub breadcrumbs
        if (event.breadcrumbs) {
            event.breadcrumbs.forEach(breadcrumb => {
                if (breadcrumb.message) breadcrumb.message = redact(breadcrumb.message)
                if (breadcrumb.data?.url) breadcrumb.data.url = redact(breadcrumb.data.url)
            });
        }

        // Scrub exception values
        if (event.exception?.values) {
            event.exception.values.forEach(val => {
                if (val.value) val.value = redact(val.value)
            });
        }

        return event
    },
})
