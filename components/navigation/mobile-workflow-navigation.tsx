'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { NavigationLink } from './navigation-link'
import { useNavigationPathname } from '@/hooks/use-navigation-pathname'
import { useTranslation } from '@/lib/i18n/context'
import { isCurrentNavigationPage } from '@/lib/disclosure-navigation'
import { getMobileWorkflowNavigation, currentMobileWorkflow } from '@/lib/mobile-workflow-navigation'
import { visibleOwnerNavigation } from '@/lib/owner-navigation'
import { normalizeProductionMode, type ProductionMode } from '@/lib/production-mode'
import type { SubscriptionTier } from '@/lib/subscription-access'
import { cn } from '@/lib/utils'

export function MobileWorkflowNavigation({ tier, productionMode }: { tier: SubscriptionTier; productionMode: ProductionMode | null }) {
    const pathname = usePathname()
    // A tapped tab or pill shows its section at once, before its page arrives.
    const shownPath = useNavigationPathname()
    const { t } = useTranslation()
    const scroller = useRef<HTMLUListElement>(null)
    const model = getMobileWorkflowNavigation(visibleOwnerNavigation({ tier, productionMode: normalizeProductionMode(productionMode) }), tier)
    const group = currentMobileWorkflow(model.groups, shownPath)

    useEffect(() => {
        const list = scroller.current
        const active = list?.querySelector<HTMLElement>('[aria-current]')
        if (!list || !active) return
        // Reveal the current link after navigation, translation or rotation
        // without moving the document's scroll position.
        const revealCurrent = () => {
            const listBounds = list.getBoundingClientRect()
            const activeBounds = active.getBoundingClientRect()
            if (activeBounds.left < listBounds.left) list.scrollLeft -= listBounds.left - activeBounds.left
            else if (activeBounds.right > listBounds.right) list.scrollLeft += activeBounds.right - listBounds.right
        }
        revealCurrent()
        const observer = new ResizeObserver(revealCurrent)
        observer.observe(list)
        observer.observe(active)
        return () => observer.disconnect()
    }, [shownPath, t, tier])

    if (!group) return null
    return (
        <nav className="mobile-workflow-navigation mb-3 min-w-0" aria-label={`${t(group.translationKey)} · ${t('common.navigation')}`}>
            <ul ref={scroller} className="flex min-w-0 gap-1 overflow-x-auto border-b border-hairline pb-1">
                {group.destinations.map(destination => {
                    const active = destination.active(shownPath, destination.href)
                    return (
                        <li key={destination.id} className="shrink-0">
                            <NavigationLink
                                href={destination.href}
                                aria-current={active ? (isCurrentNavigationPage(shownPath, destination.href) ? 'page' : 'location') : undefined}
                                onClick={event => {
                                    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && isCurrentNavigationPage(pathname, destination.href)) event.preventDefault()
                                }}
                                className={cn(
                                    'mobile-workflow-link flex min-h-[44px] max-w-[12rem] items-center justify-center rounded-lg px-3 py-2 text-center text-sm leading-snug whitespace-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                                    active ? 'bg-ink font-semibold text-surface' : 'text-muted-foreground hover:bg-surface-soft hover:text-ink'
                                )}
                            >
                                {t(destination.translationKey)}
                            </NavigationLink>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}
