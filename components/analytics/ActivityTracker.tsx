'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { ACTIVITY_FLUSH_MS, ACTIVITY_TICK_MS, ActivityCounter, activityAreaForPath, activityDevice, type ActivityFlush } from '@/lib/activity-tracking'

const ENDPOINT = '/api/analytics/activity'
const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/**
 * Counts the owner's active minutes and flushes them every 5 minutes and when
 * the page is hidden or closed (spec 2026-10-30 section A). Renders nothing.
 * Sends only minutes, area counts, device type and installed-app state; a
 * failed send drops those minutes.
 */
export function ActivityTracker(): null {
    const pathname = usePathname()
    const areaRef = useRef(activityAreaForPath(pathname ?? ''))

    useEffect(() => {
        areaRef.current = activityAreaForPath(pathname ?? '')
    }, [pathname])

    useEffect(() => {
        const counter = new ActivityCounter()
        const coarse = window.matchMedia('(pointer: coarse)')
        const standalone = window.matchMedia('(display-mode: standalone)')
        const onInput = () => counter.recordInput(Date.now())

        const body = (flush: ActivityFlush) => JSON.stringify(flush)
        const flushWithFetch = () => {
            const flush = counter.takeFlush()
            if (!flush) return
            fetch(ENDPOINT, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: body(flush) }).catch(() => {})
        }
        const flushWithBeacon = () => {
            const flush = counter.takeFlush()
            if (!flush) return
            try { navigator.sendBeacon(ENDPOINT, new Blob([body(flush)], { type: 'application/json' })) } catch { /* dropped */ }
        }
        const onVisibility = () => { if (document.visibilityState === 'hidden') flushWithBeacon() }

        const tick = window.setInterval(() => counter.tick(Date.now(), {
            visible: document.visibilityState === 'visible',
            area: areaRef.current,
            device: activityDevice(window.innerWidth, coarse.matches),
            installed: standalone.matches,
        }), ACTIVITY_TICK_MS)
        const flushTimer = window.setInterval(flushWithFetch, ACTIVITY_FLUSH_MS)

        for (const event of INPUT_EVENTS) window.addEventListener(event, onInput, { passive: true })
        window.addEventListener('scroll', onInput, { passive: true, capture: true })
        document.addEventListener('visibilitychange', onVisibility)
        window.addEventListener('pagehide', flushWithBeacon)

        return () => {
            // Leaving this layout (for example owner app to Support) keeps the minutes already counted.
            flushWithBeacon()
            window.clearInterval(tick)
            window.clearInterval(flushTimer)
            for (const event of INPUT_EVENTS) window.removeEventListener(event, onInput)
            window.removeEventListener('scroll', onInput, { capture: true })
            document.removeEventListener('visibilitychange', onVisibility)
            window.removeEventListener('pagehide', flushWithBeacon)
        }
    }, [])

    return null
}
