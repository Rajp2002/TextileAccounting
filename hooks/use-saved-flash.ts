'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const SAVED_MS = 1800

/**
 * A short-lived "just saved" flag for a save button: call `flashSaved()` after
 * a successful save and the button can show its Saved state for under two seconds.
 */
export function useSavedFlash(): [justSaved: boolean, flashSaved: () => void] {
    const [justSaved, setJustSaved] = useState(false)
    const timer = useRef<number | undefined>(undefined)

    const flashSaved = useCallback(() => {
        window.clearTimeout(timer.current)
        setJustSaved(true)
        timer.current = window.setTimeout(() => setJustSaved(false), SAVED_MS)
    }, [])

    useEffect(() => () => window.clearTimeout(timer.current), [])

    return [justSaved, flashSaved]
}
