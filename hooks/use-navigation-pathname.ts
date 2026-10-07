'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import {
    clearNavigationIntent,
    getNavigationIntent,
    getServerNavigationIntent,
    resolveNavigationPathname,
    subscribeNavigationIntent,
} from '@/lib/navigation-intent'

/** The page navigation chrome shows as current: a tapped destination until the router commits. */
export function useNavigationPathname() {
    const pathname = usePathname()
    const intent = useSyncExternalStore(subscribeNavigationIntent, getNavigationIntent, getServerNavigationIntent)
    const spent = intent !== null && intent.from !== pathname

    useEffect(() => {
        if (spent) clearNavigationIntent()
    }, [spent])

    return resolveNavigationPathname(pathname, intent)
}
