"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ClipboardList, ClipboardCheck, Users, Settings, Calendar } from "lucide-react"

const navItems = [
    { name: "Production", href: "/supervisor/production", icon: ClipboardList },
    { name: "Assignments", href: "/supervisor/assignments", icon: ClipboardCheck },
    { name: "Workers", href: "/supervisor/workers", icon: Users },
    { name: "Machines", href: "/supervisor/machines", icon: Settings },
    { name: "Attendance", href: "/supervisor/attendance", icon: Calendar },
]

export function SupervisorNav() {
    const pathname = usePathname()

    return (
        <>
            {/* Desktop Top Navigation Tabs */}
            <div className="hidden md:flex flex-row overflow-x-auto border-t border-gray-100 bg-white">
                <div className="max-w-5xl w-full mx-auto flex">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname.startsWith(item.href)

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-4 px-4 text-sm font-medium border-b-2 transition-colors min-w-[120px]",
                                    isActive
                                        ? "border-primary text-primary bg-primary/10"
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-black/5 hover:border-border dark:hover:bg-white/5"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.name}
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* Mobile Bottom Navigation Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center z-50 px-2 pb-safe pt-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] h-[64px] pb-safe">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname.startsWith(item.href)

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center py-1 px-1 w-full relative h-full",
                                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <div className={cn(
                                "py-1 px-4 rounded-full mb-1 transition-colors duration-200",
                                isActive ? "bg-primary/20" : "group-hover:bg-black/5 dark:group-hover:bg-white/5"
                            )}>
                                <Icon className={cn("h-5 w-5", isActive && "fill-primary/20 text-primary")} />
                            </div>
                            <span className="text-[10px] sm:text-xs font-semibold leading-none tracking-tight">{item.name}</span>
                        </Link>
                    )
                })}
            </div>
        </>
    )
}

