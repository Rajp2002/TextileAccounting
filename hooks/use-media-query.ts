'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether a media query matches now, kept current as the window changes. False on the server, so the first render
 * matches the server markup; pages that lay out differently by width should do it with CSS first and use this only
 * for behaviour (which surface opens, what loads).
 */
export function useMediaQuery(query: string) {
    const subscribe = useCallback((onChange: () => void) => {
        const media = window.matchMedia(query)
        media.addEventListener('change', onChange)
        return () => media.removeEventListener('change', onChange)
    }, [query])
    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}
