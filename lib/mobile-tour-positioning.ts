import { clipTourRect, findTourScrollContainer, isTourTargetVisible } from './tutorial-target'

export type TourRect = NonNullable<ReturnType<typeof clipTourRect>>

/** One bounded positioning session per step; event feedback can only update measurements. */
export function trackMobileTourTarget(resolve: () => HTMLElement | null, panel: () => HTMLElement | null, onMeasure: (rect: TourRect | null) => void, onUnavailable: () => void = () => {}) {
    let frame = 0
    let stopped = false
    let positioned: HTMLElement | null = null
    const start = performance.now()
    const originalPadding = new Map<HTMLElement, string>()
    const originalBottom = new Map<HTMLElement, string>()
    let previous: TourRect | null = null
    let stableFrames = 0
    let unavailableReported = false
    const rememberPadding = (element: HTMLElement, padding: number) => {
        if (!originalPadding.has(element)) originalPadding.set(element, element.style.paddingBottom)
        element.style.paddingBottom = `${padding}px`
    }
    const measure = () => {
        frame = 0
        if (stopped) return
        const target = resolve()
        const panelRect = panel()?.getBoundingClientRect()
        if (!isTourTargetVisible(target) || !panelRect) {
            onMeasure(null)
            // A late mount is not permission to remove or advance a step.
            if (performance.now() - start > 1500) { if (!unavailableReported) { unavailableReported = true; onUnavailable() } return }
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
            // One vertical scroll command: do not race scrollIntoView against a second scroll.
            const rect = target.getBoundingClientRect()
            const scrollport = scroller === rootScroller ? bounds : scroller.getBoundingClientRect()
            const availableTop = Math.max(top, scrollport.top)
            const availableBottom = Math.min(bottom, scrollport.bottom)
            const desiredTop = availableTop + Math.max(0, (availableBottom - availableTop - rect.height) / 2)
            const delta = rect.top - desiredTop
            if (scroller === rootScroller) window.scrollBy({ top: delta, behavior: 'instant' })
            else scroller.scrollBy({ top: delta, behavior: 'instant' })
            positioned = target
            frame = requestAnimationFrame(measure)
            return
        }
        let clipped = clipTourRect(target.getBoundingClientRect(), bounds)
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
        if (!clipped) onMeasure(null)
        if (!clipped && performance.now() - start >= 1500) { if (!unavailableReported) { unavailableReported = true; onUnavailable() }; return }
        if (clipped && previous && ['left', 'top', 'right', 'bottom'].every(key => Math.abs(clipped[key as keyof TourRect] - previous![key as keyof TourRect]) <= 1)) stableFrames += 1
        else stableFrames = 0
        previous = clipped
        if (stableFrames >= 2) onMeasure(clipped)
        else frame = requestAnimationFrame(measure)
        // If positioning still fails, keep this step and its navigation intact.
    }
    const schedule = () => { if (!stopped && !frame) frame = requestAnimationFrame(measure) }
    // Resize/scroll notifications measure only. They cannot reset the positioning budget.
    const resize = schedule
    const observer = new ResizeObserver(resize)
    const panelElement = panel()
    if (panelElement) observer.observe(panelElement)
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', resize)
    window.addEventListener('scrollend', schedule, true)
    window.visualViewport?.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('scroll', schedule)
    frame = requestAnimationFrame(measure)
    return () => {
        stopped = true
        cancelAnimationFrame(frame)
        observer.disconnect()
        window.removeEventListener('scroll', schedule, true)
        window.removeEventListener('resize', resize)
        window.removeEventListener('scrollend', schedule, true)
        window.visualViewport?.removeEventListener('resize', resize)
        window.visualViewport?.removeEventListener('scroll', schedule)
        originalPadding.forEach((padding, element) => { element.style.paddingBottom = padding })
        originalBottom.forEach((bottom, element) => { element.style.bottom = bottom })
    }
}
