"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ClipboardList, ClipboardCheck, Users, Settings, Calendar, Menu, ShieldAlert } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n/context"


export const navItems = [
    { name: "Shift Setup", href: "/supervisor/assignments", icon: ClipboardCheck, translationKey: "assignments" },
    { name: "Log Production", href: "/supervisor/production", icon: ClipboardList, translationKey: "production" },
    { name: "Workers", href: "/supervisor/workers", icon: Users, translationKey: "workers" },
    { name: "Machines", href: "/supervisor/machines", icon: Settings, translationKey: "machines" },
    { name: "Attendance", href: "/supervisor/attendance", icon: Calendar, translationKey: "attendance" },
    { name: "Incidents", href: "/supervisor/incidents", icon: ShieldAlert, translationKey: "incidents" },
]

// Primary tabs shown in the bottom bar (4 items)
const primaryNavItems = [
    { name: "Shift Setup", href: "/supervisor/assignments", icon: ClipboardCheck, translationKey: "assignments" },
    { name: "Log Production", href: "/supervisor/production", icon: ClipboardList, translationKey: "production" },
    { name: "Workers", href: "/supervisor/workers", icon: Users, translationKey: "workers" },
    { name: "Attendance", href: "/supervisor/attendance", icon: Calendar, translationKey: "attendance" },
]

// Items shown in the "More" sheet drawer
const moreNavItems = [
    { name: "Machines", href: "/supervisor/machines", icon: Settings, translationKey: "machines" },
    { name: "Incidents", href: "/supervisor/incidents", icon: ShieldAlert, translationKey: "incidents" },
]

export function SupervisorNav() {
    const pathname = usePathname()
    const { t } = useTranslation()

    return (
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
                            {/* Fallback pattern like owner navbar so the english string overrides untranslated keys for now */}
                            {t(`nav.${item.translationKey}`) || item.name}
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

export function SupervisorRoleLabel() {
    const { t } = useTranslation()
    return (
        <span className="text-[10px] uppercase tracking-widest text-teal-600 font-bold">
            {t('common.supervisor')}
        </span>
    )
}

export function MobileSupervisorNav() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)
    const { t } = useTranslation()

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="md:hidden h-10 w-10 text-gray-500 hover:text-primary hover:bg-primary/5"
                >
                    <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
                <SheetHeader className="p-6 border-b text-left">
                    <SheetTitle className="text-xl font-bold">{t('common.menu')}</SheetTitle>
                    <SheetDescription>
                        {t('common.navigate')}
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
                                onClick={() => setOpen(false)}
                                className={cn(
                                    "flex items-center gap-4 px-6 py-4 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary/10 text-primary border-r-4 border-primary"
                                        : "text-muted-foreground hover:bg-muted"
                                )}
                            >
                                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                                {t(`nav.${item.translationKey}`) || item.name}
                            </Link>
                        )
                    })}
                </nav>
            </SheetContent>
        </Sheet>
    )
}

/**
 * Mobile bottom navigation bar for supervisor dashboard.
 * Shows 4 primary tabs + "More" button which opens a Sheet with remaining items.
 * Mirrors the owner dashboard's bottom nav pattern.
 */
export function MobileSupervisorBottomNav() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)
    const { t } = useTranslation()

    // Check if any "more" item is currently active (so we can highlight the More button)
    const isMoreActive = moreNavItems.some(item => pathname.startsWith(item.href))

    return (
        <>
            {/* Mobile Bottom Navigation Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border flex justify-around items-center z-50 px-2 pb-safe pt-1.5 shadow-[0_-4px_12px_-1px_rgba(0,0,0,0.05)] h-[68px]">
                {primaryNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname.startsWith(item.href)

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
                                {t(`nav.${item.translationKey}`) || item.name}
                            </span>
                            {isActive && (
                                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                            )}
                        </Link>
                    )
                })}

                {/* More button */}
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <button
                            className={cn(
                                "flex flex-col items-center justify-center py-1 px-1 w-full relative h-full transition-all duration-300",
                                isMoreActive ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <div className={cn(
                                "py-1.5 px-4 rounded-xl mb-1 transition-all duration-300",
                                isMoreActive ? "bg-primary/15" : "hover:bg-black/5"
                            )}>
                                <Menu className={cn("h-5 w-5", isMoreActive && "stroke-[2.5px]")} />
                            </div>
                            <span className={cn(
                                "text-[10px] font-bold leading-none tracking-tight",
                                isMoreActive ? "opacity-100" : "opacity-70"
                            )}>
                                {t('common.menu') || "More"}
                            </span>
                            {isMoreActive && (
                                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                            )}
                        </button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
                        <SheetHeader className="pb-4 text-left">
                            <SheetTitle className="text-base font-bold">More Options</SheetTitle>
                        </SheetHeader>
                        <nav className="grid grid-cols-2 gap-3 pb-4">
                            {moreNavItems.map((item) => {
                                const Icon = item.icon
                                const isActive = pathname.startsWith(item.href)
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-semibold transition-all",
                                            isActive
                                                ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                                                : "bg-muted/60 text-foreground hover:bg-muted"
                                        )}
                                    >
                                        <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                                        {t(`nav.${item.translationKey}`) || item.name}
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
