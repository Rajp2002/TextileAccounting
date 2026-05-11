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
    HandCoins,
    Calculator,
    Package,
    CreditCard,
    FileText,
    Truck,
    Store,
    Warehouse,
    Factory,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import LogoutButton from "@/components/auth/logout-button"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { useTranslation } from "@/lib/i18n/context"

const navGroups = [
    {
        label: "Control",
        items: [
            { name: "Factory Today", href: "/owner/today", icon: Factory, translationKey: "factory_today" },
            { name: "Estimator", href: "/owner/estimator", icon: Calculator, translationKey: "estimator" },
            { name: "Quotes", href: "/owner/quotes", icon: FileText, translationKey: "quotes" },
            { name: "Analytics", href: "/owner/analytics", icon: BarChart3, translationKey: "dashboard" },
        ]
    },
    {
        label: "Factory flow",
        items: [
            { name: "Orders", href: "/owner/orders", icon: Package, translationKey: "orders" },
            { name: "Market Runs", href: "/owner/market-runs", icon: Store, translationKey: "market_runs" },
            { name: "Stock", href: "/owner/stock", icon: Warehouse, translationKey: "stock" },
            { name: "Dispatches", href: "/owner/dispatches", icon: Truck, translationKey: "dispatches" },
        ]
    },
    {
        label: "Money",
        items: [
            { name: "Commercials", href: "/owner/commercials", icon: DollarSign, translationKey: "commercials" },
            { name: "Billing", href: "/owner/billing", icon: CreditCard, translationKey: "billing" },
        ]
    },
    {
        label: "Workforce",
        items: [
            { name: "Workers", href: "/owner/fixed-workers", icon: Users, translationKey: "workers" },
            { name: "Payroll", href: "/owner/payroll", icon: DollarSign, translationKey: "payroll" },
            { name: "Advances", href: "/owner/advances", icon: HandCoins, translationKey: "advances" },
        ]
    },
    {
        label: "Looms",
        items: [
            { name: "Looms", href: "/owner/machines", icon: Server, translationKey: "machines" },
        ]
    },
    {
        label: "System",
        items: [
            { name: "Settings", href: "/owner/settings", icon: Settings, translationKey: "settings" },
        ]
    }
]

const bottomNavItems = [
    { name: "Today", href: "/owner/today", icon: Factory, translationKey: "factory_today" },
    { name: "Orders", href: "/owner/orders", icon: Package, translationKey: "orders" },
    { name: "Stock", href: "/owner/stock", icon: Warehouse, translationKey: "stock" },
    { name: "Estimator", href: "/owner/estimator", icon: Calculator, translationKey: "estimator" },
    { name: "Payroll", href: "/owner/payroll", icon: DollarSign, translationKey: "payroll" },
]

interface OwnerSidebarProps {
    factoryName?: string
    userName?: string
}

function NavContent({ factoryName, userName, onLinkClick }: OwnerSidebarProps & { onLinkClick?: () => void }) {
    const pathname = usePathname()
    const { t } = useTranslation()

    return (
        <div className="flex h-full flex-col bg-[#111111] text-zinc-100">
            {/* Factory branding */}
            <div className="border-b border-white/10 px-4 py-5">
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
                            <p className="text-[11px] font-medium text-zinc-400">Owner control</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 no-scrollbar">
                {navGroups.map((group, index) => (
                    <div key={group.label} className="space-y-1">
                        <div className={cn("px-3 mb-2", index > 0 && "mt-4")}>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{group.label}</p>
                        </div>
                        {group.items.map((item) => {
                            const Icon = item.icon
                            const isActive = (item.name === 'Settings' || item.name === 'Factory Today')
                                ? pathname === item.href
                                : pathname === item.href || pathname.startsWith(item.href + "/")

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
                ))}
            </nav>

            {/* User footer */}
            <div className="border-t border-white/10 p-4">
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

export function OwnerSidebar({ factoryName, userName }: OwnerSidebarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()
    const { t } = useTranslation()

    return (
        <>
            {/* Desktop sidebar — persistent */}
            <aside className="hidden md:fixed md:inset-y-0 md:z-30 md:flex md:w-[248px] md:flex-col border-r border-white/10 bg-[#111111] shadow-[var(--shadow-card)]">
                <NavContent factoryName={factoryName} userName={userName} />
            </aside>

            {/* Mobile header bar */}
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-canvas/92 px-4 py-2 backdrop-blur-xl md:hidden">
                <div className="flex items-center">
                    <div className="relative h-10 w-28 shrink-0">
                        <Image src="/images/WeavlyLogo.png" alt="Weavly Logo" fill sizes="7rem" className="object-contain" priority />
                    </div>
                </div>

                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="rounded-full text-ink">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Open navigation</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="left"
                        className="w-[280px] border-white/10 bg-[#111111] p-0"
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
                "bg-canvas/92 backdrop-blur-xl border-t border-border",
                "flex justify-around items-stretch",
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
                                "py-1 px-0.5 transition-all duration-300",
                                isActive ? "text-saffron-deep" : "text-body"
                            )}
                        >
                            <div className={cn(
                                "py-1 px-3 rounded-xl mb-0.5 transition-all duration-300",
                                "landscape:py-0.5 landscape:px-2",
                                isActive ? "bg-saffron-soft scale-105" : "hover:bg-surface-soft"
                            )}>
                                <Icon className={cn("h-5 w-5 landscape:h-4 landscape:w-4", isActive && "stroke-[2.5px]")} />
                            </div>
                            <span className={cn(
                                "text-[10px] landscape:text-[9px] font-semibold leading-none truncate max-w-full px-0.5",
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
                
                {/* More button to trigger the sheet */}
                <button
                    onClick={() => setIsOpen(true)}
                    className={cn(
                        "flex flex-col items-center justify-center min-w-0 w-full relative",
                        "py-1 px-0.5 text-body"
                    )}
                >
                    <div className="mb-0.5 rounded-xl px-3 py-1 transition-all hover:bg-surface-soft landscape:px-2 landscape:py-0.5">
                        <Menu className="h-5 w-5 landscape:h-4 landscape:w-4" />
                    </div>
                    <span className="text-[10px] font-semibold leading-none opacity-80 landscape:text-[9px]">
                        {t('common.menu')}
                    </span>
                </button>
            </div>
        </>
    )
}
