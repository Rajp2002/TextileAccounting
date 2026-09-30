import { clipTourRect, findTourScrollContainer } from '@/lib/tutorial-target'
import type { Rect } from './placement'

export type ScrollRecord = Map<HTMLElement | Window, { left: number; top: number }>

/** Clip to real scrollports, not to an assumed dialog or page layout. */
export function visibleTourRect(target: HTMLElement, safe: Rect): Rect | null {
    let rect = clipTourRect(target.getBoundingClientRect(), safe)
    for (let parent = target.parentElement; parent && rect; parent = parent.parentElement) {
        const style = window.getComputedStyle(parent)
        const bounds = parent.getBoundingClientRect()
        rect = clipTourRect(rect, {
            left: /(auto|scroll|hidden|clip)/.test(style.overflowX) ? bounds.left : safe.left,
            right: /(auto|scroll|hidden|clip)/.test(style.overflowX) ? bounds.right : safe.right,
            top: /(auto|scroll|hidden|clip)/.test(style.overflowY) ? bounds.top : safe.top,
            bottom: /(auto|scroll|hidden|clip)/.test(style.overflowY) ? bounds.bottom : safe.bottom,
        })
    }
    return rect
}

export function scrollIntoSafeView(target: HTMLElement, safe: Rect, reducedMotion: boolean, record: ScrollRecord): boolean {
    const scroller = findTourScrollContainer(target)
    const root = document.scrollingElement ?? document.documentElement
    const container = scroller === root ? window : scroller
    const bounds = scroller === root ? safe : clipTourRect(scroller.getBoundingClientRect(), safe)
    if (!bounds) return false
    const rect = target.getBoundingClientRect()
    const insideX = rect.left >= bounds.left && rect.right <= bounds.right
    const insideY = rect.top >= bounds.top && rect.bottom <= bounds.bottom
    if (insideX && insideY) return false
    const left = container === window ? window.scrollX : scroller.scrollLeft
    const top = container === window ? window.scrollY : scroller.scrollTop
    if (!record.has(container)) record.set(container, { left, top })
    const desiredLeft = bounds.left + Math.max(0, (bounds.right - bounds.left - rect.width) / 2)
    const desiredTop = bounds.top + Math.max(0, (bounds.bottom - bounds.top - rect.height) / 2)
    container.scrollTo({ left: left + (insideX ? 0 : rect.left - desiredLeft), top: top + (insideY ? 0 : rect.top - desiredTop), behavior: reducedMotion ? 'instant' : 'smooth' })
    return true
}

export function restoreScroll(record: ScrollRecord): void {
    record.forEach((position, container) => container.scrollTo({ ...position, behavior: 'instant' }))
    record.clear()
}
