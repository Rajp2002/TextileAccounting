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
    Archive,
} from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetHeader } from "@/components/ui/sheet"
import { useState } from "react"
import LogoutButton from "@/components/auth/logout-button"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { useTranslation } from "@/lib/i18n/context"
import { isWorkflowVisible, normalizeProductionMode, type ProductionMode, type WorkflowKey } from "@/lib/production-mode"

const navGroups = [
    {
        label: "Control",
        items: [
            { name: "Factory Today", href: "/owner/today", icon: Factory, translationKey: "factory_today", workflow: "productionLogging" },
            { name: "Estimator", href: "/owner/estimator", icon: Calculator, translationKey: "estimator", workflow: "estimator" },
            { name: "Quotes", href: "/owner/quotes", icon: FileText, translationKey: "quotes", workflow: "quotes" },
            { name: "Analytics", href: "/owner/analytics", icon: BarChart3, translationKey: "dashboard", workflow: "ownerAnalytics" },
        ]
    },
    {
        label: "Factory flow",
        items: [
            { name: "Orders", href: "/owner/orders", icon: Package, translationKey: "orders", workflow: "orders" },
            { name: "Market Runs", href: "/owner/market-runs", icon: Store, translationKey: "market_runs", workflow: "marketRuns" },
            { name: "Stock", href: "/owner/stock", icon: Warehouse, translationKey: "stock", workflow: "stock" },
            { name: "Dispatches", href: "/owner/dispatches", icon: Truck, translationKey: "dispatches", workflow: "dispatches" },
        ]
    },
    {
        label: "Money",
        items: [
            { name: "Commercials", href: "/owner/commercials", icon: DollarSign, translationKey: "commercials", workflow: "commercials" },
            { name: "Billing", href: "/owner/billing", icon: CreditCard, translationKey: "billing", workflow: "billing" },
        ]
    },
    {
        label: "Workforce",
        items: [
            { name: "Workers", href: "/owner/fixed-workers", icon: Users, translationKey: "workers", workflow: "workers" },
            { name: "Payroll", href: "/owner/payroll", icon: DollarSign, translationKey: "payroll", workflow: "payroll" },
            { name: "Advances", href: "/owner/advances", icon: HandCoins, translationKey: "advances", workflow: "advances" },
        ]
    },
    {
        label: "Looms",
        items: [
            { name: "Looms", href: "/owner/machines", icon: Server, translationKey: "machines", workflow: "looms" },
        ]
    },
    {
        label: "System",
        items: [
            { name: "Archive", href: "/owner/archive", icon: Archive, translationKey: "archive", workflow: "archive" },
            { name: "Settings", href: "/owner/settings", icon: Settings, translationKey: "settings", workflow: "settings" },
        ]
    }
]

const bottomNavItems = [
    { name: "Today", href: "/owner/today", icon: Factory, translationKey: "factory_today", workflow: "productionLogging" },
    { name: "Orders", href: "/owner/orders", icon: Package, translationKey: "orders", workflow: "orders" },
    { name: "Market Runs", href: "/owner/market-runs", icon: Store, translationKey: "market_runs", workflow: "marketRuns" },
    { name: "Stock", href: "/owner/stock", icon: Warehouse, translationKey: "stock", workflow: "stock" },
    { name: "Estimator", href: "/owner/estimator", icon: Calculator, translationKey: "estimator", workflow: "estimator" },
    { name: "Payroll", href: "/owner/payroll", icon: DollarSign, translationKey: "payroll", workflow: "payroll" },
]

function getNavLabel(item: { name: string; translationKey: string }, productionMode: ProductionMode, t: (key: string) => string) {
    if (productionMode === 'market_run' && item.name === 'Stock') return 'Godown Ledger'
    return t(`nav.${item.translationKey}`) || item.name
}

interface OwnerSidebarProps {
    factoryName?: string
    userName?: string
    productionMode?: ProductionMode | null
}

