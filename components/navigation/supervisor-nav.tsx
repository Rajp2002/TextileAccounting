"use client"

import { NavigationLink } from "@/components/navigation/navigation-link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { MobileNavigation, MobileNavigationLabel } from "./mobile-navigation"
import {
    ClipboardList,
    Users,
    Settings,
    Calendar,
    Menu,
    Factory,
} from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetHeader, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useRef } from "react"
import LogoutButton from "@/components/auth/logout-button"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { useTranslation } from "@/lib/i18n/context"
import { DownloadCloud } from "lucide-react"

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// ─── Nav item definitions ────────────────────────────────────────────────────

const primaryNavItems = [
    { name: "Production Log", href: "/supervisor/dashboard",  icon: ClipboardList,  translationKey: "production_log" },
    { name: "Workers",        href: "/supervisor/workers",     icon: Users,           translationKey: "workers"     },
    { name: "Attendance",     href: "/supervisor/attendance",  icon: Calendar,        translationKey: "attendance"  },
]

const secondaryNavItems = [
    { name: "Looms", href: "/supervisor/machines", icon: Settings, translationKey: "machines" },
]

// Bottom nav keeps the Phase 1 floor workflow one tap away.
const bottomNavItems = primaryNavItems

// ─── Supervisor Role Label ────────────────────────────────────────────────────

export function SupervisorRoleLabel() {
    const { t } = useTranslation()
    return (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-saffron-deep">
            {t("common.supervisor")}
        </span>
    )
}

// ─── Shared sidebar nav content ───────────────────────────────────────────────

interface SupervisorSidebarProps {
    factoryName?: string
    userName?: string
}

function NavContent({ factoryName, userName, onLinkClick }: SupervisorSidebarProps & { onLinkClick?: () => void }) {
    const pathname = usePathname()
    const { t } = useTranslation()

    return (
        <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#111111] text-zinc-100">
            {/* Branding — extra top padding on iOS standalone for Dynamic Island */}
            <div className="navigation-brand shrink-0 border-b border-white/10 px-4 py-5 pt-safe">
                <div className="flex items-center justify-center">
                    <div className="relative h-20 w-44 shrink-0">
                        <Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill sizes="11rem" className="object-contain drop-shadow-[0_0_18px_rgba(244,137,53,0.18)]" priority />
                    </div>
                </div>
                {factoryName && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2">
                        <Factory className="h-4 w-4 shrink-0 text-saffron" />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold leading-tight text-white">{factoryName}</p>
                            <p className="text-[11px] font-medium text-zinc-400">Factory floor</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav aria-label={t("common.navigation")} className="min-h-24 flex-1 space-y-5 overflow-y-auto px-3 py-4 no-scrollbar">
                {/* Primary section */}
                <div className="space-y-1">
                    <div className="px-3 mb-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Daily work</p>
                    </div>
                    {primaryNavItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                        return (
                            <NavigationLink
                                key={item.name}
                                href={item.href}
                                aria-current={isActive ? "page" : undefined}
                                onClick={() => { if (pathname === item.href) onLinkClick?.() }}
                                className={cn(
                                    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                                    isActive
                                        ? "bg-saffron-deep text-white shadow-sm shadow-saffron/20"
                                        : "text-saffron hover:bg-saffron-deep hover:text-white"
                                )}
                            >
                                <Icon className="h-[18px] w-[18px]" />
                                {t(`nav.${item.translationKey}`) || item.name}
                            </NavigationLink>
                        )
                    })}
                </div>

                {/* Secondary section */}
                <div className="space-y-1">
                    <div className="px-3 mb-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Setup</p>
                    </div>
                    {secondaryNavItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                        return (
                            <NavigationLink
                                key={item.name}
                                href={item.href}
                                aria-current={isActive ? "page" : undefined}
                                onClick={() => { if (pathname === item.href) onLinkClick?.() }}
                                className={cn(
                                    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                                    isActive
                                        ? "bg-saffron-deep text-white shadow-sm shadow-saffron/20"
                                        : "text-saffron hover:bg-saffron-deep hover:text-white"
                                )}
                            >
                                <Icon className="h-[18px] w-[18px]" />
                                {t(`nav.${item.translationKey}`) || item.name}
                            </NavigationLink>
                        )
                    })}
                </div>
            </nav>
            <NavigationLink href="/install" className="mx-3 mb-3 flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-saffron hover:bg-saffron-deep hover:text-white">
                <DownloadCloud className="h-[18px] w-[18px]" aria-hidden="true" />
                Install Weavly guide
            </NavigationLink>

            {/* Footer — Language + Logout. pb-safe handles iPad landscape home indicator */}
            <div className="shrink-0 border-t border-white/10 p-4 pb-safe">
                {userName && (
                    <p className="mb-3 truncate text-xs font-medium text-zinc-400">{userName}</p>
                )}
                <div className="flex flex-col gap-3">
                    <LanguageSwitcher className="text-saffron hover:bg-saffron-deep hover:text-white" />
                    <LogoutButton className="rounded-lg px-2 py-1.5 text-saffron hover:bg-saffron-deep hover:text-white" />
                </div>
            </div>
        </div>
    )
}

