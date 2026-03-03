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
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname.startsWith(item.href)

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors min-w-[120px]",
                                isActive
                                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
                                    : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-200"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {item.name}
                        </Link>
                    )
                })}
            </div>

            {/* Mobile Bottom Navigation Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center z-50 px-2 py-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname.startsWith(item.href)

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center py-1.5 px-1 w-full relative",
                                isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900"
                            )}
                        >
                            <div className={cn(
                                "p-1 rounded-full mb-1 transition-colors duration-200",
                                isActive ? "bg-blue-100/50" : "group-hover:bg-gray-100"
                            )}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-medium leading-none tracking-tight">{item.name}</span>
                        </Link>
                    )
                })}
            </div>
        </>
    )
}
