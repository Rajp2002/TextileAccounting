'use client'

import { useEffect, useMemo, useState, type RefObject } from 'react'
import { trackMobileTourTarget, type TourRect, type MobileTourOptions } from '@/lib/mobile-tour-positioning'

type Elements = { target: HTMLElement | null; card: HTMLElement | null }
type Rect = TourRect

/** Mobile tours reserve a measured reading area and never draw speculative coordinates. */
export function useMobileTour<T>(active: T | undefined, panel: RefObject<HTMLDivElement | null>, resolve: (step: T) => Elements, options?: MobileTourOptions) {
    const [mobile, setMobile] = useState(false)
    const session = useMemo(() => ({ active, mobile, panel, resolve, options }), [active, mobile, panel, resolve, options])
    const [unavailableSession, setUnavailableSession] = useState<typeof session | null>(null)
    const [measurement, setMeasurement] = useState<{ session: typeof session; field: Rect; card: Rect } | null>(null)

    useEffect(() => {
        const media = window.matchMedia('(max-width: 767px), (max-height: 500px) and (pointer: coarse)')
        const update = () => setMobile(media.matches)
        update()
        media.addEventListener('change', update)
        return () => media.removeEventListener('change', update)
    }, [])

    useEffect(() => {
        if (!mobile || !active) return
        return trackMobileTourTarget(
            () => resolve(active).target,
            () => panel.current,
            rect => {
                if (rect) setUnavailableSession(null)
                setMeasurement(rect ? { session, field: rect, card: rect } : null)
            },
            { ...options, onUnavailable: () => { setUnavailableSession(session); options?.onUnavailable?.() } },
        )
    }, [active, mobile, panel, resolve, options, session])

    return { mobile, unavailable: unavailableSession === session, rects: measurement?.session === session ? measurement : null }
}