// ─── Main exported sidebar (replaces layout's header/SupervisorNav) ───────────

export function SupervisorSidebar({ factoryName, userName }: SupervisorSidebarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [isStandalone] = useState(() => {
        if (typeof window === 'undefined') return false
        const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
        return window.matchMedia('(display-mode: standalone)').matches || !!navigatorWithStandalone.standalone
    })
    const pathname = usePathname()
    const { t } = useTranslation()
    const previousPath = useRef(pathname)
    const navigated = useRef(false)

    useEffect(() => {
        if (previousPath.current === pathname) return
        previousPath.current = pathname
        if (!isOpen) return
        navigated.current = true
        const frame = requestAnimationFrame(() => setIsOpen(false))
        return () => cancelAnimationFrame(frame)
    }, [pathname, isOpen])

    useEffect(() => {
        const media = window.matchMedia('(min-width: 768px)')
        const dismissOnDesktop = () => { if (media.matches) setIsOpen(false) }
        media.addEventListener('change', dismissOnDesktop)
        return () => media.removeEventListener('change', dismissOnDesktop)
    }, [])

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
        }
        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const handleInstall = async () => {
        if (!deferredPrompt) return
        await deferredPrompt.prompt()
        await deferredPrompt.userChoice
        setDeferredPrompt(null)
    }

    return (
        <>
            {/* Desktop sidebar — persistent, full viewport height */}
            <aside data-workspace-sidebar="true" className="hidden md:fixed md:inset-y-0 md:z-30 md:flex md:w-[248px] md:flex-col border-r border-white/10 bg-[#111111] pl-safe shadow-[var(--shadow-card)]">
                <NavContent factoryName={factoryName} userName={userName} />
            </aside>

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <header className="mobile-workspace-header md:hidden">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-saffron-deep">Weavly</p>
                        <p data-i18n-skip="true" className="truncate text-sm font-semibold text-ink">{factoryName || t('common.supervisor')}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        {!isStandalone && deferredPrompt && (
                            <Button variant="ghost" size="icon" onClick={handleInstall} aria-label={t('nav.install_app')}>
                                <DownloadCloud aria-hidden="true" />
                            </Button>
                        )}
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t('common.navigation')}><Menu aria-hidden="true" /></Button>
                        </SheetTrigger>
                    </div>
                </header>
                <SheetContent data-navigation-drawer="true" side="left" className="w-[min(280px,90vw)] border-white/10 bg-[#111111] p-0" onCloseAutoFocus={event => {
                    if (!navigated.current) return
                    event.preventDefault()
                    navigated.current = false
                    document.querySelector<HTMLElement>('main')?.focus()
                }}>
                    <SheetHeader className="sr-only">
                        <SheetTitle>{t('common.navigation')}</SheetTitle>
                        <SheetDescription>Supervisor navigation menu</SheetDescription>
                    </SheetHeader>
                    <NavContent factoryName={factoryName} userName={userName} onLinkClick={() => setIsOpen(false)} />
                </SheetContent>
                <MobileNavigation aria-label={t('common.navigation')}>
                    {bottomNavItems.map(item => {
                        const active = pathname === item.href || pathname.startsWith(item.href + '/')
                        return (
                            <NavigationLink key={item.href} href={item.href} aria-current={active ? (pathname === item.href ? 'page' : 'location') : undefined} data-active={active} className="mobile-navigation-item">
                                <MobileNavigationLabel icon={item.icon} label={t(`nav.${item.translationKey}`)} />
                            </NavigationLink>
                        )
                    })}
                    <SheetTrigger asChild>
                        <button type="button" aria-label={t('common.navigation')} data-active={isOpen || secondaryNavItems.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))} className="mobile-navigation-item">
                            <MobileNavigationLabel icon={Menu} label={t('common.menu')} />
                        </button>
                    </SheetTrigger>
                </MobileNavigation>
            </Sheet>
        </>
    )
}

// ─── Legacy exports kept so nothing else breaks ───────────────────────────────
// (layout.tsx will be updated to use SupervisorSidebar instead)

export function SupervisorNav() { return null }
export function MobileSupervisorNav() { return null }
export function MobileSupervisorBottomNav() { return null }
