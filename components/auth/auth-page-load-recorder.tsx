'use client'

import { useEffect } from 'react'
import {
    peekAuthNavigationMark,
    rememberPageLoadMs,
    takeAuthNavigationMark,
} from './auth-transition-timing'

// The page the browser keeps showing until the next one paints is the one the
// overlay covers, so first paint is the figure that tells sign-in and log out
// how early to leave. The timeline starts when the navigation did.
function firstPaintMs(): number | null {
    const entries = performance.getEntriesByType('paint')
    const paint = entries.find((entry) => entry.name === 'first-contentful-paint')
        ?? entries.find((entry) => entry.name === 'first-paint')
    return paint ? paint.startTime : null
}

/**
 * Measures how long the page after a sign-in or log out took to paint and
 * keeps it on this device, so the next one can leave just early enough to land
 * as its round ends. Renders nothing and does nothing on any other page load.
 */
export function AuthPageLoadRecorder() {
    useEffect(() => {
        if (!peekAuthNavigationMark()) return

        let done = false
        const record = () => {
            if (done) return true
            const paintedAtMs = firstPaintMs()
            if (paintedAtMs === null) return false
            done = true
            const kind = takeAuthNavigationMark()
            if (kind) rememberPageLoadMs(kind, paintedAtMs)
            return true
        }
        if (record()) return

        // Slow devices can hydrate before the first paint is reported.
        if (typeof PerformanceObserver === 'undefined') return
        let observer: PerformanceObserver | null = null
        try {
            observer = new PerformanceObserver(() => {
                if (record()) observer?.disconnect()
            })
            observer.observe({ type: 'paint', buffered: true })
        } catch {
            // Learning is an optimisation; the default lead still applies.
        }
        return () => observer?.disconnect()
    }, [])

    return null
}
