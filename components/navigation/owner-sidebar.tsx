"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { signOut } from "@/app/(auth)/actions"
import { cn } from "@/lib/utils"
import {
    BarChart3,
    Server,
    Users,
    DollarSign,
    Settings,
    LogOut,
    Menu,
    X,
    Activity,
    HandCoins,
    PackageSearch,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import LogoutButton from "@/components/auth/logout-button"

const primaryNavItems = [
    { name: "Dashboard", href: "/owner/analytics", icon: BarChart3 },
    { name: "Machines", href: "/owner/machines", icon: Server },
    { name: "Workers", href: "/owner/fixed-workers", icon: Users },
    { name: "Payroll", href: "/owner/payroll", icon: DollarSign },
    { name: "Advances", href: "/owner/advances", icon: HandCoins },
    { name: "Inventory", href: "/owner/inventory", icon: PackageSearch },
]

const secondaryNavItems = [
    { name: "System Health", href: "/owner/system-health", icon: Activity },
    { name: "Settings", href: "/owner/settings", icon: Settings },
]

interface OwnerSidebarProps {
    factoryName?: string
    userName?: string
}

function NavContent({ factoryName, userName, onLinkClick }: OwnerSidebarProps & { onLinkClick?: () => void }) {
    const pathname = usePathname()

    return (
        <div className="flex flex-col h-full bg-sidebar">
            {/* Factory branding */}
            <div className="p-5 border-b border-sidebar-border flex items-center gap-3">
                <div className="relative h-10 w-10 shrink-0">
                    <Image src="/logo.png" alt="Vastra Logo" fill className="object-contain" />
                </div>
                <div className="flex flex-col overflow-hidden">
                    <h2 className="text-base font-semibold text-sidebar-foreground truncate">
                        {factoryName || "Vastra"}
                    </h2>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                        Owner Panel
                    </span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-1">
                <div className="space-y-1">
                    {[...primaryNavItems, ...secondaryNavItems].map((item) => {
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
                                        ? "bg-primary text-primary-foreground shadow-[0_4px_14px_0_oklch(0.65_0.20_40/0.3)]"
                                        : "text-muted-foreground hover:text-sidebar-foreground hover:bg-black/5 dark:hover:bg-white/5"
                                )}
                            >
                                <Icon className="h-[18px] w-[18px]" />
                                {item.name}
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
                <LogoutButton />
            </div>
        </div>
    )
}

export function OwnerSidebar({ factoryName, userName }: OwnerSidebarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()

    return (
        <>
            {/* Desktop sidebar — persistent */}
            <aside className="hidden md:flex md:w-[260px] md:flex-col md:fixed md:inset-y-0 bg-sidebar border-r border-sidebar-border z-30">
                <NavContent factoryName={factoryName} userName={userName} />
            </aside>

            {/* Mobile header bar */}
            <header className="md:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                    <div className="relative h-8 w-8 shrink-0 bg-primary/10 rounded-lg p-1">
                        <Image src="/logo.png" alt="Vastra Logo" fill className="object-contain p-1" />
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-sm font-bold text-foreground leading-tight truncate max-w-[150px]">
                            {factoryName || "Vastra"}
                        </h2>
                        <div className="flex items-center gap-1.5">
                            <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                            <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-bold">
                                Owner Panel
                            </span>
                        </div>
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
                        className="w-[280px] p-0 bg-sidebar border-sidebar-border"
                    >
                        <SheetHeader className="sr-only">
                            <SheetTitle>Navigation</SheetTitle>
                        </SheetHeader>
                        <NavContent
                            factoryName={factoryName}
                            userName={userName}
                            onLinkClick={() => setIsOpen(false)}
                        />
                    </SheetContent>
                </Sheet>
            </header>

            {/* Mobile Bottom Navigation Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border flex justify-around items-center z-50 px-2 pb-safe pt-1.5 shadow-[0_-4px_12px_-1px_rgba(0,0,0,0.05)] h-[68px]">
                {primaryNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center py-1 px-1 w-full relative h-full transition-all duration-300",
                                isActive ? "text-primary scale-110" : "text-muted-foreground"
                            )}
                        >
                            <div className={cn(
                                "py-1.5 px-4 rounded-xl mb-1 transition-all duration-300",
                                isActive ? "bg-primary/15" : "hover:bg-black/5"
                            )}>
                                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
                            </div>
                            <span className={cn(
                                "text-[10px] font-bold leading-none tracking-tight",
                                isActive ? "opacity-100" : "opacity-70"
                            )}>
                                {item.name}
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
                    className="flex flex-col items-center justify-center py-1 px-1 w-full relative h-full text-muted-foreground"
                >
                    <div className="py-1.5 px-4 rounded-xl mb-1 hover:bg-black/5 transition-all">
                        <Menu className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-bold leading-none tracking-tight opacity-70">More</span>
                </button>
            </div>
        </>
    )
}
