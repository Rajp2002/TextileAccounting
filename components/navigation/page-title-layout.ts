const PAGE_TITLE_LAYOUTS: Array<[string, string]> = [
    ['/owner/production/daily-sheet', 'mx-auto w-full'],
    ['/owner/stock/audit', 'mx-auto w-full'],
    ['/owner/settings/audit', 'mx-auto w-full'],
    ['/owner/data-export', 'mx-auto w-full max-w-2xl'],
    ['/owner/workers', 'workers-workspace-shell mx-auto w-full'],
    ['/owner/setup', 'workers-workspace-shell mx-auto w-full'],
    ['/owner/machines', 'machines-workspace-shell mx-auto w-full'],
    ['/owner/payroll', 'payroll-workspace-shell mx-auto w-full'],
    ['/owner/dispatches', 'dispatch-workspace-shell mx-auto w-full'],
    ['/owner/production', 'production-overview-workspace mx-auto w-full'],
    ['/owner/operations', 'configuration-page-frame mx-auto w-full'],
    ['/owner/assignments', 'configuration-page-frame mx-auto w-full'],
    ['/owner/stock', 'mx-auto w-full'],
    ['/owner/rates', 'mx-auto w-full'],
    ['/owner/settings', 'mx-auto w-full max-w-6xl'],
    ['/owner/billing', 'mx-auto w-full'],
    ['/owner/quotes', 'mx-auto w-full'],
    ['/free', 'mx-auto w-full'],
]

/**
 * Keep a loading title inside the same shell as its rendered page. The shell
 * itself fills the width beside the sidebar (capped by --main-max), so only the
 * deliberately narrow form pages (Settings, Data export) carry their own cap.
 */
export function pageTitleLayoutClass(route: string) {
    return PAGE_TITLE_LAYOUTS.find(([prefix]) => route === prefix || route.startsWith(`${prefix}/`))?.[1]
        ?? 'mx-auto w-full'
}
