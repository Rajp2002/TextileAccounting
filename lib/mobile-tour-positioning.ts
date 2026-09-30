import { clipTourRect, findTourScrollContainer, isTourTargetVisible } from './tutorial-target'
import { tourRectsStable } from './tours/target-readiness'
import { scrollIntoSafeView, type ScrollRecord } from './tours/tour-scroll'

export type TourRect = NonNullable<ReturnType<typeof clipTourRect>>
export type MobileTourOptions = {
    onUnavailable?: () => void
    onPreparing?: () => void
    /** New runtime records all tour-owned scrolls; legacy consumers keep their scroll policy. */
    record?: ScrollRecord
    reducedMotion?: boolean
}

/** One bounded positioning session per step; event feedback can only update measurements. */
export function trackMobileTourTarget(resolve: () => HTMLElement | null, panel: () => HTMLElement | null, onMeasure: (rect: TourRect | null) => void, options: MobileTourOptions = {}) {
    let frame = 0
    let stopped = false
    let positioned: HTMLElement | null = null
    let start = performance.now()
    let previous: TourRect | null = null
    let stable = 0
    let ready = false
    let recovered = false
    let unavailable = false
    let tracking = false
    const originalPadding = new Map<HTMLElement, string>()
    const originalBottom = new Map<HTMLElement, string>()
    const rememberPadding = (element: HTMLElement, padding: number) => {
        if (!originalPadding.has(element)) originalPadding.set(element, element.style.paddingBottom)
        element.style.paddingBottom = `${padding}px`
    }
    const fail = () => {
        if (unavailable) return
        unavailable = true
        stopTracking()
        onMeasure(null)
        options.onUnavailable?.()
    }
    const measure = () => {
        frame = 0
        if (stopped || unavailable) return
        const target = resolve()
        const panelRect = panel()?.getBoundingClientRect()
        if (ready && (target !== positioned || !isTourTargetVisible(target))) {
            if (!recover()) return
        }
        if (!ready && performance.now() - start >= 1500) { fail(); return }
        if (!isTourTargetVisible(target) || !panelRect) {
            previous = null
            stable = 0
            onMeasure(null)
            frame = requestAnimationFrame(measure)
            return
        }
        const viewport = window.visualViewport
        const top = (viewport?.offsetTop ?? 0) + 72
        const bottom = Math.min(panelRect.top - 16, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight))
        const bounds = { left: 8, right: window.innerWidth - 8, top, bottom }
        if (positioned !== target) {
            // Lift bottom-anchored shortcuts clear of the reading panel temporarily.
            const floating = target.closest<HTMLElement>('[data-tour-floating]')
            if (floating && getComputedStyle(floating).position === 'fixed') {
                if (!originalBottom.has(floating)) originalBottom.set(floating, floating.style.bottom)
                floating.style.bottom = `${window.innerHeight - bottom}px`
                positioned = target
                frame = requestAnimationFrame(measure)
                return
            }
            // Reserve room in the actual scroll container, including drawers and sheets.
            const scroller = findTourScrollContainer(target)
            const rootScroller = document.scrollingElement ?? document.documentElement
            // Never resize the root viewport: Safari emits visualViewport resize while scrolling.
            rememberPadding(scroller === rootScroller ? document.body : scroller, panelRect.height + 100)
            if (options.record) {
                scrollIntoSafeView(target, { ...bounds, width: bounds.right - bounds.left, height: bottom - top }, options.reducedMotion ?? false, options.record)
            } else {
                // Preserve the existing tours' single vertical scroll and final coordinates.
                const rect = target.getBoundingClientRect()
                const scrollport = scroller === rootScroller ? bounds : scroller.getBoundingClientRect()
                const availableTop = Math.max(top, scrollport.top)
                const availableBottom = Math.min(bottom, scrollport.bottom)
                const desiredTop = availableTop + Math.max(0, (availableBottom - availableTop - rect.height) / 2)
                const delta = rect.top - desiredTop
                if (scroller === rootScroller) window.scrollBy({ top: delta, behavior: 'instant' })
                else scroller.scrollBy({ top: delta, behavior: 'instant' })
            }
            positioned = target
            frame = requestAnimationFrame(measure)
            return
        }
        const rawRect = target.getBoundingClientRect()
        let clipped = clipTourRect(rawRect, bounds)
        // Clip against nested scrollports too; a mounted field may still be concealed.
        for (let parent = target.parentElement; parent && clipped; parent = parent.parentElement) {
            const style = getComputedStyle(parent)
            const rect = parent.getBoundingClientRect()
            clipped = clipTourRect(clipped, {
                left: /(auto|scroll|hidden|clip)/.test(style.overflowX) ? rect.left : bounds.left,
                right: /(auto|scroll|hidden|clip)/.test(style.overflowX) ? rect.right : bounds.right,
                top: /(auto|scroll|hidden|clip)/.test(style.overflowY) ? rect.top : bounds.top,
                bottom: /(auto|scroll|hidden|clip)/.test(style.overflowY) ? rect.bottom : bounds.bottom,
            })
        }
        if (ready) {
            if (clipped) { onMeasure(clipped); return }
            if (recover()) frame = requestAnimationFrame(measure)
            return
        }
        stable = clipped && previous && tourRectsStable(previous, rawRect) ? stable + 1 : clipped ? 1 : 0
        previous = clipped ? rawRect : null
        if (clipped && stable >= 2) {
            ready = true
            onMeasure(clipped)
            startTracking(target)
        } else {
            onMeasure(null)
            frame = requestAnimationFrame(measure)
        }
    }
    function recover() {
        stopTracking()
        ready = false
        onMeasure(null)
        if (recovered) { fail(); return false }
        recovered = true
        positioned = null
        previous = null
        stable = 0
        start = performance.now()
        options.onPreparing?.()
        return true
    }
    const schedule = () => { if (!stopped && !unavailable && !frame) frame = requestAnimationFrame(measure) }
    const resize = schedule
    const observer = new ResizeObserver(resize)
    function startTracking(target: HTMLElement) {
        if (tracking) return
        tracking = true
        const panelElement = panel()
        if (panelElement) observer.observe(panelElement)
        observer.observe(target)
        window.addEventListener('scroll', schedule, true)
        window.addEventListener('resize', resize)
        window.addEventListener('scrollend', schedule, true)
        window.visualViewport?.addEventListener('resize', resize)
        window.visualViewport?.addEventListener('scroll', schedule)
    }
    function stopTracking() {
        tracking = false
        observer.disconnect()
        window.removeEventListener('scroll', schedule, true)
        window.removeEventListener('resize', resize)
        window.removeEventListener('scrollend', schedule, true)
        window.visualViewport?.removeEventListener('resize', resize)
        window.visualViewport?.removeEventListener('scroll', schedule)
    }
    frame = requestAnimationFrame(measure)
    return () => {
        stopped = true
        cancelAnimationFrame(frame)
        stopTracking()
        originalPadding.forEach((padding, element) => { element.style.paddingBottom = padding })
        originalBottom.forEach((bottom, element) => { element.style.bottom = bottom })
    }
}