function NavContent({ factoryName, userName, productionMode: rawProductionMode, onLinkClick }: OwnerSidebarProps & { onLinkClick?: () => void }) {
    const pathname = usePathname()
    const { t } = useTranslation()
    const productionMode = normalizeProductionMode(rawProductionMode)
    const visibleGroups = navGroups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => isWorkflowVisible(productionMode, item.workflow as WorkflowKey)),
        }))
        .filter((group) => group.items.length > 0)

    return (
        <div className="flex h-full flex-col bg-[#111111] text-zinc-100">
            {/* Factory branding */}
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
                            <p className="text-[11px] font-medium text-zinc-400">Owner control</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 no-scrollbar">
                {visibleGroups.map((group, index) => (
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
                                    {getNavLabel(item, productionMode, t)}
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

export function OwnerSidebar({ factoryName, userName, productionMode }: OwnerSidebarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()
    const { t } = useTranslation()
    const normalizedProductionMode = normalizeProductionMode(productionMode)
    const visibleBottomNavItems = bottomNavItems
        .filter((item) => isWorkflowVisible(normalizedProductionMode, item.workflow as WorkflowKey))
        .slice(0, 5)

    return (
        <>
            {/* Desktop sidebar — persistent */}
            <aside className="hidden md:fixed md:inset-y-0 md:z-30 md:flex md:w-[248px] md:flex-col border-r border-white/10 bg-[#111111] shadow-[var(--shadow-card)]">
                <NavContent factoryName={factoryName} userName={userName} productionMode={normalizedProductionMode} />
            </aside>

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetContent
                    side="left"
                    className="w-[min(280px,85vw)] border-white/10 bg-[#111111] p-0"
                >
                    <SheetHeader className="sr-only">
                        <SheetTitle>{t('common.navigation')}</SheetTitle>
                        <SheetDescription>Owner navigation menu</SheetDescription>
                    </SheetHeader>
                    <NavContent
                        factoryName={factoryName}
                        userName={userName}
                        productionMode={normalizedProductionMode}
                        onLinkClick={() => setIsOpen(false)}
                    />
                </SheetContent>
            </Sheet>

            {/* Mobile Bottom Navigation Form Factor */}
            <div className={cn(
                "md:hidden fixed bottom-0 left-0 right-0 z-50",
                "bg-canvas/92 backdrop-blur-xl border-t border-border",
                "grid auto-cols-fr grid-flow-col items-stretch",
                "pb-safe pt-2 pl-safe pr-safe",
                "shadow-[0_-8px_24px_-4px_rgba(30,37,40,0.10)]",
                "min-h-[64px] landscape:min-h-[52px] select-none"
            )}>
                {visibleBottomNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "mobile-nav-item flex min-w-0 flex-col items-center justify-center relative",
                                "py-1 px-0.5 transition-all duration-300",
                                isActive ? "text-saffron-deep" : "text-body"
                            )}
                            aria-label={getNavLabel(item, normalizedProductionMode, t)}
                        >
                            <div className={cn(
                                "mobile-nav-icon-pill py-1 px-2 xs:px-3 rounded-xl mb-0.5 transition-all duration-300",
                                "landscape:py-0.5 landscape:px-2",
                                isActive ? "bg-saffron-soft scale-105" : "hover:bg-surface-soft"
                            )}>
                                <Icon className={cn("h-5 w-5 landscape:h-4 landscape:w-4", isActive && "stroke-[2.5px]")} />
                            </div>
                            <span className={cn(
                                "mobile-nav-label text-[10px] landscape:text-[9px] font-semibold leading-none truncate max-w-full px-0.5",
                                isActive ? "opacity-100" : "opacity-80"
                            )}>
                                {getNavLabel(item, normalizedProductionMode, t)}
                            </span>
                            {isActive && (
                                <span className="absolute -top-px left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-saffron" />
                            )}
                        </Link>
                    )
                })}
                
                {/* More button to trigger the sheet */}
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    aria-label={t('common.navigation')}
                    className={cn(
                        "mobile-nav-item flex min-w-0 flex-col items-center justify-center relative",
                        "py-1 px-0.5 text-body"
                    )}
                >
                    <div className="mobile-nav-icon-pill mb-0.5 rounded-xl px-2 py-1 transition-all hover:bg-surface-soft xs:px-3 landscape:px-2 landscape:py-0.5">
                        <Menu className="h-5 w-5 landscape:h-4 landscape:w-4" />
                    </div>
                    <span className="mobile-nav-label text-[10px] font-semibold leading-none opacity-80 landscape:text-[9px]">
                        {t('common.menu')}
                    </span>
                </button>
            </div>
        </>
    )
}
