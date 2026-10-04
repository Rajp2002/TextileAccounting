/** Exact route classification shared by Proxy and founder sign-in. */
export function isFounderLoginRoute(pathname: string): boolean {
    return pathname === '/admin/login'
}

export function isFounderAuthRoute(pathname: string): boolean {
    return isFounderLoginRoute(pathname) || pathname === '/admin/verify'
}

export function isFounderRoute(pathname: string): boolean {
    return pathname === '/admin' || pathname.startsWith('/admin/')
        || pathname === '/api/admin' || pathname.startsWith('/api/admin/')
}

export function isDedicatedSupportRoute(pathname: string): boolean {
    return pathname === '/support' || pathname.startsWith('/support/')
        || pathname === '/api/support' || pathname.startsWith('/api/support/')
}

const destinations = new Set([
    '/admin', '/admin/factories', '/admin/support', '/admin/payments',
    '/admin/system', '/admin/audit', '/admin/legacy',
])

/** Return paths are fixed internal destinations; query values are not carried through Auth. */
export function safeFounderReturnPath(value: unknown): string {
    if (typeof value !== 'string' || value.length > 180 || /[\\\s?#%]/.test(value)) return '/admin'
    if (destinations.has(value)) return value
    if (/^\/admin\/(factories|support)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value
    return '/admin'
}
