import type { NavigationDestination } from './disclosure-navigation'
import { ownerRouteActive, type visibleOwnerNavigation } from './owner-navigation'
import { resolveStockKind, stockDestinations } from './stock-navigation'
import type { SubscriptionTier } from './subscription-access'

// Keep this in sync with the phone and short touch-landscape rules in mobile.css.
export const MOBILE_WORKSPACE_QUERY = '(max-width: 767.98px), (pointer: coarse) and (max-height: 500px) and (max-width: 1023.98px)'

export type MobileWorkflowGroup = {
    id: 'costing' | 'production' | 'stock' | 'workforce'
    translationKey: string
    destinations: NavigationDestination[]
}
type VisibleSections = ReturnType<typeof visibleOwnerNavigation>
const primaryCostingLabels: Record<string, string> = {
    estimate: 'navigation.mobile_estimate',
    costings: 'navigation.mobile_costings',
    rates: 'navigation.mobile_rates',
}

/** Presentation only: every destination inherits an already-visible feature grant. */
export function getMobileWorkflowNavigation(sections: VisibleSections, tier: SubscriptionTier) {
    const items = sections.flatMap(section => section.items)
    if (tier !== 'base') {
        return {
            primary: sections.filter(section => section.id === 'costing').flatMap(section => section.items).map(item => ({
                ...item, translationKey: primaryCostingLabels[item.id] ?? item.translationKey,
            })),
            groups: [] as MobileWorkflowGroup[],
        }
    }

    const byIds = (ids: string[]) => ids.flatMap(id => items.filter(item => item.id === id))
    const production = items.find(item => item.id === 'production')
    const stock = items.find(item => item.id === 'stock')
    const dailySheetHref = '/owner/production/daily-sheet'
    const groups: MobileWorkflowGroup[] = [
        { id: 'costing', translationKey: 'navigation.sections.costing', destinations: byIds(['estimate', 'costings', 'rates']) },
        {
            id: 'production', translationKey: 'navigation.production', destinations: [
                ...(production ? [
                    { ...production, id: 'production_daily_sheet', name: 'Daily Sheet', translationKey: 'navigation.production_daily_sheet', href: dailySheetHref, active: (pathname: string) => ownerRouteActive(pathname, dailySheetHref) },
                    { ...production, id: 'production_overview', name: 'Overview', translationKey: 'navigation.production_overview', active: (pathname: string) => ownerRouteActive(pathname, production.href) && !ownerRouteActive(pathname, dailySheetHref) },
                ] : []),
                ...byIds(['assignments', 'machines']),
            ],
        },
        {
            id: 'stock', translationKey: 'navigation.stock', destinations: [
                ...(stock ? stockDestinations.map(destination => ({
                    ...stock, id: destination.id, href: destination.href, translationKey: destination.labelKey,
                    active: (pathname: string) => resolveStockKind(pathname) === destination.id,
                })) : []),
                ...byIds(['dispatches']),
            ],
        },
        { id: 'workforce', translationKey: 'navigation.sections.workforce', destinations: byIds(['workers', 'payroll']) },
    ]
    const visibleGroups = groups.filter(group => group.destinations.length > 0)
    return {
        primary: visibleGroups.map(group => ({
            ...group.destinations[0],
            id: group.id,
            translationKey: group.translationKey,
            active: (pathname: string) => group.destinations.some(destination => destination.active(pathname, destination.href)),
        })),
        groups: visibleGroups,
    }
}

export function currentMobileWorkflow(groups: MobileWorkflowGroup[], pathname: string) {
    return groups.find(group => group.destinations.some(destination => destination.active(pathname, destination.href))) ?? null
}
