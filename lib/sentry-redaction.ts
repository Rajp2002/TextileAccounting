type SentryBreadcrumb = {
    message?: string
    data?: Record<string, unknown>
}

type SentryExceptionValue = {
    value?: string
}

type RedactableSentryEvent = {
    message?: string
    user?: Record<string, unknown>
    request?: {
        url?: string
        query_string?: unknown
        cookies?: string
        headers?: Record<string, unknown>
    }
    breadcrumbs?: SentryBreadcrumb[]
    exception?: {
        values?: SentryExceptionValue[]
    }
}

export function redactSensitiveText(value: string) {
    return value
        .replace(/\b\d{4}\s\d{4}\s\d{4}\b|\b\d{12}\b/g, "[AADHAAR_REDACTED]")
        .replace(/\b(?:\+91|91|0)?[6-9]\d{9}\b/g, "[PHONE_REDACTED]")
        .replace(/\b[0-9]{9,18}\b/g, "[BANK_AC_REDACTED]")
}

export function redactSentryEvent<T>(event: T): T {
    const redactionTarget = event as RedactableSentryEvent

    if (redactionTarget.user) {
        redactionTarget.user = {
            ...redactionTarget.user,
            email: redactionTarget.user.email ? "[redacted]" : redactionTarget.user.email,
            ip_address: redactionTarget.user.ip_address ? "[redacted]" : redactionTarget.user.ip_address,
            username: redactionTarget.user.username ? "[redacted]" : redactionTarget.user.username,
        }
    }

    if (redactionTarget.message) redactionTarget.message = redactSensitiveText(redactionTarget.message)

    if (redactionTarget.request) {
        if (redactionTarget.request.url) redactionTarget.request.url = redactSensitiveText(redactionTarget.request.url)
        if (redactionTarget.request.query_string) redactionTarget.request.query_string = "[redacted]"
        if (redactionTarget.request.cookies) redactionTarget.request.cookies = "[redacted]"
        if (redactionTarget.request.headers) {
            redactionTarget.request.headers = {
                ...redactionTarget.request.headers,
                authorization: redactionTarget.request.headers.authorization ? "[redacted]" : redactionTarget.request.headers.authorization,
                Authorization: redactionTarget.request.headers.Authorization ? "[redacted]" : redactionTarget.request.headers.Authorization,
                cookie: redactionTarget.request.headers.cookie ? "[redacted]" : redactionTarget.request.headers.cookie,
                Cookie: redactionTarget.request.headers.Cookie ? "[redacted]" : redactionTarget.request.headers.Cookie,
            }
        }
    }

    redactionTarget.breadcrumbs?.forEach((breadcrumb) => {
        if (breadcrumb.message) breadcrumb.message = redactSensitiveText(breadcrumb.message)
        if (typeof breadcrumb.data?.url === "string") {
            breadcrumb.data.url = redactSensitiveText(breadcrumb.data.url)
        }
    })

    redactionTarget.exception?.values?.forEach((value) => {
        if (value.value) value.value = redactSensitiveText(value.value)
    })

    return event
}
