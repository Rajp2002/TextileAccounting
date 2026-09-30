import { isTourTargetVisible } from '@/lib/tutorial-target'
import type { Rect } from './placement'

export function resolveTourTarget(anchor: string, context?: string, identity?: { tourId: string; stepId: string }): HTMLElement | null {
    const visible = Array.from(document.querySelectorAll<HTMLElement>(anchor)).filter(isTourTargetVisible)
    if (visible.length > 1 && process.env.NODE_ENV === 'development') {
        console.warn('[tour] duplicate target', identity?.tourId ?? anchor, identity?.stepId ?? context)
    }
    return (context ? visible.find(element => element.closest(context)) : undefined) ?? visible[0] ?? null
}

export function tourRectsStable(previous: Rect, next: Rect): boolean {
    return (['left', 'top', 'right', 'bottom', 'width', 'height'] as const).every(key => Math.abs(previous[key] - next[key]) <= 1)
}

export function watchTourTarget({ resolve, onReady, onUnavailable, budgetMs = 1500, stableFrames = 2,
    raf = requestAnimationFrame, caf = cancelAnimationFrame, now = () => performance.now(),
}: {
    resolve: () => HTMLElement | null
    onReady: (element: HTMLElement, rect: Rect) => void
    onUnavailable: () => void
    budgetMs?: number; stableFrames?: number
    raf?: typeof requestAnimationFrame; caf?: typeof cancelAnimationFrame; now?: () => number
}): () => void {
    const start = now()
    let frame = 0
    let cancelled = false
    let previous: { element: HTMLElement; rect: Rect } | null = null
    let stable = 0
    const tick = () => {
        if (cancelled) return
        if (now() - start >= budgetMs) { cancelled = true; onUnavailable(); return }
        const element = resolve()
        if (isTourTargetVisible(element)) {
            const rect = element.getBoundingClientRect()
            stable = previous?.element === element && tourRectsStable(previous.rect, rect) ? stable + 1 : 1
            previous = { element, rect }
            if (stable >= stableFrames) { cancelled = true; onReady(element, rect); return }
        } else { previous = null; stable = 0 }
        frame = raf(tick)
    }
    frame = raf(tick)
    return () => { cancelled = true; caf(frame) }
}
