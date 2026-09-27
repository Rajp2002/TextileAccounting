'use client'

import { useEffect, useState, type RefObject } from 'react'
import { lockTourViewport } from '@/lib/tutorial-viewport-lock'
import type { Language } from '@/lib/i18n/context'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { placeTourPanel, type TourBox, type TourPanelPlacement } from '@/lib/tours/placement'
import { resolveTourTarget, watchTourTarget } from '@/lib/tours/target-readiness'
import { scrollIntoSafeView, type ScrollRecord } from '@/lib/tours/tour-scroll'
import type { TourStepSpec } from '@/lib/tours/tour-types'

// Shared behavior of the page-level guided tours in components/tours
// (Phase 2D). Each tour keeps its own steps, copy and panel content.

const TOUR_TRIGGER = '[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]'

export type TourNavigation = { close: () => void; next: () => void; back: () => void }

/**
 * Where focus returns when the tour closes.
 * - `launcher`: the launcher's tour button, found when the tour opens.
 * - `return-focus-at-close`: the element that started the tour if it is still
 *   in the page, otherwise the launcher's tour button found at close.
 * - `return-focus-or-launcher`: the element that started the tour, or the
 *   launcher's tour button found at open; if that element has left the page,
 *   the launcher's tour button found at close.
 */
export type TourFocusReturn = 'launcher' | 'return-focus-at-close' | 'return-focus-or-launcher'

export function captureFocusReturn(
    strategy: TourFocusReturn,
    launcher: RefObject<HTMLElement | null>,
    returnFocus: RefObject<HTMLElement | null> | undefined,
): () => HTMLElement | null | undefined {
    if (strategy === 'return-focus-at-close') {
        const launchElement = returnFocus?.current
        const launcherContainer = launcher.current
        return () => launchElement?.isConnected ? launchElement : launcherContainer?.querySelector<HTMLButtonElement>(TOUR_TRIGGER)
    }
    if (strategy === 'return-focus-or-launcher') {
        const launcherElement = launcher.current
        const trigger = returnFocus?.current ?? launcherElement?.querySelector<HTMLButtonElement>(TOUR_TRIGGER)
        return () => trigger?.isConnected ? trigger : launcherElement?.querySelector<HTMLButtonElement>(TOUR_TRIGGER)
    }
    const trigger = launcher.current?.querySelector<HTMLButtonElement>(TOUR_TRIGGER)
    return () => trigger
}

/**
 * Makes the tour modal while it is open: the rest of the page is inert and
 * ignores pointer input, focus stays in the panel (Tab cycles its buttons),
 * Escape closes, arrows and Enter move between steps, and the viewport is
 * locked. On close it restores inertness, scroll position and focus.
 */
export function useGuidedTourModal({ panel, portal, navigation, launcher, returnScroll, returnFocus, focusReturn = 'launcher' }: {
    panel: RefObject<HTMLDivElement | null>
    portal: RefObject<HTMLDivElement | null>
    navigation: RefObject<TourNavigation>
    launcher: RefObject<HTMLElement | null>
    /** Scroll position to restore on close; defaults to the position when the tour opened. */
    returnScroll?: RefObject<{ x: number; y: number }>
    returnFocus?: RefObject<HTMLElement | null>
    focusReturn?: TourFocusReturn
}) {
    useEffect(() => {
        if (!panel.current) return
        const focusTarget = captureFocusReturn(focusReturn, launcher, returnFocus)
        const scroll = returnScroll?.current ?? { x: window.scrollX, y: window.scrollY }
        const previous = new Map<HTMLElement, boolean>()
        const makeInert = () => {
            for (const element of Array.from(document.body.children)) {
                if (!(element instanceof HTMLElement) || element === portal.current || element.contains(portal.current)) continue
                if (!previous.has(element)) previous.set(element, element.inert)
                element.inert = true
            }
        }
        makeInert()
        const observer = new MutationObserver(makeInert)
        observer.observe(document.body, { childList: true })
        const unlock = lockTourViewport(panel.current)
        const block = (event: Event) => {
            if (event.target instanceof Node && panel.current?.contains(event.target)) return
            event.preventDefault()
            event.stopImmediatePropagation()
        }
        const focus = () => {
            if (!panel.current?.contains(document.activeElement)) panel.current?.focus({ preventScroll: true })
        }
        const keyboard = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); navigation.current.close(); return }
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement))) {
                event.preventDefault(); event.stopImmediatePropagation()
                if (event.key === 'ArrowLeft') navigation.current.back()
                else navigation.current.next()
            }
            if (event.key === 'Tab') {
                const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
                const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
                event.preventDefault(); event.stopImmediatePropagation()
                buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
            }
        }
        const events = ['pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu', 'touchstart']
        events.forEach(name => document.addEventListener(name, block, { capture: true, passive: false }))
        document.addEventListener('keydown', keyboard, true)
        document.addEventListener('focusin', focus, true)
        panel.current.focus({ preventScroll: true })
        return () => {
            observer.disconnect(); unlock()
            events.forEach(name => document.removeEventListener(name, block, true))
            document.removeEventListener('keydown', keyboard, true)
            document.removeEventListener('focusin', focus, true)
            previous.forEach((inert, element) => { element.inert = inert })
            window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' })
            const trigger = focusTarget()
            trigger?.focus({ preventScroll: true })
        }
    }, [panel, portal, navigation, launcher, returnScroll, returnFocus, focusReturn])
}

