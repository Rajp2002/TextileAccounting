'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { BellRing, ChevronRight } from 'lucide-react'
import { NavigationLink } from './navigation-link'
import { useTranslation } from '@/lib/i18n/context'
import { isCurrentNavigationPage, type NavigationGroup } from '@/lib/disclosure-navigation'
import { cn } from '@/lib/utils'

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

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

    // Keep the submenu rendered for its 160ms closing animation. The state is
    // adjusted during render when `expanded` changes, so no extra render pass
    // shows the list hidden before the animation starts.
    const [isClosing, setIsClosing] = useState(false)
    const [prevExpanded, setPrevExpanded] = useState(expanded)
    if (prevExpanded !== expanded) {
        setPrevExpanded(expanded)
        setIsClosing(!expanded && !prefersReducedMotion())
    }

    useEffect(() => {
        if (!isClosing) return
        const timer = setTimeout(() => setIsClosing(false), 160)
        return () => clearTimeout(timer)
    }, [isClosing])

    const collapse = () => { trigger.current?.focus(); onCollapse() }

    return (
        <li
            data-navigation-disclosure={group.id}
            onKeyDown={event => {
                if (event.key === 'Escape' && expanded && !event.defaultPrevented) {
                    event.preventDefault()
                    event.stopPropagation()
                    collapse()
                }
            }}
        >
            <button
                ref={trigger}
                type="button"
                data-nav-id={group.id}
                aria-expanded={expanded}
                aria-controls={id}
                onClick={onToggle}
                className={cn(
                    'group relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wv-brand-accent)]',
                    active
                        ? 'bg-[var(--wv-neel-700)] text-[var(--wv-neel-50)] shadow-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2.5px] before:rounded-r before:bg-[var(--wv-brand-accent)]'
                        : 'text-[var(--wv-neel-300)] hover:bg-[var(--wv-bg-inverse-raised)] hover:text-[var(--wv-neel-50)]'
                )}
            >
                <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                <span className="min-w-0 flex-1 break-words">{t(group.translationKey)}</span>
                <ChevronRight
                    aria-hidden="true"
                    className={cn(
                        'nav-chevron h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none',
                        expanded ? 'rotate-90' : 'rotate-0',
                        active ? 'text-[var(--wv-neel-50)]/90' : 'text-[var(--wv-neel-300)] group-hover:text-[var(--wv-neel-50)]'
                    )}
                />
            </button>
            <div
                className="submenu-wrapper"
                data-open={expanded ? 'true' : 'false'}
                inert={!expanded ? true : undefined}
            >
                <div className="submenu-inner">
                    <ul
                        id={id}
                        hidden={!expanded && !isClosing}
                        className="submenu-content relative ml-5 mt-1 space-y-1 pl-3"
                    >
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute bottom-1.5 left-0 top-1.5 w-[2.5px] rounded-full bg-[var(--wv-brand-accent)]"
                        />
                        {group.children.map(destination => (
                            <li key={destination.id}>
                                <NavigationLink
                                    prefetch={false}
                                    href={destination.href}
                                    data-nav-id={destination.id}
                                    aria-current={
                                        isCurrentNavigationPage(pathname, destination.href)
                                            ? 'page'
                                            : destination.active(pathname, destination.href)
                                                ? 'location'
                                                : undefined
                                    }
                                    onClick={event => {
                                        if (
                                            event.defaultPrevented ||
                                            event.button !== 0 ||
                                            event.metaKey ||
                                            event.ctrlKey ||
                                            event.shiftKey ||
                                            event.altKey
                                        ) return
                                        // Listing filters belong to the current page and must survive re-selection.
                                        if (isCurrentNavigationPage(pathname, destination.href)) {
                                            event.preventDefault()
                                            collapse()
                                            onCurrentDestination?.()
                                        } else {
                                            onNavigate()
                                        }
                                    }}
                                    className={cn(
                                        'relative flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors duration-120 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wv-brand-accent)]',
                                        destination.active(pathname, destination.href)
                                            ? 'bg-[var(--wv-neel-700)] font-semibold text-[var(--wv-neel-50)] shadow-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-r before:bg-[var(--wv-brand-accent)]'
                                            : 'text-[var(--wv-neel-300)] hover:bg-[var(--wv-bg-inverse-raised)] hover:text-[var(--wv-neel-50)]'
                                    )}
                                >
                                    <span className="min-w-0 break-words">{t(destination.translationKey)}</span>
                                    {destination.id === 'rates' && yarnReviewDueCount > 0 && (
                                        <span className="ml-auto flex items-center gap-1 text-xs">
                                            <BellRing aria-hidden="true" className="h-4 w-4" />
                                            <span>{yarnReviewDueCount > 99 ? '99+' : yarnReviewDueCount}</span>
                                        </span>
                                    )}
                                </NavigationLink>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </li>
    )
}

