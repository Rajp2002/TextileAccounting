// Local diagnostic marks only. Never include query strings, record IDs, or names.
const ROUTES = [
    '/owner/production/daily-sheet', '/owner/stock/yarn',
    '/owner/settings/audit', '/owner/production', '/owner/assignments', '/owner/operations',
    '/owner/workers', '/owner/machines', '/owner/payroll', '/owner/stock', '/owner/dispatches',
    '/owner/estimator', '/owner/quotes', '/owner/rates', '/owner/settings', '/owner/billing',
    '/owner/data-export', '/owner/setup', '/free/costings', '/free/account', '/free/billing', '/free',
]

export function diagnosticRoute(value: string): string {
    const path = value.split(/[?#]/, 1)[0]
    return ROUTES.find(route => path === route || path.startsWith(`${route}/`)) ?? '/workspace'
}

export function createRouteMilestoneTracker(mark: (name: string) => void) {
    let currentRoute = ''
    let completed = new Set<string>()
    return (route: string, states: { shell: boolean; primary: boolean; secondary: boolean }) => {
        const safeRoute = diagnosticRoute(route)
        if (safeRoute !== currentRoute) {
            currentRoute = safeRoute
            completed = new Set()
        }
        for (const [stage, ready] of Object.entries(states)) {
            if (!ready || completed.has(stage)) continue
            completed.add(stage)
            const event = `route_${stage === 'shell' ? 'shell_visible' : stage === 'primary' ? 'primary_usable' : 'secondary_ready'}`
            mark(event)
            mark(`${event}:${safeRoute}`)
        }
    }
}
