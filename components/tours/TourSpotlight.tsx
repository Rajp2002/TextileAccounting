'use client'

import { useState } from 'react'
import { expandTourRect, type Rect } from '@/lib/tours/placement'

export function TourSpotlight({ rect, animate }: { rect: Rect | null; animate: boolean }) {
    const [lastRect, setLastRect] = useState(rect)
    if (rect && rect !== lastRect) setLastRect(rect)
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const outline = rect ? expandTourRect(rect) : null
    const retained = outline ?? (lastRect ? expandTourRect(lastRect) : null)
    const clipPath = outline ? `polygon(evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${outline.left}px ${outline.top}px,${outline.left}px ${outline.bottom}px,${outline.right}px ${outline.bottom}px,${outline.right}px ${outline.top}px,${outline.left}px ${outline.top}px)` : undefined
    return <>
        <div aria-hidden="true" className="guided-tour-backdrop fixed inset-0 bg-ink/45" style={{ clipPath, transition: !reducedMotion && animate && rect ? 'clip-path 160ms ease-out' : 'none' }} />
        {retained && <div aria-hidden="true" className={`${rect ? 'guided-tour-highlight' : ''} pointer-events-none fixed rounded-xl border-2 border-saffron`} style={{
            left: retained.left, top: retained.top, width: retained.width, height: retained.height,
            opacity: rect ? 1 : 0,
            transition: reducedMotion ? 'none' : animate ? 'left 160ms ease-out, top 160ms ease-out, width 160ms ease-out, height 160ms ease-out, opacity 120ms ease-out' : 'opacity 120ms ease-out',
        }} />}
    </>
}
