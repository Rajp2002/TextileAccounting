'use client'
import { useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { BellRing, Factory, Menu } from 'lucide-react'
import { NavigationLink } from './navigation-link'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetHeader, SheetTrigger } from '@/components/ui/sheet'
import LogoutButton from '@/components/auth/logout-button'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { useTranslation } from '@/lib/i18n/context'
import { useMobileKeyboard } from '@/hooks/use-mobile-keyboard'
import { normalizeProductionMode, type ProductionMode } from '@/lib/production-mode'
import { type SubscriptionTier } from '@/lib/subscription-access'
import { visibleOwnerNavigation } from '@/lib/owner-navigation'
import { cn } from '@/lib/utils'

interface OwnerSidebarProps {
 factoryName?: string; userName?: string; productionMode?: ProductionMode | null;
 subscriptionTier?: SubscriptionTier; yarnReviewDueCount?: number
}
function NavContent({ factoryName, userName, productionMode, subscriptionTier = 'none', yarnReviewDueCount = 0 }: OwnerSidebarProps) {
 const id = useId()
 const pathname = usePathname()
 const { t } = useTranslation()
 const groups = visibleOwnerNavigation({ tier: subscriptionTier, productionMode: normalizeProductionMode(productionMode) })
 const renderItems = (items: typeof groups[number]['items']) => <ul className="space-y-1">{items.map(item => {
  const Icon = item.icon
  const active = item.active(pathname, item.href)
  return <li key={item.id}><NavigationLink data-nav-id={item.id} href={item.href} aria-current={active ? (pathname === item.href.split('?')[0] ? 'page' : 'location') : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron motion-reduce:transition-none', active ? 'bg-saffron-deep text-white shadow-sm' : 'text-zinc-300 hover:bg-white/10 hover:text-white')}><Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" /><span className="min-w-0 break-words">{t(item.translationKey)}</span>{item.id === 'rates' && yarnReviewDueCount > 0 && <span className="ml-auto flex items-center gap-1 text-xs" aria-label={`${yarnReviewDueCount} yarn rates due for review`}><BellRing aria-hidden="true" className="h-4 w-4" />{yarnReviewDueCount > 99 ? '99+' : yarnReviewDueCount}</span>}</NavigationLink></li>
 })}</ul>
 return <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#111111] text-zinc-100">
  <div className="shrink-0 border-b border-white/10 px-4 py-4 pt-safe"><div className="relative mx-auto h-20 w-44"><Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill sizes="11rem" className="object-contain" priority /></div>{factoryName && <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/[0.06] p-3"><Factory aria-hidden="true" className="h-4 w-4 shrink-0 text-saffron" /><p data-i18n-skip="true" className="min-w-0 break-words text-sm font-semibold">{factoryName}</p><span data-i18n-skip="true" className="ml-auto rounded bg-white/10 px-2 py-1 text-xs capitalize">{subscriptionTier}</span></div>}</div>
  <nav aria-label={t('common.navigation')} className="min-h-24 flex-1 space-y-5 overflow-y-auto px-3 py-4">{groups.filter(group => group.id !== 'utilities').map(group => <section key={group.id} aria-labelledby={`${id}-nav-${group.id}`}><h2 id={`${id}-nav-${group.id}`} className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{t(group.translationKey)}</h2>{renderItems(group.items)}</section>)}</nav>
  <div className="shrink-0 border-t border-white/10 px-3 py-3 pb-safe"><nav aria-label={t('navigation.sections.utilities')}>{renderItems(groups.find(group => group.id === 'utilities')?.items ?? [])}</nav><div className="mt-2 flex flex-col gap-2"><LanguageSwitcher className="min-h-11 text-zinc-300 hover:bg-white/10" />{userName && <p data-i18n-skip="true" className="break-words px-3 text-xs text-zinc-400">{userName}</p>}<LogoutButton className="min-h-11 rounded-lg px-3 text-zinc-300 hover:bg-white/10" /></div></div>
 </div>
}
export function OwnerSidebar(props: OwnerSidebarProps) {
 const [isOpen, setIsOpen] = useState(false)
 const mobileKeyboardVisible = useMobileKeyboard()
 const pathname = usePathname()
 const previousPath = useRef(pathname)
 const navigated = useRef(false)
 const { t } = useTranslation()
 // Close only after the router commits a new destination. Cancelled transitions keep the drawer open.
 useEffect(() => {
  if (previousPath.current === pathname) return
  previousPath.current = pathname
  if (isOpen) {
   navigated.current = true
   const frame = requestAnimationFrame(() => setIsOpen(false))
   return () => cancelAnimationFrame(frame)
  }
 }, [pathname, isOpen])
 const quickLinks = visibleOwnerNavigation({ tier: props.subscriptionTier ?? 'none', productionMode: normalizeProductionMode(props.productionMode) }).filter(group => group.id !== 'utilities').flatMap(group => group.items).slice(0, 4)
 return <>
  <aside className="hidden border-r border-white/10 bg-[#111111] md:fixed md:inset-y-0 md:z-30 md:flex md:w-[248px] md:flex-col"><NavContent {...props} /></aside>
  <Sheet open={isOpen} onOpenChange={setIsOpen}>
   <SheetContent side="left" className="w-[min(280px,90vw)] border-white/10 bg-[#111111] p-0" onCloseAutoFocus={event => {
    if (!navigated.current) return
    event.preventDefault(); navigated.current = false
    const main = document.querySelector<HTMLElement>('main'); if (main) { main.tabIndex = -1; main.focus() }
   }}><SheetHeader className="sr-only"><SheetTitle>{t('common.navigation')}</SheetTitle><SheetDescription>{t('navigation.sections.utilities')}</SheetDescription></SheetHeader><NavContent {...props} /></SheetContent>
   <div style={mobileKeyboardVisible ? { display: 'none' } : undefined} className="fixed inset-x-0 bottom-0 z-30 grid auto-cols-fr grid-flow-col items-stretch border-t border-border bg-canvas/95 pb-safe pt-2 md:hidden">{quickLinks.map(item => {
    const Icon = item.icon; const active = item.active(pathname, item.href)
    return <NavigationLink key={item.id} href={item.href} aria-current={active ? 'page' : undefined} className={cn('flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center focus-visible:outline-2 focus-visible:outline-saffron', active ? 'bg-saffron-soft text-saffron-deep' : 'text-body')}><Icon aria-hidden="true" className="h-5 w-5 shrink-0" /><span className="break-words text-[10px] leading-snug">{t(item.translationKey)}</span></NavigationLink>
   })}<SheetTrigger asChild><button type="button" aria-label={t('common.navigation')} className="flex min-h-11 flex-col items-center justify-center gap-1 px-1 py-2 text-body focus-visible:outline-2 focus-visible:outline-saffron"><Menu aria-hidden="true" className="h-5 w-5" /><span className="text-[10px]">{t('common.navigation')}</span></button></SheetTrigger></div>
  </Sheet>
 </>
}
