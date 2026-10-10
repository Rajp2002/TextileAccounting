'use client'
import { useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useNavigationPathname } from '@/hooks/use-navigation-pathname'
import { BellRing, Factory, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavigationDisclosure } from './navigation-disclosure'
import { groupOwnerNavigation, usesCollapsibleNavigation, isCurrentNavigationPage, resolveDisclosureState, toggleDisclosure, type DisclosureState, type NavigationNode } from '@/lib/disclosure-navigation'
import { NavigationLink } from './navigation-link'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetHeader, SheetTrigger } from '@/components/ui/sheet'
import { PwaUpdateAction } from '@/components/pwa-update-action'
import LogoutButton from '@/components/auth/logout-button'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { useTranslation } from '@/lib/i18n/context'
import { MobileNavigation, MobileNavigationLabel } from './mobile-navigation'
import { normalizeProductionMode, type ProductionMode } from '@/lib/production-mode'
import { type SubscriptionTier } from '@/lib/subscription-access'
import { visibleOwnerNavigation } from '@/lib/owner-navigation'
import { getMobileWorkflowNavigation, MOBILE_WORKSPACE_QUERY } from '@/lib/mobile-workflow-navigation'
import { cn } from '@/lib/utils'
import { nextSidebarPreference, parseSidebarPreference, sidebarPreferenceCookie, SIDEBAR_RAIL_DEFAULT_QUERY, SIDEBAR_RAIL_THRESHOLD } from '@/lib/sidebar-preference'

