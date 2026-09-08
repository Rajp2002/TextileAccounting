"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useMobileKeyboard } from "@/hooks/use-mobile-keyboard"
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
    Tags,
    BellRing,
    ClipboardList,
    Wrench,
} from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetHeader } from "@/components/ui/sheet"
import { useState } from "react"
import LogoutButton from "@/components/auth/logout-button"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { useTranslation } from "@/lib/i18n/context"
import { isWorkflowVisible, normalizeProductionMode, type ProductionMode, type WorkflowKey } from "@/lib/production-mode"
import { hasCapability, type SubscriptionTier } from "@/lib/subscription-access"

const navGroups = [
    {
        label: "Control",
        items: [
            { name: "Factory Today", href: "/owner/today", icon: Factory, translationKey: "factory_today", workflow: "productionLogging" },
            { name: "Cost Estimate", href: "/owner/estimator", icon: Calculator, translationKey: "estimator", workflow: "estimator" },
            { name: "Production", href: "/owner/production", icon: ClipboardList, translationKey: "production", workflow: "baseProduction" },
            { name: "Setup", href: "/owner/operations", icon: Wrench, translationKey: "settings", workflow: "baseProduction" },
            { name: "Yarn Rate Book", href: "/owner/rates", icon: Tags, translationKey: "settings", workflow: "estimator" },
            { name: "Quotations", href: "/owner/quotes", icon: FileText, translationKey: "quotes", workflow: "estimator" },
            { name: "Analytics", href: "/owner/analytics", icon: BarChart3, translationKey: "dashboard", workflow: "ownerAnalytics" },
        ]
    },
    {
        label: "Factory flow",
        items: [
            { name: "Party Orders", href: "/owner/orders", icon: Package, translationKey: "orders", workflow: "orders" },
            { name: "Market Runs", href: "/owner/market-runs", icon: Store, translationKey: "market_runs", workflow: "marketRuns" },
            { name: "Stock", href: "/owner/stock", icon: Warehouse, translationKey: "stock", workflow: "stock" },
            { name: "Dispatches", href: "/owner/dispatches", icon: Truck, translationKey: "dispatches", workflow: "dispatches" },
        ]
    },
    {
        label: "Money",
        items: [
            { name: "Party Ledger", href: "/owner/commercials", icon: DollarSign, translationKey: "commercials", workflow: "commercials" },
            { name: "Billing", href: "/owner/billing", icon: CreditCard, translationKey: "billing", workflow: "billing" },
        ]
    },
    {
        label: "Workforce",
        items: [
            { name: "Workers", href: "/owner/fixed-workers", icon: Users, translationKey: "workers", workflow: "workers" },
            { name: "Worker Hisaab", href: "/owner/payroll", icon: DollarSign, translationKey: "payroll", workflow: "payroll" },
            { name: "Upaad", href: "/owner/advances", icon: HandCoins, translationKey: "advances", workflow: "advances" },
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
    { name: "Party Orders", href: "/owner/orders", icon: Package, translationKey: "orders", workflow: "orders" },
    { name: "Market Runs", href: "/owner/market-runs", icon: Store, translationKey: "market_runs", workflow: "marketRuns" },
    { name: "Stock", href: "/owner/stock", icon: Warehouse, translationKey: "stock", workflow: "stock" },
    { name: "Cost Estimate", href: "/owner/estimator", icon: Calculator, translationKey: "estimator", workflow: "estimator" },
    { name: "Production", href: "/owner/production", icon: ClipboardList, translationKey: "production", workflow: "baseProduction" },
    { name: "Setup", href: "/owner/operations", icon: Wrench, translationKey: "settings", workflow: "baseProduction" },
    { name: "Worker Hisaab", href: "/owner/payroll", icon: DollarSign, translationKey: "payroll", workflow: "payroll" },
]

const liteBottomNavItems = [
    { name: "Cost Estimate", href: "/owner/estimator", icon: Calculator, translationKey: "estimator", workflow: "estimator" },
    { name: "Saved Costings", href: "/owner/quotes", icon: FileText, translationKey: "quotes", workflow: "estimator" },
    { name: "Rates", href: "/owner/rates", icon: Tags, translationKey: "settings", workflow: "estimator" },
]

function getNavLabel(item: { name: string; translationKey: string }, productionMode: ProductionMode, t: (key: string) => string) {
    if (item.name === 'Setup') return 'Setup'
    if (productionMode === 'market_run' && item.name === 'Stock') return 'Godown Stock'
    if (item.name === 'Quotations') return productionMode === 'market_run' ? 'Saved Costings' : 'Costings & Quotations'
    if (item.name === 'Analytics') return 'Analytics'
    return t(`nav.${item.translationKey}`) || item.name
}

function getMobileNavLabel(item: { name: string; translationKey: string }, productionMode: ProductionMode, t: (key: string) => string) {
    if (item.name === 'Factory Today') return 'Today'
    if (item.name === 'Market Runs') return 'Market'
    if (item.name === 'Stock' && productionMode === 'market_run') return 'Godown'
    return getNavLabel(item, productionMode, t)
}

interface OwnerSidebarProps {
    factoryName?: string
    userName?: string
    productionMode?: ProductionMode | null
    subscriptionTier?: SubscriptionTier
    yarnReviewDueCount?: number
}

function NavContent({ factoryName, userName, productionMode: rawProductionMode, subscriptionTier = 'none', yarnReviewDueCount = 0, onLinkClick }: OwnerSidebarProps & { onLinkClick?: () => void }) {
    const pathname = usePathname()
    const { t } = useTranslation()
    const productionMode = normalizeProductionMode(rawProductionMode)
    const hasLegacyWorkspace = hasCapability(subscriptionTier, 'legacy_full_suite')
    const hasProduction = hasCapability(subscriptionTier, 'production')
    const costingWorkspaceRoutes = new Set([
        '/owner/estimator',
        '/owner/quotes',
        '/owner/rates',
        '/owner/billing',
        '/owner/settings',
    ])
    if (hasProduction) {
        costingWorkspaceRoutes.add('/owner/production')
        costingWorkspaceRoutes.add('/owner/stock')
        costingWorkspaceRoutes.add('/owner/operations')
        costingWorkspaceRoutes.add('/owner/payroll')
    }
    const visibleGroups = navGroups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => {
                if (!hasLegacyWorkspace) return costingWorkspaceRoutes.has(item.href)
                return isWorkflowVisible(productionMode, item.workflow as WorkflowKey)
            }),
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
                            <p data-i18n-skip="true" className="truncate text-sm font-semibold leading-tight text-white">{factoryName}</p>
                            <p className="text-[11px] font-medium text-zinc-400">{hasLegacyWorkspace ? 'Owner control' : hasProduction ? 'Weavly Base workspace' : 'Weavly Lite workspace'}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 no-scrollbar">
                {visibleGroups.map((group, index) => (
                    <div key={group.label} className="space-y-1">
                        <div className={cn("px-3 mb-2", index > 0 && "mt-4")}>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                {!hasLegacyWorkspace && group.label === 'Control'
                                    ? 'Costing'
                                    : !hasLegacyWorkspace && group.label === 'Money'
                                      ? 'Plan'
                                      : !hasLegacyWorkspace && group.label === 'System'
                                        ? 'Account'
                                        : group.label}
                            </p>
                        </div>
                        {group.items.map((item) => {
                            const Icon = item.icon
                            const itemPath = item.href.split('#')[0]
                            const isActive = (item.name === 'Settings' || item.name === 'Factory Today')
                                ? pathname === itemPath
                                : pathname === itemPath || pathname.startsWith(itemPath + "/")

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
                                    <span className="relative shrink-0">
                                        <Icon className="h-[18px] w-[18px]" />
                                        {item.name === 'Yarn Rate Book' && yarnReviewDueCount > 0 && (
                                            <BellRing className="absolute -right-2.5 -top-2.5 h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-hidden="true" />
                                        )}
                                    </span>
                {!hasLegacyWorkspace && item.href === '/owner/quotes'
                  ? 'Saved Costings'
                  : !hasLegacyWorkspace && item.href === '/owner/payroll'
                    ? 'Payroll'
                  : item.name === 'Yarn Rate Book'
                    ? 'Yarn Rate Book'
                    : getNavLabel(item, productionMode, t)}
                                    {item.name === 'Yarn Rate Book' && yarnReviewDueCount > 0 && (
                                        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-black leading-none text-amber-950" aria-label={`${yarnReviewDueCount} yarn rates due for review`}>
                                            {yarnReviewDueCount > 99 ? '99+' : yarnReviewDueCount}
                                        </span>
                                    )}
                                </Link>
                            )
                        })}
                    </div>
                ))}
            </nav>

            {/* User footer */}
            <div className="border-t border-white/10 p-4">
                {userName && (
                    <p data-i18n-skip="true" className="mb-3 truncate text-xs font-medium text-zinc-400">{userName}</p>
                )}
                <div className="flex flex-col gap-3">
                    {!hasLegacyWorkspace && (
                        <Link href="/owner/billing" onClick={onLinkClick} className="flex min-h-10 items-center gap-3 rounded-lg px-2 py-1.5 text-sm font-semibold text-saffron hover:bg-saffron-deep hover:text-white">
                            <CreditCard className="h-[18px] w-[18px]" />
                            Subscription & Billing
                        </Link>
                    )}
                    <LanguageSwitcher className="text-saffron hover:bg-saffron-deep hover:text-white" />
                    <LogoutButton className="rounded-lg px-2 py-1.5 text-saffron hover:bg-saffron-deep hover:text-white" />
                </div>
            </div>
        </div>
    )
}

