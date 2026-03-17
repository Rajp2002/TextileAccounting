"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ClipboardList, ClipboardCheck, Users, Settings, Calendar, Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"


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

            {/* Mobile Navigation (Hamburger Menu) */}
            <div className="md:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 z-50 transition-transform active:scale-95"
                        >
                            <Menu className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[280px] p-0">
                        <SheetHeader className="p-6 border-b text-left">
                            <SheetTitle className="text-xl font-bold">Menu</SheetTitle>
                            <SheetDescription>
                                Navigate through supervisor features
                            </SheetDescription>
                        </SheetHeader>
                        <nav className="flex flex-col py-4">
                            {navItems.map((item) => {
                                const Icon = item.icon
                                const isActive = pathname.startsWith(item.href)

                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-4 px-6 py-4 text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-primary/10 text-primary border-r-4 border-primary"
                                                : "text-muted-foreground hover:bg-muted"
                                        )}
                                    >
                                        <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                                        {item.name}
                                    </Link>
                                )
                            })}
                        </nav>
                    </SheetContent>
                </Sheet>
            </div>

        </>
    )
}

