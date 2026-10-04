/** Founder and requester conversations never enter replay or shared caches. */
export function isSensitiveRoute(value: unknown): boolean {
    if (typeof value !== 'string') return false
    try {
        const pathname = new URL(value, 'https://weavly.invalid').pathname
        return /^\/(?:admin|support)(?:\/|$)/.test(pathname)
            || /^\/api\/(?:admin|support)(?:\/|$)/.test(pathname)
    } catch { return false }
}

export function isSensitiveTelemetryEvent(event: { request?: { url?: string }; transaction?: string }): boolean {
    // Sentry's server transactions can be named "GET /api/admin/...".
    // request.url is not guaranteed on every sampled transaction.
    const transaction = event.transaction?.replace(/^(?:GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\s+/i, '')
    return isSensitiveRoute(event.request?.url) || isSensitiveRoute(transaction)
}

export function redactUrlQuery(value: string): string {
    try {
        const url = new URL(value, 'https://weavly.invalid')
        url.search = ''
        url.hash = ''
        return value.startsWith('/') ? url.pathname : url.toString()
    } catch { return '[invalid URL]' }
}

export function mayPersistQuery(query: { queryKey: readonly unknown[]; meta?: Record<string, unknown> }): boolean {
    if (query.meta?.sensitive === true) return false
    // Only allow primitive query keys. Do not inspect/stringify data to make
    // this decision: it could contain conversation bodies or tokens.
    return !query.queryKey.some(key => typeof key === 'string'
        && (isSensitiveRoute(key) || /^(?:admin|support)(?:$|[:./_-])/i.test(key)))
}
