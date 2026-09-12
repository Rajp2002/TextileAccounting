'use client'

import { useId, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { BellRing, Check, ChevronRight } from 'lucide-react'
import { NavigationLink } from './navigation-link'
import { useTranslation } from '@/lib/i18n/context'
import { isCurrentNavigationPage, type NavigationGroup } from '@/lib/disclosure-navigation'
import { cn } from '@/lib/utils'

export function NavigationDisclosure({ group, expanded, onToggle, onCollapse, onCurrentDestination, onNavigate, yarnReviewDueCount = 0 }: {
    group: NavigationGroup; expanded: boolean; onToggle: () => void; onCollapse: () => void;
    onCurrentDestination?: () => void; onNavigate: () => void; yarnReviewDueCount?: number
}) {
    const pathname = usePathname()
    const { t } = useTranslation()
    const id = useId()
    const trigger = useRef<HTMLButtonElement>(null)
    const active = group.children.some(child => child.active(pathname, child.href))
    const Icon = group.icon
    const collapse = () => { trigger.current?.focus(); onCollapse() }
    return <li data-navigation-disclosure={group.id} onKeyDown={event => {
        if (event.key === 'Escape' && expanded && !event.defaultPrevented) {
            event.preventDefault(); event.stopPropagation(); collapse()
        }
    }}>
        <button ref={trigger} type="button" data-nav-id={group.id} aria-expanded={expanded} aria-controls={id}
            onClick={onToggle}
            className={cn('flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron', active ? 'bg-saffron-deep text-white shadow-sm' : 'text-zinc-300 hover:bg-white/10 hover:text-white')}>
            <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
            <span className="min-w-0 break-words">{t(group.translationKey)}</span>
            <ChevronRight aria-hidden="true" className={cn('ml-auto h-4 w-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none', expanded && 'rotate-90')} />
        </button>
        <ul id={id} hidden={!expanded} className="ml-6 mt-1 space-y-1">
            {group.children.map(destination => <li key={destination.id}>
                <NavigationLink prefetch={false} href={destination.href} data-nav-id={destination.id} aria-current={isCurrentNavigationPage(pathname, destination.href) ? 'page' : destination.active(pathname, destination.href) ? 'location' : undefined}
                    onClick={event => {
                        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                        // Listing filters belong to the current page and must survive re-selection.
                        if (isCurrentNavigationPage(pathname, destination.href)) { event.preventDefault(); collapse(); onCurrentDestination?.() }
                        else onNavigate()
                    }}
                    className={cn('flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron', destination.active(pathname, destination.href) ? 'bg-white/10 font-semibold text-white' : 'text-zinc-300 hover:bg-white/10 hover:text-white')}>
                    <span className="min-w-0 break-words">{t(destination.translationKey)}</span>
                    {destination.id === 'rates' && yarnReviewDueCount > 0 && <span className="ml-auto flex items-center gap-1 text-xs"><BellRing aria-hidden="true" className="h-4 w-4" /><span>{yarnReviewDueCount > 99 ? '99+' : yarnReviewDueCount}</span></span>}
                    {destination.active(pathname, destination.href) && <Check aria-hidden="true" className="ml-auto h-4 w-4 shrink-0" />}
                </NavigationLink>
            </li>)}
        </ul>
    </li>
}
