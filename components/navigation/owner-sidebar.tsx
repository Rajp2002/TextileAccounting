"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    BarChart3,
    Server,
    Users,
    DollarSign,
    Settings,
    Menu,
    Activity,
    HandCoins,
    ShieldAlert,
    History,
    Calculator,
    Package,
    CreditCard,
    FileText,
    Truck,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import LogoutButton from "@/components/auth/logout-button"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { useTranslation } from "@/lib/i18n/context"

const primaryNavItems = [
    { name: "Dashboard", href: "/owner/analytics", icon: BarChart3, translationKey: "dashboard" },
    { name: "Orders", href: "/owner/orders", icon: Package, translationKey: "orders" },
    { name: "Estimator", href: "/owner/estimator", icon: Calculator, translationKey: "estimator" },
    { name: "Payroll", href: "/owner/payroll", icon: DollarSign, translationKey: "payroll" },
]

const secondaryNavItems = [
    { name: "Workers", href: "/owner/fixed-workers", icon: Users, translationKey: "workers" },
    { name: "Dispatches", href: "/owner/dispatches", icon: Truck, translationKey: "dispatches" },
    { name: "Advances", href: "/owner/advances", icon: HandCoins, translationKey: "advances" },
    { name: "Machines", href: "/owner/machines", icon: Server, translationKey: "machines" },
    { name: "Quotes", href: "/owner/quotes", icon: FileText, translationKey: "quotes" },
    { name: "Billing", href: "/owner/billing", icon: CreditCard, translationKey: "billing" },
]

const systemItems = [
    { name: "System Health", href: "/owner/system-health", icon: Activity, translationKey: "system health" },
    { name: "Audit Trail", href: "/owner/settings/audit", icon: History, translationKey: "audit trail" },
    { name: "Settings", href: "/owner/settings", icon: Settings, translationKey: "settings" },
]

interface OwnerSidebarProps {
    factoryName?: string
    userName?: string
}

function NavContent({ factoryName, userName, onLinkClick }: OwnerSidebarProps & { onLinkClick?: () => void }) {
    const pathname = usePathname()
    const { t } = useTranslation()

    return (
        <div className="flex flex-col h-full bg-sidebar">
            {/* Factory branding */}
            <div className="px-4 py-4 border-b border-sidebar-border flex items-center justify-center">
                <div className="relative h-20 w-36 shrink-0">
                    <Image src="/images/WeavlyLogoDark.png" alt="Weavly Logo" fill className="object-contain" priority />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
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
                                    "flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-lg transition-all duration-200",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-[0_4px_12px_-2px_oklch(from_var(--primary)_l_c_h_/_0.3)]"
                                        : "text-primary hover:text-sidebar-foreground hover:bg-black/5 dark:hover:bg-white/5"
                                )}
                            >
                                <Icon className="h-[18px] w-[18px]" />
                                {/* Fallback to item.name since we might not have 'orders' translation yet */}
                                {t(`nav.${item.translationKey}`) || item.name}
                            </Link>
                        )
                    })}
                </div>

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
                                    "flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-lg transition-all duration-200",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-[0_4px_12px_-2px_oklch(from_var(--primary)_l_c_h_/_0.3)]"
                                        : "text-primary hover:text-sidebar-foreground hover:bg-black/5 dark:hover:bg-white/5"
                                )}
                            >
                                <Icon className="h-[18px] w-[18px]" />
                                {t(`nav.${item.translationKey}`) || item.name}
                            </Link>
                        )
                    })}
                </div>

                <div className="space-y-1">
                    <div className="px-3 mb-2 mt-4">
                        <p className="text-[11px] uppercase tracking-widest text-sidebar-foreground/70 font-extrabold">System</p>
                    </div>
                    {systemItems.map((item) => {
                        const Icon = item.icon
                        const isActive = item.name === 'Settings' 
                            ? pathname === item.href 
                            : pathname === item.href || pathname.startsWith(item.href + "/")

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={onLinkClick}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-lg transition-all duration-200",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-[0_4px_12px_-2px_oklch(from_var(--primary)_l_c_h_/_0.3)]"
                                        : "text-primary hover:text-sidebar-foreground hover:bg-black/5 dark:hover:bg-white/5"
                                )}
                            >
                                <Icon className="h-[18px] w-[18px]" />
                                {t(`nav.${item.translationKey}`) || item.name}
                            </Link>
                        )
                    })}
                </div>
            </nav>

            {/* User footer */}
            <div className="border-t border-sidebar-border p-4">
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

export function OwnerSidebar({ factoryName, userName }: OwnerSidebarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()
    const { t } = useTranslation()

    return (
        <>
            {/* Desktop sidebar — persistent */}
            <aside className="hidden md:flex md:w-[260px] md:flex-col md:fixed md:inset-y-0 bg-sidebar border-r border-sidebar-border z-30">
                <NavContent factoryName={factoryName} userName={userName} />
            </aside>

            {/* Mobile header bar */}
            <header className="md:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 py-2">
                <div className="flex items-center">
                    <div className="relative h-10 w-28 shrink-0">
                        <Image src="/images/WeavlyLogoDark.png" alt="Weavly Logo" fill className="object-contain" priority />
                    </div>
                </div>

                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-full">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Open navigation</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="left"
                        className="w-[280px] bg-sidebar border-sidebar-border"
                    >
                        <SheetHeader className="sr-only">
                            <SheetTitle>{t('common.navigation')}</SheetTitle>
                        </SheetHeader>
                        <NavContent
                            factoryName={factoryName}
                            userName={userName}
                            onLinkClick={() => setIsOpen(false)}
                        />
                    </SheetContent>
                </Sheet>
            </header>

            {/* Mobile Bottom Navigation Form Factor */}
            <div className={cn(
                "md:hidden fixed bottom-0 left-0 right-0 z-50",
                "bg-background/80 backdrop-blur-lg border-t border-border",
                "flex justify-around items-center px-2 pb-safe pt-2 pl-safe pr-safe",
                "shadow-[0_-4px_12px_-1px_rgba(0,0,0,0.05)]",
                "min-h-[68px] select-none"
            )}>
                {primaryNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center py-1 px-1 min-w-0 w-full relative transition-all duration-300",
                                isActive ? "text-primary scale-110" : "text-primary opacity-80"
                            )}
                        >
                            <div className={cn(
                                "py-1.5 px-4 rounded-xl mb-1 transition-all duration-300",
                                isActive ? "bg-primary/15" : "hover:bg-black/5"
                            )}>
                                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
                            </div>
                            <span className={cn(
                                "text-[10px] font-bold leading-none tracking-tight truncate max-w-full px-0.5",
                                isActive ? "opacity-100" : "opacity-80"
                            )}>
                                {t(`nav.${item.translationKey}`) || item.name}
                            </span>
                            {isActive && (
                                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                            )}
                        </Link>
                    )
                })}
                
                {/* More button to trigger the sheet */}
                <button
                    onClick={() => setIsOpen(true)}
                    className="flex flex-col items-center justify-center py-1 px-1 min-w-0 w-full relative text-primary opacity-80"
                >
                    <div className="py-1.5 px-4 rounded-xl mb-1 hover:bg-black/5 transition-all">
                        <Menu className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-bold leading-none tracking-tight opacity-80">{t('common.menu')}</span>
                </button>
            </div>
        </>
    )
}

