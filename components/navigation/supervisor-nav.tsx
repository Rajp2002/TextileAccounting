"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    ClipboardList,
    Users,
    Settings,
    Calendar,
    Menu,
    Factory,
} from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetHeader } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
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
        <div className="flex h-full flex-col bg-[#111111] text-zinc-100">
            {/* Branding — extra top padding on iOS standalone for Dynamic Island */}
            <div className="border-b border-white/10 px-4 py-5 pt-safe">
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
            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 no-scrollbar">
                {/* Primary section */}
                <div className="space-y-1">
                    <div className="px-3 mb-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Daily work</p>
                    </div>
                    {primaryNavItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={onLinkClick}
                                className={cn(
                                    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                                    isActive
                                        ? "bg-saffron-deep text-white shadow-sm shadow-saffron/20"
                                        : "text-saffron hover:bg-saffron-deep hover:text-white"
                                )}
                            >
                                <Icon className="h-[18px] w-[18px]" />
                                {t(`nav.${item.translationKey}`) || item.name}
                            </Link>
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
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={onLinkClick}
                                className={cn(
                                    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                                    isActive
                                        ? "bg-saffron-deep text-white shadow-sm shadow-saffron/20"
                                        : "text-saffron hover:bg-saffron-deep hover:text-white"
                                )}
                            >
                                <Icon className="h-[18px] w-[18px]" />
                                {t(`nav.${item.translationKey}`) || item.name}
                            </Link>
                        )
                    })}
                </div>
            </nav>

            {/* Footer — Language + Logout. pb-safe handles iPad landscape home indicator */}
            <div className="border-t border-white/10 p-4 pb-safe">
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
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') setDeferredPrompt(null)
    }

    return (
        <>
            {/* Desktop sidebar — persistent, full viewport height */}
            <aside className="hidden md:fixed md:inset-y-0 md:z-30 md:flex md:w-[248px] md:flex-col border-r border-white/10 bg-[#111111] pl-safe shadow-[var(--shadow-card)]">
                <NavContent factoryName={factoryName} userName={userName} />
            </aside>

            {/*
             * Mobile header bar
             * pt-safe: pushes content below the Dynamic Island / status-bar notch
             * on iOS standalone PWA mode and Android cutout displays.
             */}
            <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-canvas/92 px-4 py-2 pt-safe shadow-sm backdrop-blur-xl md:hidden">
                <div className="flex items-center gap-2">
                    <div className="relative h-16 w-36 shrink-0 transition-transform active:scale-95">
                        <Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill sizes="9rem" className="object-contain" priority />
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {!isStandalone && deferredPrompt && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleInstall}
                            className="h-8 gap-1.5 rounded-full border border-saffron-soft bg-saffron-soft/50 px-3 text-[10px] font-semibold uppercase text-saffron-deep hover:bg-saffron-soft"
                        >
                            <DownloadCloud className="h-3 w-3" />
                            Install App
                        </Button>
                    )}
                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    {/*
                     * Sheet width: min(280px, 85vw)
                     * — 280 px on normal phones
                     * — 85 vw on Galaxy Fold folded (≈ 280 px wide) so the sheet
                     *   never fills the entire screen and the user can tap outside
                     *   to dismiss it.
                     */}
                    <SheetContent side="left" className="w-[min(280px,85vw)] border-white/10 bg-[#111111] p-0">
                        <SheetHeader className="sr-only">
                            <SheetTitle>{t("common.navigation")}</SheetTitle>
                            <SheetDescription>Supervisor navigation menu</SheetDescription>
                        </SheetHeader>
                        <NavContent
                            factoryName={factoryName}
                            userName={userName}
                            onLinkClick={() => setIsOpen(false)}
                        />
                    </SheetContent>
                    </Sheet>
                </div>
            </header>

            {/*
             * Mobile Bottom Navigation Bar
             *
             * Safe-area notes:
             *   pb-safe  → clears the iOS home indicator / Android gesture bar
             *              (defined in globals.css as calc(0.5rem + env(safe-area-inset-bottom)))
             *   pt-2     → a small top cushion inside the bar (NOT inset-top — that's
             *              the status/notch area which lives at the TOP of the screen)
             *   pl-safe / pr-safe → side padding in iPhone landscape where the
             *              rounded corners and home indicator eat into the sides
             *
             * Layout notes:
             *   min-h-[56px] in landscape (@media orientation:landscape) via the
             *   `landscape:` variant keeps the bar usable but compact when rotated.
             *   min-w-0 on each tab prevents text overflow on very narrow screens
             *   (Galaxy Fold folded ≈ 280 px).
             */}
            <div className={cn(
                "md:hidden fixed bottom-0 left-0 right-0 z-50",
                "bg-canvas/92 backdrop-blur-xl border-t border-border",
                "grid auto-cols-fr grid-flow-col items-stretch",
                "pb-safe pt-2 pl-safe pr-safe",
                "shadow-[0_-8px_24px_-4px_rgba(30,37,40,0.10)]",
                "min-h-[64px] landscape:min-h-[52px] select-none"
            )}>
                {bottomNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center min-w-0 w-full relative",
                                "mobile-nav-item",
                                "py-1 px-0.5 transition-all duration-300",
                                isActive ? "text-saffron-deep" : "text-body"
                            )}
                            aria-label={t(`nav.${item.translationKey}`) || item.name}
                        >
                            {/* Active scale is applied to the icon pill only to avoid
                                layout shift on very narrow screens */}
                            <div className={cn(
                                "mobile-nav-icon-pill py-1 px-2 xs:px-3 rounded-xl mb-0.5 transition-all duration-300",
                                "landscape:py-0.5 landscape:px-2",
                                isActive
                                    ? "bg-saffron-soft scale-105"
                                    : "hover:bg-surface-soft"
                            )}>
                                <Icon className={cn(
                                    "h-5 w-5 landscape:h-4 landscape:w-4",
                                    isActive && "stroke-[2.5px]"
                                )} />
                            </div>
                            <span className={cn(
                                "mobile-nav-label text-[10px] landscape:text-[9px] font-semibold leading-none truncate max-w-full px-0.5",
                                isActive ? "opacity-100" : "opacity-80"
                            )}>
                                {t(`nav.${item.translationKey}`) || item.name}
                            </span>
                            {isActive && (
                                <span className="absolute -top-px left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-saffron" />
                            )}
                        </Link>
                    )
                })}

                {/* More button — opens the sheet drawer for secondary nav items */}
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    aria-label={t("common.navigation")}
                    className={cn(
                        "mobile-nav-item flex flex-col items-center justify-center min-w-0 w-full relative",
                        "py-1 px-0.5 text-body"
                    )}
                >
                    <div className="mobile-nav-icon-pill mb-0.5 rounded-xl px-2 py-1 transition-all hover:bg-surface-soft xs:px-3 landscape:px-2 landscape:py-0.5">
                        <Menu className="h-5 w-5 landscape:h-4 landscape:w-4" />
                    </div>
                    <span className="mobile-nav-label text-[10px] font-semibold leading-none opacity-80 landscape:text-[9px]">
                        {t("common.menu")}
                    </span>
                </button>
            </div>
        </>
    )
}

// ─── Legacy exports kept so nothing else breaks ───────────────────────────────
// (layout.tsx will be updated to use SupervisorSidebar instead)

export function SupervisorNav() { return null }
export function MobileSupervisorNav() { return null }
export function MobileSupervisorBottomNav() { return null }
