'use client'

import { useEffect, useState, type RefObject } from 'react'
import { clipTourRect, findTourScrollContainer, isTourTargetVisible } from '@/lib/tutorial-target'

type Elements = { target: HTMLElement | null; card: HTMLElement | null }
type Rect = NonNullable<ReturnType<typeof clipTourRect>>

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
        let frame = 0
        let stopped = false
        let positioned: HTMLElement | null = null
        let attempts = 0
        const start = performance.now()
        const originalPadding = new Map<HTMLElement, string>()
        const originalBottom = new Map<HTMLElement, string>()
        const rememberPadding = (element: HTMLElement, padding: number) => {
            if (!originalPadding.has(element)) originalPadding.set(element, element.style.paddingBottom)
            element.style.paddingBottom = `${padding}px`
        }
        const measure = () => {
            if (stopped) return
            const { target } = resolve(active)
            const panelRect = panel.current?.getBoundingClientRect()
            if (!isTourTargetVisible(target) || !panelRect) {
                setMeasurement(null)
                // A late mount is not permission to remove or advance a step.
                if (performance.now() - start > 1500) return
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
                rememberPadding(scroller, panelRect.height + 100)
                target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
                const rect = target.getBoundingClientRect()
                const desiredTop = top + Math.max(0, (bottom - top - rect.height) / 2)
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
            setMeasurement(clipped ? { step: active, field: clipped, card: clipped } : null)
            if (!clipped && attempts++ < 2) { positioned = null; frame = requestAnimationFrame(measure) }
            // If positioning still fails, keep this step and its navigation intact.
        }
        const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
        const resize = () => { positioned = null; attempts = 0; schedule() }
        const observer = new ResizeObserver(resize)
        if (panel.current) observer.observe(panel.current)
        window.addEventListener('scroll', schedule, true)
        window.addEventListener('resize', resize)
        window.visualViewport?.addEventListener('resize', resize)
        window.visualViewport?.addEventListener('scroll', schedule)
        frame = requestAnimationFrame(measure)
        return () => {
            stopped = true
            cancelAnimationFrame(frame)
            observer.disconnect()
            window.removeEventListener('scroll', schedule, true)
            window.removeEventListener('resize', resize)
            window.visualViewport?.removeEventListener('resize', resize)
            window.visualViewport?.removeEventListener('scroll', schedule)
            originalPadding.forEach((padding, element) => { element.style.paddingBottom = padding })
            originalBottom.forEach((bottom, element) => { element.style.bottom = bottom })
        }
    }, [active, mobile, panel, resolve])

    return { mobile, rects: measurement?.step === active ? measurement : null }
}
