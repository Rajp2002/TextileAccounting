import type { SubscriptionTier } from './subscription-access'
import { Calculator, Users } from 'lucide-react'
import { visibleOwnerNavigation, type OwnerNavigationItem } from './owner-navigation'
import { resolveStockKind, stockDestinations } from './stock-navigation'

export type NavigationDestination = OwnerNavigationItem & { href: string }
export type DisclosureId = 'costing' | 'stock' | 'workforce'
export type NavigationGroup = {
    kind: 'group'; id: DisclosureId; translationKey: string;
    icon: OwnerNavigationItem['icon']; children: NavigationDestination[]
}
export type NavigationNode = NavigationGroup | (NavigationDestination & { kind: 'link' })
type Sections = ReturnType<typeof visibleOwnerNavigation>

/** Presentation only: inputs have already passed the existing access policy. */
// Product presentation scope, not an authorization decision. Feature grants remain upstream.
export function usesCollapsibleNavigation(tier: SubscriptionTier) { return tier === 'base' }
export function groupOwnerNavigation(sections: Sections, tier: SubscriptionTier) {
    if (!usesCollapsibleNavigation(tier)) return sections.map(section => ({
        ...section, nodes: section.items.map(item => ({ ...item, kind: 'link' as const })), showHeading: true,
    }))
    return sections.map(section => {
        let nodes: NavigationNode[] = section.items.map(item => ({ ...item, kind: 'link' as const }))
        if (section.id === 'costing') {
            const children = ['estimate', 'rates', 'costings'].flatMap(id => section.items.filter(item => item.id === id))
            if (children.length && !(children.length === 1 && children[0].id === 'estimate')) {
                nodes = [{ kind: 'group', id: 'costing', translationKey: 'navigation.sections.costing', icon: Calculator, children }]
            }
        } else if (section.id === 'workforce') {
            const children = ['workers', 'payroll'].flatMap(id => section.items.filter(item => item.id === id))
            nodes = [
                ...(children.length ? [{ kind: 'group' as const, id: 'workforce' as const, translationKey: 'navigation.sections.workforce', icon: Users, children }] : []),
                ...nodes.filter(item => item.id !== 'workers' && item.id !== 'payroll'),
            ]
        } else if (section.id === 'production_stock') {
            nodes = nodes.map(item => item.id !== 'stock' || item.kind !== 'link' ? item : {
                kind: 'group', id: 'stock', translationKey: 'navigation.stock', icon: item.icon,
                children: stockDestinations.map(destination => ({
                    ...item, id: destination.id, href: destination.href, translationKey: destination.labelKey,
                    active: pathname => resolveStockKind(pathname) === destination.id,
                })),
            })
        }
        return { ...section, nodes, showHeading: section.id !== 'costing' && section.id !== 'workforce' }
    })
}

/** All grouped destinations use distinct paths. Query parameters are existing page state. */
export function isCurrentNavigationPage(pathname: string, href: string) {
    return pathname.replace(/\/$/, '') === href.split(/[?#]/)[0].replace(/\/$/, '')
}

export type DisclosureState = { location: string; scope: string; expanded: DisclosureId | null }
export function resolveDisclosureState(state: DisclosureState, location: string, scope: string): DisclosureState {
    return state.location === location && state.scope === scope ? state : { location, scope, expanded: null }
}
export function toggleDisclosure(state: DisclosureState, id: DisclosureId): DisclosureState {
    return { ...state, expanded: state.expanded === id ? null : id }
}
