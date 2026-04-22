"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    ClipboardList,
    ClipboardCheck,
    Users,
    Settings,
    Calendar,
    Menu,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import LogoutButton from "@/components/auth/logout-button"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { useTranslation } from "@/lib/i18n/context"
import { DownloadCloud } from "lucide-react"

// ─── Nav item definitions ────────────────────────────────────────────────────

const primaryNavItems = [
    { name: "Dashboard",      href: "/supervisor/dashboard",  icon: ClipboardList,  translationKey: "dashboard"   },
    { name: "Workers",        href: "/supervisor/workers",     icon: Users,           translationKey: "workers"     },
    { name: "Attendance",     href: "/supervisor/attendance",  icon: Calendar,        translationKey: "attendance"  },
]

const secondaryNavItems = [
    { name: "Machines", href: "/supervisor/machines", icon: Settings, translationKey: "machines" },
]

// Bottom nav shows Dashboard, Workers, Attendance
const bottomNavItems = primaryNavItems

// ─── Supervisor Role Label ────────────────────────────────────────────────────

export function SupervisorRoleLabel() {
    const { t } = useTranslation()
    return (
        <span className="text-[10px] uppercase tracking-widest text-primary font-bold">
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
        <div className="flex flex-col h-full bg-sidebar">
            {/* Branding — extra top padding on iOS standalone for Dynamic Island */}
            <div className="px-4 py-4 pt-safe border-b border-sidebar-border flex items-center justify-center">
                <div className="relative h-20 w-36 shrink-0">
                    <Image src="/images/LoomiLogo.png" alt="Loomi Logo" fill className="object-contain" priority />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
                {/* Primary section */}
                <div className="space-y-1">
                    <div className="px-3 mb-2">
                        <p className="text-[11px] uppercase tracking-widest text-sidebar-foreground/70 font-extrabold">Main Pivot</p>
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
                                    "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-[0_4px_14px_0_rgba(255,87,34,0.3)]"
                                        : "text-primary hover:text-sidebar-foreground hover:bg-black/5 dark:hover:bg-white/5"
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
                        <p className="text-[11px] uppercase tracking-widest text-sidebar-foreground/70 font-extrabold">Management</p>
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
                                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-[0_4px_14px_0_oklch(0.65_0.20_40/0.3)]"
                                        : "text-primary hover:text-sidebar-foreground hover:bg-black/5 dark:hover:bg-white/5"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {t(`nav.${item.translationKey}`) || item.name}
                            </Link>
                        )
                    })}
                </div>
            </nav>

            {/* Footer — Language + Logout. pb-safe handles iPad landscape home indicator */}
            <div className="border-t border-sidebar-border p-4 pb-safe">
                {userName && (
                    <p className="text-xs text-muted-foreground mb-3 truncate">{userName}</p>
                )}
                <div className="flex flex-col gap-3">
                    <LanguageSwitcher />
                    <LogoutButton />
                </div>
            </div>
        </div>
    )
}

// ─── Main exported sidebar (replaces layout's header/SupervisorNav) ───────────

export function SupervisorSidebar({ factoryName, userName }: SupervisorSidebarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [isStandalone, setIsStandalone] = useState(false)
    const pathname = usePathname()
    const { t } = useTranslation()

    useEffect(() => {
        // Check if app is in standalone mode
        if (typeof window !== 'undefined') {
            setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone)
        }

        const handler = (e: any) => {
            e.preventDefault()
            setDeferredPrompt(e)
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
            <aside className="hidden md:flex md:w-[260px] md:flex-col md:fixed md:inset-y-0 bg-sidebar border-r border-sidebar-border z-30 pl-safe">
                <NavContent factoryName={factoryName} userName={userName} />
            </aside>

            {/*
             * Mobile header bar
             * pt-safe: pushes content below the Dynamic Island / status-bar notch
             * on iOS standalone PWA mode and Android cutout displays.
             */}
            <header className="md:hidden sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 py-2 pt-safe shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="relative h-8 w-24 shrink-0 transition-transform active:scale-95">
                        <Image src="/images/LoomiLogo.png" alt="Loomi Logo" fill className="object-contain" priority />
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {!isStandalone && deferredPrompt && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleInstall}
                            className="h-8 gap-1.5 text-[10px] font-black uppercase text-primary bg-primary/5 hover:bg-primary/10 rounded-full border border-primary/20 px-3"
                        >
                            <DownloadCloud className="h-3 w-3" />
                            Install App
                        </Button>
                    )}
                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Open navigation</span>
                            </Button>
                        </SheetTrigger>
                    {/*
                     * Sheet width: min(280px, 85vw)
                     * — 280 px on normal phones
                     * — 85 vw on Galaxy Fold folded (≈ 280 px wide) so the sheet
                     *   never fills the entire screen and the user can tap outside
                     *   to dismiss it.
                     */}
                    <SheetContent side="left" className="w-[min(280px,85vw)] bg-sidebar border-sidebar-border">
                        <SheetHeader className="sr-only">
                            <SheetTitle>{t("common.navigation")}</SheetTitle>
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
                "bg-background/90 backdrop-blur-xl border-t border-border",
                "flex justify-around items-stretch",
                "pb-safe pt-2 pl-safe pr-safe",
                "shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.1)]",
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
                                "py-1 px-0.5 transition-all duration-300",
                                isActive ? "text-primary" : "text-primary opacity-80"
                            )}
                        >
                            {/* Active scale is applied to the icon pill only to avoid
                                layout shift on very narrow screens */}
                            <div className={cn(
                                "py-1 px-3 rounded-xl mb-0.5 transition-all duration-300",
                                "landscape:py-0.5 landscape:px-2",
                                isActive
                                    ? "bg-primary/15 scale-110"
                                    : "hover:bg-black/5"
                            )}>
                                <Icon className={cn(
                                    "h-5 w-5 landscape:h-4 landscape:w-4",
                                    isActive && "stroke-[2.5px]"
                                )} />
                            </div>
                            <span className={cn(
                                "text-[10px] landscape:text-[9px] font-bold leading-none tracking-tight truncate max-w-full px-0.5",
                                isActive ? "opacity-100" : "opacity-80"
                            )}>
                                {t(`nav.${item.translationKey}`) || item.name}
                            </span>
                            {isActive && (
                                <span className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-primary" />
                            )}
                        </Link>
                    )
                })}

                {/* More button — opens the sheet drawer for secondary nav items */}
                <button
                    onClick={() => setIsOpen(true)}
                    className={cn(
                        "flex flex-col items-center justify-center min-w-0 w-full relative",
                        "py-1 px-0.5 text-primary opacity-80"
                    )}
                >
                    <div className="py-1 px-3 landscape:py-0.5 landscape:px-2 rounded-xl mb-0.5 hover:bg-black/5 transition-all">
                        <Menu className="h-5 w-5 landscape:h-4 landscape:w-4" />
                    </div>
                    <span className="text-[10px] landscape:text-[9px] font-bold leading-none tracking-tight opacity-80">
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
