import type { SubscriptionTier } from './subscription-access'
import { Calculator, Users } from 'lucide-react'
import { visibleOwnerNavigation, type OwnerNavigationItem } from './owner-navigation'

export type NavigationDestination = OwnerNavigationItem & { href: string }
export type DisclosureId = 'costing' | 'production' | 'workforce'
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
    return sections.map(section => {
        let nodes: NavigationNode[] = section.items.map(item => ({ ...item, kind: 'link' as const }))
        nodes = nodes.map(item => item.id !== 'production' || item.kind !== 'link' ? item : {
            kind: 'group', id: 'production', translationKey: 'navigation.production', icon: item.icon,
            children: [
                { ...item, id: 'production_overview', name: 'Overview', href: '/owner/production', translationKey: 'navigation.production_overview', active: pathname => pathname === '/owner/production' },
                { ...item, id: 'production_daily_sheet', name: 'Daily Sheet', href: '/owner/production/daily-sheet', translationKey: 'navigation.production_daily_sheet', active: pathname => pathname === '/owner/production/daily-sheet' },
            ],
        })
        if (!usesCollapsibleNavigation(tier)) return { ...section, nodes, showHeading: true }
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
