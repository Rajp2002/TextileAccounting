import * as Sentry from "@sentry/nextjs"

function redactSensitiveText(value: string) {
    return value
        .replace(/\b\d{4}\s\d{4}\s\d{4}\b|\b\d{12}\b/g, "[AADHAAR_REDACTED]")
        .replace(/\b[0-9]{9,18}\b/g, "[BANK_AC_REDACTED]")
        .replace(/\b(?:\+91|91|0)?[6-9]\d{9}\b/g, "[PHONE_REDACTED]")
}

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tunnel: '/api/sentry-tunnel',
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
        if (event.user?.email) {
            event.user = { ...event.user, email: "[redacted]" }
        }

        event.breadcrumbs?.forEach((breadcrumb) => {
            if (breadcrumb.message) breadcrumb.message = redactSensitiveText(breadcrumb.message)
            if (typeof breadcrumb.data?.url === "string") {
                breadcrumb.data.url = redactSensitiveText(breadcrumb.data.url)
            }
        })

        event.exception?.values?.forEach((value) => {
            if (value.value) value.value = redactSensitiveText(value.value)
        })

        return event
    },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
