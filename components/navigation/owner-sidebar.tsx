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
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useState } from "react"

const navItems = [
    { name: "Dashboard", href: "/owner/analytics", icon: BarChart3 },
    { name: "Machines", href: "/owner/machines", icon: Server },
    { name: "Fixed Workers", href: "/owner/fixed-workers", icon: Users },
    { name: "Payroll", href: "/owner/payroll", icon: DollarSign },
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
                {navItems.map((item) => {
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
            </nav>

            {/* User footer */}
            <div className="border-t border-sidebar-border p-4">
                {userName && (
                    <p className="text-xs text-muted-foreground mb-3 truncate">{userName}</p>
                )}
                <form action={signOut}>
                    <button
                        type="submit"
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-sidebar-foreground transition-colors w-full"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        Log out
                    </button>
                </form>
            </div>
        </div>
    )
}

export function OwnerSidebar({ factoryName, userName }: OwnerSidebarProps) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            {/* Desktop sidebar — persistent */}
            <aside className="hidden md:flex md:w-[260px] md:flex-col md:fixed md:inset-y-0 bg-sidebar border-r border-sidebar-border z-30">
                <NavContent factoryName={factoryName} userName={userName} />
            </aside>

            {/* Mobile header bar */}
            <header className="md:hidden sticky top-0 z-30 bg-background border-b border-border flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="relative h-9 w-9 shrink-0">
                        <Image src="/logo.png" alt="Vastra Logo" fill className="object-contain" />
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-sm font-semibold text-foreground truncate">
                            {factoryName || "Vastra"}
                        </h2>
                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">
                            Owner
                        </span>
                    </div>
                </div>
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-foreground hover:bg-black/5 dark:hover:bg-white/5">
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
        </>
    )
}
