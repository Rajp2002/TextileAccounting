'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { globalQueryClient } from '@/lib/query-client-registry'

/** Memory-only data. Revalidate before showing a restored or switched session. */
export function useSensitiveSessionBoundary(userId: string, kind: 'founder' | 'customer' | 'founder_candidate', surface: RefObject<HTMLDivElement | null>, sessionTag?: string) {
    const [message, setMessage] = useState<string | null>(CHECKING_SESSION_MESSAGE)
    const [invalidated, setInvalidated] = useState(false)
    const [generation, setGeneration] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        let lastInteractiveAt = 0
        let sequence = 0
        let stopped = false
        const endpoint = kind === 'founder_candidate' ? '/api/admin/auth/session' : kind === 'founder' ? '/api/admin/session' : '/api/support/session'
        const conceal = () => {
            if (surface.current) surface.current.hidden = true
            globalQueryClient?.clear()
        }
        const invalidate = () => {
            stopped = true
            conceal()
            // Unmount old data and drafts even if navigation is delayed or
            // blocked. A new keyed visible subtree must never flash here.
            setInvalidated(true)
            setMessage('Your session changed. Returning to sign-in…')
            window.location.replace(kind === 'customer' ? '/login' : '/admin/login')
        }
        const verify = async (concealFirst = true) => {
            if (stopped) return
            const current = ++sequence
            if (concealFirst) {
                conceal()
                setMessage(CHECKING_SESSION_MESSAGE)
            }
            try {
                const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal, credentials: 'same-origin' })
                if (current !== sequence || stopped) return
                if (response.status === 401 || response.status === 403) { invalidate(); return }
                if (!response.ok) throw new Error('Session unavailable')
                const principal = await response.json() as { userId?: string; sessionTag?: string }
                if (principal.userId !== userId || (sessionTag && principal.sessionTag !== sessionTag)) { invalidate(); return }
                setMessage(null)
                if (surface.current) surface.current.hidden = false
            } catch {
                if (controller.signal.aborted || current !== sequence || stopped) return
                conceal()
                setMessage('Your session cannot be verified. Reconnect, then reload this page.')
            }
        }
        const onPageShow = (event: PageTransitionEvent) => {
            if (event.persisted) { setGeneration(value => value + 1); void verify() }
        }
        const onHistoryRestore = () => {
            // Next may restore a cached tree without a document pageshow.
            // Conceal synchronously, then check the live principal before reveal.
            conceal()
            setGeneration(value => value + 1)
            void verify()
        }
        const onFocus = () => { void verify() }
        const onOffline = () => {
            ++sequence
            conceal()
            setMessage('You are offline. Reconnect to view this private page.')
        }
        const onInteractive = (event: Event) => {
            // A read/poll/prefetch does not keep the founder session active.
            if (kind !== 'founder' || !event.isTrusted || stopped || document.visibilityState !== 'visible') return
            const now = Date.now()
            if (now - lastInteractiveAt < 60_000) return
            lastInteractiveAt = now
            void fetch(endpoint, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
                .then(response => { if (response.status === 401 || response.status === 403) invalidate() })
                .catch(() => { /* The authoritative guard still fails closed on the next request. */ })
        }
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') conceal()
            else void verify()
        }
        // A cached router subtree can remount on back/forward navigation.
        // Begin concealed and verify every new mount before revealing it.
        void verify()
        const { data: { subscription } } = createClient().auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
            if (event === 'SIGNED_OUT' || (session && session.user.id !== userId)) invalidate()
            else if (event === 'SIGNED_IN') void verify()
        })
        window.addEventListener('pagehide', conceal)
        window.addEventListener('pageshow', onPageShow)
        window.addEventListener('popstate', onHistoryRestore)
        window.addEventListener('focus', onFocus)
        window.addEventListener('offline', onOffline)
        window.addEventListener('online', onFocus)
        window.addEventListener('pointerdown', onInteractive)
        window.addEventListener('keydown', onInteractive)
        document.addEventListener('visibilitychange', onVisibility)
        // Revocation and server expiry are observed without extending idle time.
        const sessionCheck = window.setInterval(() => {
            if (document.visibilityState === 'visible') void verify(false)
        }, 60_000)
        return () => {
            stopped = true
            controller.abort()
            window.clearInterval(sessionCheck)
            subscription.unsubscribe()
            window.removeEventListener('pagehide', conceal)
            window.removeEventListener('pageshow', onPageShow)
            window.removeEventListener('popstate', onHistoryRestore)
            window.removeEventListener('focus', onFocus)
            window.removeEventListener('offline', onOffline)
            window.removeEventListener('online', onFocus)
            window.removeEventListener('pointerdown', onInteractive)
            window.removeEventListener('keydown', onInteractive)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [userId, kind, surface, sessionTag])

    return { message, invalidated, generation }
}

export const CHECKING_SESSION_MESSAGE = 'Checking your session…'

/** `checkingFallback` replaces the plain "checking" text while the session check runs; errors still show their message. */
export function SensitiveBoundary({ userId, kind, sessionTag, className, surfaceClassName, checkingFallback, children }: { userId: string; kind: 'founder' | 'customer' | 'founder_candidate'; sessionTag?: string; className?: string; surfaceClassName?: string; checkingFallback?: React.ReactNode; children: React.ReactNode }) {
    const surface = useRef<HTMLDivElement>(null)
    const { message, invalidated, generation } = useSensitiveSessionBoundary(userId, kind, surface, sessionTag)
    const showFallback = message === CHECKING_SESSION_MESSAGE && checkingFallback
    return <div data-sensitive-surface="true" data-sentry-block="true" className={className}>
        {showFallback && checkingFallback}
        {message && !showFallback && <div role="status" className="mx-auto max-w-2xl p-8 text-sm text-ink">
            <p>{message}</p>
            <a className="mt-4 inline-block underline" href={kind === 'founder_candidate' ? '/admin/verify' : kind === 'founder' ? '/admin' : '/support'}>Reload safely</a>
        </div>}
        {!invalidated && <div ref={surface} hidden={Boolean(message)} className={surfaceClassName} key={`${userId}:${generation}`}>{children}</div>}
    </div>
}
