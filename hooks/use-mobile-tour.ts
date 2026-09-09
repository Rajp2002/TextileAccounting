'use client'

import { useEffect, useState, type RefObject } from 'react'
import { trackMobileTourTarget, type TourRect } from '@/lib/mobile-tour-positioning'

type Elements = { target: HTMLElement | null; card: HTMLElement | null }
type Rect = TourRect

/** Mobile tours reserve a measured reading area and never draw speculative coordinates. */
export function useMobileTour<T>(active: T | undefined, panel: RefObject<HTMLDivElement | null>, resolve: (step: T) => Elements) {
    const [mobile, setMobile] = useState(false)
    const [measurement, setMeasurement] = useState<{ step: T; field: Rect; card: Rect } | null>(null)

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
            rect => setMeasurement(rect ? { step: active, field: rect, card: rect } : null),
        )
    }, [active, mobile, panel, resolve])

    return { mobile, rects: measurement?.step === active ? measurement : null }
}
