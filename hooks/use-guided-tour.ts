'use client'

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { useMobileTour } from '@/hooks/use-mobile-tour'
import { isTourTargetVisible } from '@/lib/tutorial-target'
import { placeTourPanel, type Placement, type Rect } from '@/lib/tours/placement'
import { resolveTourTarget, watchTourTarget } from '@/lib/tours/target-readiness'
import { restoreScroll, scrollIntoSafeView, visibleTourRect, type ScrollRecord } from '@/lib/tours/tour-scroll'
import type { TourId, TourStepSpec } from '@/lib/tours/tour-types'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import type { Language } from '@/lib/i18n/context'
import { lockTourViewport } from '@/lib/tutorial-viewport-lock'

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
        let lastFocused: Element | null = null
        const focus = () => {
            if (panel.current?.contains(document.activeElement)) { lastFocused = document.activeElement; return }
            const next = lastFocused instanceof HTMLButtonElement && !lastFocused.isConnected
                ? panel.current?.querySelector<HTMLButtonElement>('[data-tour-control="next"]') : null
            ;(next ?? panel.current)?.focus({ preventScroll: true })
        }
        // Removing Back on step 1 does not fire focusin in every browser.
        const focusObserver = new MutationObserver(() => {
            if (lastFocused instanceof HTMLButtonElement && !lastFocused.isConnected) focus()
        })
        focusObserver.observe(panel.current, { childList: true, subtree: true })
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
            observer.disconnect(); focusObserver.disconnect(); unlock()
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

export type TourStepStatus = 'preparing' | 'ready' | 'unavailable'
type StepMeasurement = { key: object; status: TourStepStatus; rect: Rect | null; placement: Placement | null }

/** Bounded readiness, scrolling and event-only tracking for the new shared runtime. */
export function useTourStep<S extends string>({ tourId, step, spec, panel, compact, language, unavailable, scrollRecord }: {
    tourId: TourId; step: S; spec: TourStepSpec<S>; panel: RefObject<HTMLDivElement | null>
    compact: boolean; language: Language; unavailable?: string; scrollRecord?: ScrollRecord
}) {
    const ownedRecord = useMemo<ScrollRecord>(() => new Map(), [])
    const record = scrollRecord ?? ownedRecord
    const key = useMemo(() => ({ step, language, compact, anchor: spec.anchor, context: spec.context }), [step, language, compact, spec.anchor, spec.context])
    const [measurement, setMeasurement] = useState<StepMeasurement | null>(null)
    const [slowPreparation, setSlowPreparation] = useState<object | null>(null)
    const resolve = useCallback(() => resolveTourTarget(spec.anchor, spec.context, { tourId, stepId: step }), [spec.anchor, spec.context, tourId, step])
    const resolveMobile = useCallback(() => { const target = resolve(); return { target, card: target } }, [resolve])
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobileOptions = useMemo(() => ({ record, reducedMotion }), [record, reducedMotion])
    const mobile = useMobileTour(compact ? key : undefined, panel, resolveMobile, mobileOptions)

    useEffect(() => () => { if (!scrollRecord) restoreScroll(ownedRecord) }, [ownedRecord, scrollRecord])

    useEffect(() => {
        if (compact) return
        let stopped = false
        let retryUsed = false
        let cancel = () => {}
        let stopTracking = () => {}
        let pendingFrame = 0
        const safe = (): Rect => ({ left: 16, top: 16, right: window.innerWidth - 16, bottom: window.innerHeight - 16, width: window.innerWidth - 32, height: window.innerHeight - 32 })
        const fail = () => {
            if (!stopped) setMeasurement(previous => ({ key, status: 'unavailable', rect: null, placement: previous?.placement ?? null }))
        }
        const update = (element: HTMLElement) => {
            if (stopped || !panel.current) return
            const rect = visibleTourRect(element, safe())
            const context = spec.context ? element.closest(spec.context) ?? document.querySelector(spec.context) : null
            const placement = rect ? placeTourPanel({ target: rect, context: context?.getBoundingClientRect(), panel: panel.current.getBoundingClientRect(), viewport: { width: window.innerWidth, height: window.innerHeight } }) : null
            setMeasurement({ key, status: rect ? 'ready' : 'unavailable', rect, placement })
        }
        const begin = () => {
            const positioned = new WeakSet<HTMLElement>()
            cancel = watchTourTarget({
                resolve: () => {
                    const element = resolve()
                    if (!element || !panel.current) return null
                    if (!positioned.has(element)) {
                        positioned.add(element)
                        scrollIntoSafeView(element, safe(), window.matchMedia('(prefers-reduced-motion: reduce)').matches, record)
                    }
                    return visibleTourRect(element, safe()) ? element : null
                },
                onUnavailable: fail,
                onReady: element => {
                    if (stopped) return
                    update(element)
                    const track = () => {
                        pendingFrame = 0
                        if (stopped) return
                        if (!isTourTargetVisible(element) || !visibleTourRect(element, safe()) || resolve() !== element) {
                            stopTracking()
                            if (retryUsed) { fail(); return }
                            retryUsed = true
                            setMeasurement(previous => ({ key, status: 'preparing', rect: null, placement: previous?.placement ?? null }))
                            begin()
                        } else update(element)
                    }
                    const schedule = () => { if (!pendingFrame) pendingFrame = requestAnimationFrame(track) }
                    const observer = new ResizeObserver(schedule)
                    observer.observe(element)
                    if (panel.current) observer.observe(panel.current)
                    window.addEventListener('resize', schedule)
                    window.addEventListener('scroll', schedule, true)
                    window.visualViewport?.addEventListener('resize', schedule)
                    window.visualViewport?.addEventListener('scroll', schedule)
                    stopTracking = () => {
                        observer.disconnect()
                        cancelAnimationFrame(pendingFrame)
                        pendingFrame = 0
                        window.removeEventListener('resize', schedule)
                        window.removeEventListener('scroll', schedule, true)
                        window.visualViewport?.removeEventListener('resize', schedule)
                        window.visualViewport?.removeEventListener('scroll', schedule)
                    }
                },
            })
        }
        begin()
        return () => { stopped = true; cancel(); stopTracking() }
    }, [compact, key, panel, record, resolve, spec.context])

    const current = measurement?.key === key ? measurement : null
    const status: TourStepStatus = compact ? mobile.unavailable ? 'unavailable' : mobile.rects ? 'ready' : 'preparing' : current?.status ?? 'preparing'
    const preparation = useMemo(() => ({ key, status }), [key, status])
    useEffect(() => {
        if (status !== 'preparing') return
        const timer = window.setTimeout(() => setSlowPreparation(preparation), 400)
        return () => window.clearTimeout(timer)
    }, [preparation, status])
    return {
        status,
        rect: compact ? mobile.rects?.field ?? null : current?.rect ?? null,
        placement: compact ? null : current?.placement ?? measurement?.placement ?? null,
        statusText: status === 'unavailable' ? unavailable ?? tourCommonCopy[language].unavailable
            : status === 'preparing' && slowPreparation === preparation ? tourCommonCopy[language].preparing : undefined,
    }
}
