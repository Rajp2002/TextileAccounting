'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

/**
 * PWA Session Guard
 *
 * Problem: When a user swipes the Loomi PWA away from iOS multitasking, the
 * next cold open would previously wait 6-7 seconds (3 sequential server
 * round-trips: middleware auth check → layout requireRole → DB org lookup)
 * before showing anything — manifesting as a black screen then white screen.
 *
 * Solution: Use `sessionStorage` as a "alive" flag.
 *
 * - sessionStorage IS preserved when the app is backgrounded (user switches
 *   apps but doesn't kill it) — so backgrounding does NOT log you out.
 * - sessionStorage IS cleared when the PWA process is killed (swipe away
 *   from multitasking, or device restart) — so cold opens sign you out.
 *
 * On the next cold open, the missing flag triggers a client-side signOut
 * before any server round-trips happen, then redirects to /login which is
 * a fast static page with zero auth overhead.
 */

const SESSION_KEY = 'loomi_pwa_session_alive'

export function usePwaSessionGuard() {
    const router = useRouter()

    useEffect(() => {
        // Only activate in standalone PWA mode
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true

        if (!isStandalone) return

        const supabase = createClient()

        async function checkAndGuard() {
            const isAlive = sessionStorage.getItem(SESSION_KEY)

            if (!isAlive) {
                // sessionStorage is empty → app was killed (cold start).
                // Sign out to force fresh login instead of a slow redirected resume.
                const { data: { session } } = await supabase.auth.getSession()

                if (session) {
                    // Clear the server-side session and the inactivity cookie
                    await supabase.auth.signOut()
                    // Remove the inactivity cookie the middleware reads
                    document.cookie = 'last_activity=; Max-Age=0; path=/'
                }

                // Mark session as alive for this run so re-renders don't re-trigger
                sessionStorage.setItem(SESSION_KEY, '1')

                if (session) {
                    // Was logged in → redirect to login
                    // Replace so the back button doesn't bring them back to dashboard
                    router.replace('/login')
                }
                return
            }
        }

        // Run the guard immediately on mount
        checkAndGuard()

        // Keep the flag alive while the app is in the foreground
        function onVisibilityChange() {
            if (document.visibilityState === 'visible') {
                // App came back to foreground (not killed) — refresh the flag
                sessionStorage.setItem(SESSION_KEY, '1')
            }
        }

        // pagehide fires when the PWA is unloaded (before kill).
        // We intentionally do NOT remove the key here — we want the key to
        // survive a normal background/resume cycle. The key is only absent
        // after the OS clears sessionStorage on process kill.
        // (The OS clears sessionStorage automatically on kill — we don't need
        // to remove it manually.)
        document.addEventListener('visibilitychange', onVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [router])
}
