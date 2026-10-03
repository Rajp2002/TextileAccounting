'use client'

import type { FormEvent } from 'react'
import { useRef, useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AuthTransition } from './auth-transition'
import { captureAuthHandoff } from './auth-handoff'
import { useTranslation } from '@/lib/i18n/context'
import { detachActiveQueryNamespace } from '@/lib/query-client-registry'
import {
    createLogoutTraceId,
    markLogoutTraceStage,
    recordLogoutCleanupCompleted,
    startLogoutTrace,
} from '@/lib/logout-trace'
import {
    clearUserCacheFromStorage,
    scheduleClientSessionCleanup,
} from '@/lib/client-storage-cleanup'

interface LogoutButtonProps {
    variant?: 'sidebar' | 'header'
    className?: string
}

export default function LogoutButton({ variant = 'sidebar', className }: LogoutButtonProps) {
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [traceId, setTraceId] = useState<string | null>(null)
    const formRef = useRef<HTMLFormElement>(null)
    const traceInputRef = useRef<HTMLInputElement>(null)
    const readyForServerLogoutRef = useRef(false)
    const { t } = useTranslation()

    // The sign-out POST leaves at once, exactly as the native form post did, so
    // the session ends while the spool turns. As soon as the server has cleared
    // the cookies, a full-page GET opens /login; the spool is handed to it, so
    // /login loads behind the animation and the spool leaves when its round ends.
    // This deliberately avoids a deployment-sensitive Server Action transition.
    const signOutBehindTransition = async (logoutTraceId: string, transitionStartedAt: number) => {
        const form = formRef.current
        if (!form) return

        let signedOut = false
        try {
            // The 303 to /login is not followed here; its Set-Cookie still
            // clears the session, and the page navigates below.
            const response = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                credentials: 'same-origin',
                redirect: 'manual',
                cache: 'no-store',
            })
            signedOut = response.type === 'opaqueredirect'
        } catch {
            // Offline or blocked: the native form post below reports it.
        }

        if (signedOut) {
            markLogoutTraceStage(logoutTraceId, 'signout_navigation_started')
            captureAuthHandoff(transitionStartedAt)
            window.location.replace('/login')
            return
        }

        // Anything but the expected redirect falls back to the native POST,
        // whose response the browser shows as it always has. The original submit
        // event was already handled and cancelled; the submit-event helper would
        // re-enter it and can leave the UI loading without navigating.
        markLogoutTraceStage(logoutTraceId, 'signout_navigation_started')
        formRef.current?.submit()
    }

    const handleLogout = (event: FormEvent<HTMLFormElement>) => {
        if (readyForServerLogoutRef.current) return

        event.preventDefault()
        const transitionStartedAt = performance.now()
        const nextTraceId = createLogoutTraceId()
        setTraceId(nextTraceId)
        if (traceInputRef.current) traceInputRef.current.value = nextTraceId
        startLogoutTrace(nextTraceId)
        setIsLoggingOut(true)

        // Namespace detachment is the synchronous security boundary. Physical
        // browser storage deletion is normally housekeeping, but estimator
        // drafts are cleared synchronously so a full-page sign-out cannot
        // expose the previous principal's recoverable work to the next login.
        const retiredScope = detachActiveQueryNamespace()
        markLogoutTraceStage(nextTraceId, 'cache_namespace_rotated')
        try {
            clearUserCacheFromStorage(window.localStorage, {
                scope: retiredScope,
                clearScope: true,
                includeLegacy: true,
            })
        } catch {
            // Deferred cleanup below retries if storage is temporarily blocked.
        }
        scheduleClientSessionCleanup({
            scope: retiredScope,
            onComplete: (result) => recordLogoutCleanupCompleted(nextTraceId, result),
        })

        readyForServerLogoutRef.current = true
        void signOutBehindTransition(nextTraceId, transitionStartedAt)
    }

    if (variant === 'header') {
        return (
            <>
                <form ref={formRef} action="/auth/signout" method="post" onSubmit={handleLogout}>
                    <input ref={traceInputRef} type="hidden" name="traceId" value={traceId ?? ''} />
                    <button
                        type="submit"
                        disabled={isLoggingOut}
                        className={cn(
                            "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-black/5 h-9 px-3 text-subtle hover:text-ink",
                            className
                        )}
                    >
                        {isLoggingOut ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        {t('common.logout')}
                    </button>
                </form>
                <AuthTransition open={isLoggingOut} mode="sign-out" />
            </>
        )
    }

    return (
        <>
            <form ref={formRef} action="/auth/signout" method="post" onSubmit={handleLogout}>
                <input ref={traceInputRef} type="hidden" name="traceId" value={traceId ?? ''} />
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
            <AuthTransition open={isLoggingOut} mode="sign-out" />
        </>
    )
}