interface OwnerSidebarProps {
 factoryName?: string; userName?: string; productionMode?: ProductionMode | null;
 subscriptionTier?: SubscriptionTier; yarnReviewDueCount?: number
}
function NavContent({ factoryName, userName, productionMode, subscriptionTier = 'none', yarnReviewDueCount = 0, onCurrentDestination, onDestination, onToggleWidth, prefetchDestinations = false }: OwnerSidebarProps & { onCurrentDestination?: () => void; onDestination?: () => void; onToggleWidth?: () => void; prefetchDestinations?: boolean }) {
 const id = useId()
 const pathname = usePathname()
 // Selection follows a tapped destination at once; disclosure state follows the committed page.
 const shownPath = useNavigationPathname()
 const { t } = useTranslation()
 const groups = groupOwnerNavigation(visibleOwnerNavigation({ tier: subscriptionTier, productionMode: normalizeProductionMode(productionMode) }), subscriptionTier)
 const scope = `${subscriptionTier}:${productionMode}:${factoryName}:${userName}`
 const [storedState, setState] = useState<DisclosureState>({ location: pathname, scope, expanded: null })
 const state = resolveDisclosureState(storedState, pathname, scope)
 if (state !== storedState) setState(state)
 const pendingFocus = useRef(false)
 useEffect(() => {
  if (!pendingFocus.current) return
  pendingFocus.current = false
  const main = document.querySelector<HTMLElement>('main')
  if (main) { main.tabIndex = -1; main.focus() }
 }, [pathname])
 useEffect(() => {
  const media = window.matchMedia(MOBILE_WORKSPACE_QUERY)
  const reset = () => setState(current => ({ ...current, expanded: null }))
  media.addEventListener('change', reset)
  return () => media.removeEventListener('change', reset)
 }, [])
 const renderItems = (items: NavigationNode[]) => <ul className="space-y-1">{items.map(item => {
  if (item.kind === 'group') return <NavigationDisclosure key={item.id} group={item} expanded={state.expanded === item.id} onToggle={() => setState(toggleDisclosure(state, item.id))} onCollapse={() => setState({ ...state, expanded: null })} onCurrentDestination={onCurrentDestination} onNavigate={() => { pendingFocus.current = true; onDestination?.() }} prefetchDestinations={prefetchDestinations} yarnReviewDueCount={yarnReviewDueCount} />
  const Icon = item.icon
  const active = item.active(shownPath, item.href)
  return <li key={item.id}><NavigationLink data-nav-id={item.id} href={item.href} onClick={event => {
   if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
   if (isCurrentNavigationPage(pathname, item.href)) {
    if (usesCollapsibleNavigation(subscriptionTier) && item.id === 'estimate') event.preventDefault()
    onCurrentDestination?.()
   } else onDestination?.()
  }} aria-current={active ? (shownPath === item.href.split('?')[0] ? 'page' : 'location') : undefined} className={cn('relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wv-brand-accent)]', active ? 'ui-nav-mark bg-[var(--wv-neel-700)] text-[var(--wv-neel-50)] shadow-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2.5px] before:rounded-r before:bg-[var(--wv-brand-accent)]' : 'text-[var(--wv-neel-300)] hover:bg-[var(--wv-bg-inverse-raised)] hover:text-[var(--wv-neel-50)]')}><Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" /><span data-nav-label className="min-w-0 break-words">{t(item.translationKey)}</span>{item.id === 'rates' && yarnReviewDueCount > 0 && <span data-nav-badge className="ml-auto flex items-center gap-1 text-xs" aria-label={`${yarnReviewDueCount} yarn rates due for review`}><BellRing aria-hidden="true" className="h-4 w-4" />{yarnReviewDueCount > 99 ? '99+' : yarnReviewDueCount}</span>}</NavigationLink></li>
 })}</ul>
 return <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[var(--wv-bg-inverse)] text-[var(--wv-neel-50)]">
  <div className="navigation-brand relative shrink-0 border-b border-white/10 px-4 py-4 pt-safe"><div data-nav-full-only className="relative mx-auto h-20 w-44"><Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill sizes="11rem" className="object-contain" priority /></div>{onToggleWidth && <span data-nav-rail-only aria-hidden="true" className="navigation-rail-mark" />}{onToggleWidth && <button type="button" data-sidebar-toggle onClick={onToggleWidth} className="navigation-width-toggle mobile-touch-target flex h-10 w-10 items-center justify-center rounded-lg text-[var(--wv-neel-300)] transition-colors duration-150 hover:bg-[var(--wv-bg-inverse-raised)] hover:text-[var(--wv-neel-50)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wv-brand-accent)] motion-reduce:transition-none"><PanelLeftClose data-nav-full-only aria-hidden="true" className="h-[18px] w-[18px]" /><PanelLeftOpen data-nav-rail-only aria-hidden="true" className="h-[18px] w-[18px]" /><span data-nav-full-only className="sr-only">{t('navigation.collapse_menu')}</span><span data-nav-rail-only className="sr-only">{t('navigation.expand_menu')}</span></button>}{factoryName && <div data-nav-full-only className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--wv-bg-inverse-raised)] border border-white/10 p-3"><Factory aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--wv-brand-accent)]" /><p data-i18n-skip="true" className="min-w-0 break-words text-sm font-semibold text-[var(--wv-neel-50)]">{factoryName}</p><span data-i18n-skip="true" className="ml-auto rounded bg-white/10 px-2 py-1 text-xs font-medium text-[var(--wv-neel-200)] capitalize">{subscriptionTier}</span></div>}</div>
  <nav data-nav-sections aria-label={t('common.navigation')} className="min-h-24 flex-1 space-y-5 overflow-y-auto px-3 py-4">{groups.filter(group => group.id !== 'utilities').map(group => <section key={group.id} aria-labelledby={group.showHeading ? `${id}-nav-${group.id}` : undefined}>{group.showHeading && <h2 data-nav-full-only id={`${id}-nav-${group.id}`} className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--wv-neel-500)]">{t(group.translationKey)}</h2>}{renderItems(group.nodes)}</section>)}</nav>
  <div className="shrink-0 border-t border-white/10 px-3 py-3 pb-safe"><nav aria-label={t('navigation.sections.utilities')}>{renderItems(groups.find(group => group.id === 'utilities')?.nodes ?? [])}</nav><div className="mt-2 flex flex-col gap-2"><div data-nav-full-only><LanguageSwitcher className="min-h-11 text-[var(--wv-neel-300)] hover:bg-[var(--wv-bg-inverse-raised)] hover:text-[var(--wv-neel-50)]" /></div>{userName && <p data-nav-full-only data-i18n-skip="true" className="break-words px-3 text-xs text-[var(--wv-neel-300)]/70">{userName}</p>}<div data-nav-compact className="empty:hidden"><PwaUpdateAction className="text-[var(--wv-neel-300)] hover:bg-[var(--wv-bg-inverse-raised)] hover:text-[var(--wv-neel-50)]" /></div><div data-nav-compact><LogoutButton className="min-h-11 rounded-lg px-3 text-[var(--wv-neel-300)] hover:bg-[var(--wv-bg-inverse-raised)] hover:text-[var(--wv-neel-50)]" /></div></div></div>
 </div>
}
export function OwnerSidebar(props: OwnerSidebarProps) {
 const [isOpen, setIsOpen] = useState(false)
 const pathname = usePathname()
 const shownPath = useNavigationPathname()
 const previousPath = useRef(pathname)
 const navigated = useRef(false)
 const { t } = useTranslation()
 // A tapped destination closes the drawer at once (onDestination below) while its page loads
 // underneath. Any other change of page while the drawer is open closes it too.
 useEffect(() => {
  if (previousPath.current === pathname) return
  previousPath.current = pathname
  if (isOpen) {
   navigated.current = true
   const frame = requestAnimationFrame(() => setIsOpen(false))
   return () => cancelAnimationFrame(frame)
  }
 }, [pathname, isOpen])
 useEffect(() => {
  const media = window.matchMedia(MOBILE_WORKSPACE_QUERY)
  const dismissOnDesktop = () => { if (!media.matches) setIsOpen(false) }
  media.addEventListener('change', dismissOnDesktop)
  return () => media.removeEventListener('change', dismissOnDesktop)
 }, [])
 const sidebar = useRef<HTMLElement>(null)
 const [peeking, setPeeking] = useState(false)
 const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
 // The rail opens over the page (it never pushes it) while a pointer rests on it, keyboard focus is
 // inside it, or a group is tapped; it closes again on leaving, Escape, an outside tap or a new page.
 const isRail = () => Boolean(sidebar.current && sidebar.current.offsetWidth < SIDEBAR_RAIL_THRESHOLD)
 const clearHoverTimer = () => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null } }
 const [peekPath, setPeekPath] = useState(pathname)
 if (peekPath !== pathname) { setPeekPath(pathname); if (peeking) setPeeking(false) }
 useEffect(() => {
  if (!peeking) return
  const outside = (event: PointerEvent) => { if (!sidebar.current?.contains(event.target as Node)) setPeeking(false) }
  document.addEventListener('pointerdown', outside)
  return () => document.removeEventListener('pointerdown', outside)
 }, [peeking])
 useEffect(() => {
  const timer = hoverTimer
  return () => { if (timer.current) clearTimeout(timer.current) }
 }, [])
 const toggleWidth = () => {
  const shell = sidebar.current?.closest<HTMLElement>('[data-workspace-shell]')
  if (!shell) return
  const next = nextSidebarPreference(parseSidebarPreference(shell.dataset.sidebarPreference), window.matchMedia(SIDEBAR_RAIL_DEFAULT_QUERY).matches)
  shell.dataset.sidebarPreference = next
  document.cookie = sidebarPreferenceCookie(next)
  clearHoverTimer()
  setPeeking(false)
  // Docked page widgets measure the content column on resize; let the width transition finish first.
  setTimeout(() => window.dispatchEvent(new Event('resize')), 200)
 }
 const quickLinks = getMobileWorkflowNavigation(visibleOwnerNavigation({ tier: props.subscriptionTier ?? 'none', productionMode: normalizeProductionMode(props.productionMode) }), props.subscriptionTier ?? 'none').primary
 const quickLinkActive = quickLinks.some(item => item.active(shownPath, item.href))
 return <>
  <aside ref={sidebar} data-workspace-sidebar="true" data-peek={peeking || undefined}
   onPointerEnter={event => {
    if (event.pointerType !== 'mouse' || peeking || !isRail()) return
    clearHoverTimer()
    hoverTimer.current = setTimeout(() => setPeeking(true), 180)
   }}
   onPointerLeave={event => {
    if (event.pointerType !== 'mouse') return
    clearHoverTimer()
    if (!sidebar.current?.contains(document.activeElement) || !sidebar.current.querySelector(':focus-visible')) setPeeking(false)
   }}
   onFocus={event => { if (!peeking && isRail() && event.target.matches(':focus-visible')) setPeeking(true) }}
   onBlur={event => { if (!sidebar.current?.contains(event.relatedTarget as Node | null) && !sidebar.current?.matches(':hover')) setPeeking(false) }}
   onClickCapture={event => {
    const target = event.target as HTMLElement
    if (target.closest('[data-sidebar-toggle]')) return
    if (target.closest('[data-navigation-disclosure] > button')) { if (!peeking && isRail()) setPeeking(true) }
    else if (target.closest('a')) { clearHoverTimer(); setPeeking(false) }
   }}
   onKeyDown={event => { if (event.key === 'Escape' && peeking && !event.defaultPrevented) { event.preventDefault(); setPeeking(false) } }}
   className="workspace-sidebar hidden border-r border-white/10 bg-[var(--wv-bg-inverse)] md:fixed md:inset-y-0 md:z-30 md:flex md:flex-col"><NavContent {...props} onToggleWidth={toggleWidth} /></aside>
  <Sheet open={isOpen} onOpenChange={setIsOpen}>
   <SheetContent data-navigation-drawer="true" onEscapeKeyDown={event => {
    const group = document.activeElement?.closest('[data-navigation-disclosure]')
    const trigger = group?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')
    if (trigger) { event.preventDefault(); trigger.focus(); trigger.click() }
   }} side="left" className="w-[min(280px,90vw)] border-white/10 bg-[var(--wv-bg-inverse)] p-0" onCloseAutoFocus={event => {
    if (!navigated.current) return
    event.preventDefault(); navigated.current = false
    const main = document.querySelector<HTMLElement>('main'); if (main) { main.tabIndex = -1; main.focus() }
   }}><SheetHeader className="sr-only"><SheetTitle>{t('common.navigation')}</SheetTitle><SheetDescription>{t('navigation.sections.utilities')}</SheetDescription></SheetHeader><NavContent {...props} prefetchDestinations onCurrentDestination={() => setIsOpen(false)} onDestination={() => { navigated.current = true; setIsOpen(false) }} /></SheetContent>
   <MobileNavigation aria-label={t('common.navigation')}>
    {quickLinks.map(item => {
     const active = item.active(shownPath, item.href)
     return <NavigationLink key={item.id} href={item.href} onClick={event => {
      if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && isCurrentNavigationPage(pathname, item.href)) event.preventDefault()
     }} aria-current={active ? (isCurrentNavigationPage(shownPath, item.href) ? 'page' : 'location') : undefined} data-active={active && !isOpen} className="mobile-navigation-item"><MobileNavigationLabel icon={item.icon} label={t(item.translationKey)} /></NavigationLink>
    })}
    <SheetTrigger asChild><button type="button" aria-label={t('common.more')} data-active={isOpen || !quickLinkActive} className="mobile-navigation-item"><MobileNavigationLabel icon={Menu} label={t('common.more')} /></button></SheetTrigger>
   </MobileNavigation>
  </Sheet>
 </>
}
