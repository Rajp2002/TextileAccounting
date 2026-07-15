'use client'

import type { FormEvent } from 'react'
import { useRef } from 'react'
import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import LoadingModal from './loading-modal'
import { useTranslation } from '@/lib/i18n/context'

import { globalQueryClient } from '@/components/providers'
import { clearClientSessionState } from '@/lib/client-storage-cleanup'

interface LogoutButtonProps {
    variant?: 'sidebar' | 'header'
    className?: string
}

export default function LogoutButton({ variant = 'sidebar', className }: LogoutButtonProps) {
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const formRef = useRef<HTMLFormElement>(null)
    const readyForServerLogoutRef = useRef(false)
    const { t } = useTranslation()

    const handleLogout = async (event: FormEvent<HTMLFormElement>) => {
        if (readyForServerLogoutRef.current) return

        event.preventDefault()
        setIsLoggingOut(true)
        // Clear React Query cache immediately to prevent session leakage
        if (globalQueryClient) {
            globalQueryClient.clear()
        }

        try {
            await clearClientSessionState()
        } catch (error) {
            console.warn('Unable to complete client session cleanup before logout', error)
        }

        readyForServerLogoutRef.current = true
        formRef.current?.requestSubmit()
        // The native POST response performs a full-page redirect to /login.
        // This deliberately avoids a deployment-sensitive Server Action transition.
    }

    if (variant === 'header') {
        return (
            <>
                <form ref={formRef} action="/auth/signout" method="post" onSubmit={handleLogout}>
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
                        {t('common.logout')}
                    </button>
                </form>
                <LoadingModal isOpen={isLoggingOut} message={t('common.signing_out')} />
            </>
        )
    }

    return (
        <>
            <form ref={formRef} action="/auth/signout" method="post" onSubmit={handleLogout}>
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
                    {t('nav.logout')}
                </button>
            </form>
            <LoadingModal isOpen={isLoggingOut} message={t('common.signing_out')} />
        </>
    )
}
