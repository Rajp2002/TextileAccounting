"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Server, Users, DollarSign, Activity, Settings, Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useState } from "react"

const navItems = [
    { name: "Machines", href: "/owner/machines", icon: Server },
    { name: "Fixed Workers", href: "/owner/fixed-workers", icon: Users },
    { name: "Payroll", href: "/owner/payroll", icon: DollarSign },
    { name: "System Health", href: "/owner/system-health", icon: Activity },
    { name: "Settings", href: "/owner/settings", icon: Settings },
]

export function OwnerNav() {
    const pathname = usePathname()
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname.startsWith(item.href)

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200",
                                isActive
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {item.name}
                        </Link>
                    )
                })}
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden flex items-center">
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Toggle Menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[280px] sm:w-[350px]">
                        <SheetHeader>
                            <SheetTitle className="text-left">Navigation</SheetTitle>
                        </SheetHeader>
                        <div className="flex flex-col gap-1 mt-6">
                            {navItems.map((item) => {
                                const Icon = item.icon
                                const isActive = pathname.startsWith(item.href)

                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setIsOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-colors",
                                            isActive
                                                ? "bg-blue-50 text-blue-700"
                                                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                        )}
                                    >
                                        <Icon className="h-5 w-5" />
                                        {item.name}
                                    </Link>
                                )
                            })}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </>
    )
}
