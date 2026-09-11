'use client'

import { usePathname } from 'next/navigation'
import { RouteMilestones } from '@/components/performance/route-milestones'

const ROUTE_TITLES: Array<[string, string]> = [
    ['/free/costings', 'Saved Costings'],
    ['/free/account', 'Settings'],
    ['/free/billing', 'Subscription & Billing'],
    ['/free', 'Cost Estimate'],
    ['/owner/production', 'Production'],
    ['/owner/workers', 'Workers'],
    ['/owner/machines', 'Machines'],
    ['/owner/assignments', 'Machine Assignments'],
    ['/owner/operations', 'Machine Assignments'],
    ['/owner/setup', 'Workers'],
    ['/owner/payroll', 'Payroll'],
    ['/owner/stock', 'Stock'],
    ['/owner/dispatches', 'Dispatches'],
    ['/owner/today', 'Factory Today'],
    ['/owner/analytics', 'Analytics'],
    ['/owner/orders', 'Party Orders'],
    ['/owner/market-runs', 'Market Runs'],
    ['/owner/commercials', 'Party Ledger'],
    ['/owner/fixed-workers', 'Workers'],
    ['/owner/advances', 'Upaad'],
    ['/owner/machines', 'Looms'],
    ['/owner/archive', 'Archive'],
    ['/owner/estimator', 'Cost Estimate'],
    ['/owner/rates', 'Yarn Rate Book'],
    ['/owner/quotes', 'Saved Costings'],
    ['/owner/settings', 'Settings'],
    ['/owner/billing', 'Subscription & Billing'],
]

function titleForPath(pathname: string | null) {
    return ROUTE_TITLES.find(([prefix]) => pathname === prefix || pathname?.startsWith(`${prefix}/`))?.[1]
        ?? 'Weavly'
}

function routeForPath(pathname: string | null) {
    return ROUTE_TITLES.find(([prefix]) => pathname === prefix || pathname?.startsWith(`${prefix}/`))?.[0]
        ?? pathname
        ?? '/owner'
}

/** Route-aware fallback used while secure owner context resolves. */
export function OwnerRouteLoading() {
    const pathname = usePathname()
    const title = titleForPath(pathname)
    const route = routeForPath(pathname)

    return (
        <div className="w-full space-y-6 pt-2 pb-8" role="status" aria-busy="true" aria-label={`Loading ${title}`}>
            <RouteMilestones route={route} shellVisible primaryUsable={false} />
            <div className="space-y-2 border-b border-hairline/80 pb-5">
                <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
                <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-surface-soft motion-reduce:animate-none" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                {[0, 1, 2, 3].map(index => (
                    <div key={index} className="h-28 animate-pulse rounded-xl border border-hairline bg-surface motion-reduce:animate-none" />
                ))}
            </div>
        </div>
    )
}
