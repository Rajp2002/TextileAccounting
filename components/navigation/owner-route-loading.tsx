'use client'

import { usePathname } from 'next/navigation'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { pageTitleLayoutClass } from '@/components/navigation/page-title-layout'
import { useTranslation } from '@/lib/i18n/context'

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
    ['/owner/estimator', 'Cost Estimate'],
    ['/owner/rates', 'Yarn Rate Book'],
    ['/owner/quotes', 'Saved Costings'],
    ['/owner/settings', 'Settings'],
    ['/owner/billing', 'Subscription & Billing'],
]

const ROUTE_TITLE_OVERRIDES: Array<[string, string]> = [
    ['/owner/production/daily-sheet', 'Daily sheet'],
    ['/owner/stock/audit', 'Inventory Audit & Material Position'],
    ['/owner/settings/audit', 'Audit Trail'],
    ['/owner/data-export', 'Export your complete organization data'],
]

function titleForPath(pathname: string | null) {
    return ROUTE_TITLE_OVERRIDES.find(([prefix]) => pathname === prefix || pathname?.startsWith(`${prefix}/`))?.[1]
        ?? ROUTE_TITLES.find(([prefix]) => pathname === prefix || pathname?.startsWith(`${prefix}/`))?.[1]
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
    const { t } = useTranslation()
    // The Stock audit page is available in every language (PI-07), so its skeleton shows the translated title too.
    const isStockAudit = pathname === '/owner/stock/audit' || Boolean(pathname?.startsWith('/owner/stock/audit/'))
    const title = isStockAudit ? t('stockAudit.title') : titleForPath(pathname)
    const route = routeForPath(pathname)
    return (
        <div className="w-full space-y-6 pt-2 pb-8" role="status" aria-busy="true" aria-label={isStockAudit ? t('stockAudit.loadingLabel', { title }) : `Loading ${title}`}>
            <RouteMilestones route={route} shellVisible primaryUsable={false} />
            <div className={`${pageTitleLayoutClass(pathname ?? route)} border-b border-hairline/80 pb-5 text-center`}>
                <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">{title}</h1>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                {[0, 1, 2, 3].map(index => (
                    <div key={index} className="h-28 animate-pulse rounded-xl border border-hairline bg-surface motion-reduce:animate-none" />
                ))}
            </div>
        </div>
    )
}
