"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
        <div className="flex flex-col h-full">
            {/* Factory branding */}
            <div className="p-5 border-b border-slate-800">
                <h2 className="text-base font-semibold text-white truncate">
                    {factoryName || "Textile SaaS"}
                </h2>
                <span className="text-[10px] uppercase tracking-widest text-indigo-300 font-medium">
                    Owner Panel
                </span>
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
                                    ? "bg-indigo-600/20 text-white border-l-[3px] border-indigo-400 pl-[9px]"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                            )}
                        >
                            <Icon className={cn("h-[18px] w-[18px]", isActive && "text-indigo-400")} />
                            {item.name}
                        </Link>
                    )
                })}
            </nav>

            {/* User footer */}
            <div className="border-t border-slate-800 p-4">
                {userName && (
                    <p className="text-xs text-gray-500 mb-3 truncate">{userName}</p>
                )}
                <form action="/api/auth/signout" method="POST">
                    <button
                        type="submit"
                        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full"
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
            <aside className="hidden md:flex md:w-[260px] md:flex-col md:fixed md:inset-y-0 bg-slate-900 z-30">
                <NavContent factoryName={factoryName} userName={userName} />
            </aside>

            {/* Mobile header bar */}
            <header className="md:hidden sticky top-0 z-30 bg-slate-900 text-white flex items-center justify-between px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold truncate">
                        {factoryName || "Textile SaaS"}
                    </h2>
                    <span className="text-[9px] uppercase tracking-widest text-indigo-300 font-medium">
                        Owner
                    </span>
                </div>
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Open navigation</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="left"
                        className="w-[280px] p-0 bg-slate-900 border-slate-800 [&>button]:text-white"
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
