export const PHASE_1_ARCHIVED_ROUTES = [
    '/admin',
    '/owner/inventory',
    '/owner/stock',
    '/owner/ledger',
    '/owner/settings/audit',
    '/owner/system-health',
] as const

export const PHASE_1_ARCHIVE_REDIRECT = '/feature-archived'

export function isPhase1ArchivedRoute(pathname: string) {
    return PHASE_1_ARCHIVED_ROUTES.some((route) =>
        pathname === route || pathname.startsWith(`${route}/`)
    )
}