export type TourPlacement<Step> = { step: Step; rect: DOMRect; bottom: boolean; left: boolean }

export function useTourStep<S extends string>({ step, spec, panel, compact, language, unavailable, scrollRecord }: {
    tourId: string; step: S; spec: TourStepSpec<S>; panel: RefObject<HTMLDivElement | null>; compact: boolean; language: Language; unavailable?: string; scrollRecord: ScrollRecord
}): { status: 'preparing' | 'ready' | 'unavailable'; rect: TourBox | null; placement: TourPanelPlacement | null; statusText?: string; reducedMotion: boolean } {
    const [result, setResult] = useState<{ step: S; status: 'preparing' | 'ready' | 'unavailable'; rect: TourBox | null; placement: TourPanelPlacement | null; slow: boolean }>({ step, status: 'preparing', rect: null, placement: null, slow: false })
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    useEffect(() => {
        const slowTimer = window.setTimeout(() => setResult(value => value.status === 'preparing' ? { ...value, step, slow: true } : value), 400)
        const resolve = () => resolveTourTarget(spec.anchor, spec.context)
        const cancel = watchTourTarget({ resolve, onReady: (target, initialRect) => {
            const safe = compact ? { left: 8, top: 72, right: window.innerWidth - 8, bottom: Math.max(72, (panel.current?.getBoundingClientRect().top ?? window.innerHeight) - 16), width: window.innerWidth - 16, height: window.innerHeight - 88 } : { left: 16, top: 16, right: window.innerWidth - 16, bottom: window.innerHeight - 16, width: window.innerWidth - 32, height: window.innerHeight - 32 }
            scrollIntoSafeView(target, safe, reducedMotion, scrollRecord)
            const rect = target.getBoundingClientRect(); const box = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
            const contextElement = spec.context ? target.closest<HTMLElement>(spec.context) : null; const contextRect = contextElement?.getBoundingClientRect(); const context = contextRect ? { left: contextRect.left, top: contextRect.top, right: contextRect.right, bottom: contextRect.bottom, width: contextRect.width, height: contextRect.height } : null
            const panelRect = panel.current?.getBoundingClientRect(); const placement = compact ? null : placeTourPanel({ target: box, context, panel: { width: panelRect?.width || 360, height: panelRect?.height || 240 }, viewport: { width: window.innerWidth, height: window.innerHeight } })
            setResult({ step, status: 'ready', rect: box.width ? box : initialRect, placement, slow: false })
        }, onUnavailable: () => setResult({ step, status: 'unavailable', rect: null, placement: null, slow: false }) })
        return () => { window.clearTimeout(slowTimer); cancel() }
    }, [step, spec, panel, compact, language, reducedMotion, scrollRecord])
    useEffect(() => {
        if (result.status !== 'ready') return
        const update = () => {
            const target = resolveTourTarget(spec.anchor, spec.context); if (!target) return
            const rect = target.getBoundingClientRect(); const box = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
            setResult(value => ({ ...value, rect: box }))
        }
        window.addEventListener('resize', update); window.addEventListener('scroll', update, true)
        return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
    }, [result.status, spec])
    const current = result.step === step ? result : { step, status: 'preparing' as const, rect: null, placement: null, slow: false }
    const statusText = current.status === 'unavailable' ? (unavailable ?? tourCommonCopy[language].unavailable) : current.slow ? tourCommonCopy[language].preparing : undefined
    return { status: current.status, rect: current.rect, placement: current.placement, statusText, reducedMotion }
}

/**
 * Keeps the desktop panel beside the current target: scrolls the target into
 * view once, then re-measures for 1.5s and on resize or scroll. The panel
 * moves to the left or bottom when it would cover the target, except for
 * targets inside the tour's own preview (`previewSelector`).
 */
/** @deprecated Migrate tours to useTourStep. */
export function useGuidedTourPlacement<Step>({ step, mobile, resolve, language, panel, previewSelector }: {
    step: Step
    mobile: boolean
    resolve: (step: Step) => { target: HTMLElement | null }
    language: string
    panel: RefObject<HTMLDivElement | null>
    previewSelector: string
}): TourPlacement<Step> | null {
    const [measurement, setMeasurement] = useState<TourPlacement<Step> | null>(null)
    useEffect(() => {
        if (mobile) return
        let frame = 0
        let positioned: HTMLElement | null = null
        const start = performance.now()
        const measure = () => {
            const { target } = resolve(step)
            if (target && panel.current) {
                if (target !== positioned) { target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); positioned = target }
                const rect = target.getBoundingClientRect()
                const bounds = panel.current.getBoundingClientRect()
                const inPreview = Boolean(target.closest(previewSelector))
                const left = !inPreview && rect.right > window.innerWidth - bounds.width - 32 && rect.left > window.innerWidth / 2
                const bottom = !inPreview && !left && rect.top < bounds.height + 32 && rect.right > window.innerWidth - bounds.width - 32
                setMeasurement({ step, rect, left, bottom })
            }
            if (performance.now() - start < 1500) frame = requestAnimationFrame(measure)
        }
        const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
        frame = requestAnimationFrame(measure)
        window.addEventListener('resize', update)
        window.addEventListener('scroll', update, true)
        return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
    }, [step, mobile, resolve, language, panel, previewSelector])
    return measurement?.step === step ? measurement : null
}
