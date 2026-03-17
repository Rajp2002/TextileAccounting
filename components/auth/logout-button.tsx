'use client'

import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import { signOut } from '@/app/(auth)/actions'
import { cn } from '@/lib/utils'
import LoadingModal from './loading-modal'

interface LogoutButtonProps {
    variant?: 'sidebar' | 'header'
    className?: string
}

export default function LogoutButton({ variant = 'sidebar', className }: LogoutButtonProps) {
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const handleLogout = async (e: React.FormEvent) => {
        setIsLoggingOut(true)
        // The signOut action will handle the redirect
        // We just need to show the loading state until then
    }

    if (variant === 'header') {
        return (
            <>
                <form action={signOut} onSubmit={handleLogout}>
                    <button
                        type="submit"
                        disabled={isLoggingOut}
                        className={cn(
                            "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-black/5 h-9 px-3 text-gray-500 hover:text-gray-900",
                            className
                        )}
                    >
                        {isLoggingOut ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Logout
                    </button>
                </form>
                <LoadingModal isOpen={isLoggingOut} message="Signing out securely..." />
            </>
        )
    }

    return (
        <>
            <form action={signOut} onSubmit={handleLogout}>
                <button
                    type="submit"
                    disabled={isLoggingOut}
                    className={cn(
                        "flex items-center gap-2 text-xs text-muted-foreground hover:text-sidebar-foreground transition-colors w-full",
                        className
                    )}
                >
                    {isLoggingOut ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <LogOut className="h-3.5 w-3.5" />
                    )}
                    Log out
                </button>
            </form>
            <LoadingModal isOpen={isLoggingOut} message="Signing out securely..." />
        </>
    )
}