export function OwnerSidebar({ factoryName, userName, productionMode, subscriptionTier = 'none', yarnReviewDueCount = 0 }: OwnerSidebarProps) {
    const mobileKeyboardVisible = useMobileKeyboard()
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()
    const { t } = useTranslation()
    const normalizedProductionMode = normalizeProductionMode(productionMode)
    const hasLegacyWorkspace = hasCapability(subscriptionTier, 'legacy_full_suite')
    const hasProduction = hasCapability(subscriptionTier, 'production')
    const visibleBottomNavItems = hasLegacyWorkspace
        ? bottomNavItems.filter((item) => isWorkflowVisible(normalizedProductionMode, item.workflow as WorkflowKey)).slice(0, 5)
        : hasProduction
          ? bottomNavItems.filter((item) => ['/owner/estimator', '/owner/production', '/owner/stock', '/owner/operations', '/owner/payroll'].includes(item.href))
          : liteBottomNavItems
    const moreIsActive = !visibleBottomNavItems.some((item) => (
        pathname === item.href || pathname.startsWith(item.href + "/")
    ))

    return (
        <>
            {/* Desktop sidebar — persistent */}
            <aside className="hidden md:fixed md:inset-y-0 md:z-30 md:flex md:w-[248px] md:flex-col border-r border-white/10 bg-[#111111] shadow-[var(--shadow-card)]">
                <NavContent factoryName={factoryName} userName={userName} productionMode={normalizedProductionMode} subscriptionTier={subscriptionTier} yarnReviewDueCount={yarnReviewDueCount} />
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
                        subscriptionTier={subscriptionTier}
                        yarnReviewDueCount={yarnReviewDueCount}
                        onLinkClick={() => setIsOpen(false)}
                    />
                </SheetContent>
            </Sheet>

            {/* Mobile Bottom Navigation Form Factor */}
            <div style={mobileKeyboardVisible ? { display: 'none' } : undefined} className={cn(
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
                    const navLabel = !hasLegacyWorkspace && item.href === '/owner/quotes'
                        ? 'Saved Costings'
                        : !hasLegacyWorkspace && item.href === '/owner/rates'
                          ? 'Yarn Rate Book'
                          : !hasLegacyWorkspace && item.href === '/owner/payroll'
                        ? 'Payroll'
                        : getNavLabel(item, normalizedProductionMode, t)
                    const mobileNavLabel = !hasLegacyWorkspace && item.href === '/owner/quotes'
                        ? 'Saved'
                        : !hasLegacyWorkspace && item.href === '/owner/rates'
                          ? 'Rates'
                          : !hasLegacyWorkspace && item.href === '/owner/payroll'
                        ? 'Payroll'
                        : getMobileNavLabel(item, normalizedProductionMode, t)

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "mobile-nav-item flex min-w-0 flex-col items-center justify-center relative",
                                "py-1 px-0.5 transition-all duration-300",
                                isActive ? "text-saffron-deep" : "text-body"
                            )}
                            aria-label={navLabel}
                            title={navLabel}
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
                                {mobileNavLabel}
                            </span>
                            {isActive && (
                                <span className="premium-nav-indicator absolute -top-px left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-saffron" />
                            )}
                        </Link>
                    )
                })}
                
                {/* More button to trigger the sheet */}
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    aria-label={t('common.navigation')}
                    aria-pressed={moreIsActive}
                    className={cn(
                        "mobile-nav-item flex min-w-0 flex-col items-center justify-center relative",
                        "py-1 px-0.5 transition-colors duration-200 motion-reduce:transition-none",
                        moreIsActive ? "text-saffron-deep" : "text-body"
                    )}
                >
                    <div className={cn(
                        "mobile-nav-icon-pill mb-0.5 rounded-xl px-2 py-1 transition-all duration-200 motion-reduce:transition-none xs:px-3 landscape:px-2 landscape:py-0.5",
                        moreIsActive ? "scale-105 bg-saffron-soft" : "hover:bg-surface-soft"
                    )}>
                        <Menu className="h-5 w-5 landscape:h-4 landscape:w-4" />
                    </div>
                    <span className={cn("mobile-nav-label text-[10px] font-semibold leading-none landscape:text-[9px]", moreIsActive ? "opacity-100" : "opacity-80")}>
                        {t('common.menu')}
                    </span>
                    {moreIsActive && (
                        <span className="premium-nav-indicator absolute -top-px left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-saffron" />
                    )}
                </button>
            </div>
        </>
    )
}
