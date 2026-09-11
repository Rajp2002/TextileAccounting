'use client'

import { useEffect } from 'react'

/** Keep page-owned titles localized when streamed route metadata arrives after hydration. */
export function useLocalizedPageTitle(title: string | null) {
    useEffect(() => {
        if (!title) return
        const applyTitle = () => {
            if (document.title !== title) document.title = title
        }
        applyTitle()
        const observer = new MutationObserver(applyTitle)
        observer.observe(document.head, { childList: true, subtree: true, characterData: true })
        return () => observer.disconnect()
    }, [title])
}
