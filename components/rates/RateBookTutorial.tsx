'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { dismissRatebookTutorial } from '@/app/(dashboard)/owner/rates/tutorial-actions'
import { useTranslation } from '@/lib/i18n/context'
import { rateBookTutorialCopy, isRatebookTutorialField, type RatebookTutorialField } from '@/lib/i18n/rate-book-tutorial'
import { Button } from '@/components/ui/button'
import { Compass, Sparkles } from 'lucide-react'

export type RatebookStep = {
    section: number
    target: HTMLElement | null
    card: HTMLElement | null
    field: RatebookTutorialField
    inSheet?: boolean
    inPopover?: boolean
}

const ORDERED_STEPS: { section: number; field: RatebookTutorialField; inSheet?: boolean; inPopover?: boolean }[] = [
    // Section 0: Search & filters
    { section: 0, field: 'yarnSearch' },
    { section: 0, field: 'directionFilter' },
    { section: 0, field: 'needsReviewFilter' },
    { section: 0, field: 'confirmAll' },

    // Section 1: Yarn rate row (separate section before row steps)
    { section: 1, field: 'yarnRow' },

    // Section 2: Rate details & trends
    { section: 2, field: 'yarnNameCell' },
    { section: 2, field: 'rateAndTrend' },
    { section: 2, field: 'reviewStatusBadge' },
    { section: 2, field: 'linkedQualitiesPopover' },

    // Section 3: Fast inline actions
    { section: 3, field: 'quickReviewAction' },
    { section: 3, field: 'quickEditAction' },
    { section: 3, field: 'quickEditPopover', inPopover: true },

    // Section 4: Full rate editor
    { section: 4, field: 'addRateAction' },
    { section: 4, field: 'rateDrawerFields', inSheet: true },

    // Section 5: Review rail
    { section: 5, field: 'reviewRailWidget' },
]

function resolveStepElements(step: RatebookStep): { target: HTMLElement | null; card: HTMLElement | null } {
    let target = step.target && document.body.contains(step.target) ? step.target : null
    let card = step.card && document.body.contains(step.card) ? step.card : null

    if (!target) {
        target = document.querySelector<HTMLElement>(`[data-ratebook-field="${step.field}"]`)
    }

    if (step.field === 'yarnRow') {
        const row = document.querySelector<HTMLElement>('tbody tr[data-ratebook-field="yarnRow"]') ??
                    document.querySelector<HTMLElement>('tbody tr') ??
                    document.querySelector<HTMLElement>('[data-ratebook-field="yarnRow"]') ??
                    document.querySelector<HTMLElement>('[data-slot="card"]')
        if (row) {
            target = row
            card = row
        }
    }

    if (step.field === 'quickEditPopover') {
        const popoverPanel = document.querySelector<HTMLElement>('[data-ratebook-field="quickEditPopover"]') ??
                             document.querySelector<HTMLElement>('[data-slot="popover-content"]')
        if (popoverPanel) {
            card = popoverPanel
            target = popoverPanel
        }
    }

    if (step.field === 'rateDrawerFields') {
        const sheetPanel = document.querySelector<HTMLElement>('[data-slot="sheet-content"]')
        if (sheetPanel) {
            card = sheetPanel
            target = sheetPanel.querySelector<HTMLElement>('[data-ratebook-field="rateDrawerFields"]') ?? sheetPanel
        }
    }

    // Fallbacks if table rows are empty or not rendered
    if (!target) {
        if (step.field === 'quickEditPopover') {
            const triggerEl = document.querySelector<HTMLElement>('[data-ratebook-field="quickEditAction"]')
            if (triggerEl) {
                target = triggerEl
                card = triggerEl
            }
        } else if (['yarnRow', 'yarnNameCell', 'rateAndTrend', 'reviewStatusBadge', 'linkedQualitiesPopover', 'quickReviewAction', 'quickEditAction'].includes(step.field)) {
            target = document.querySelector<HTMLElement>('tbody tr') ??
                     document.querySelector<HTMLElement>('table') ??
                     document.querySelector<HTMLElement>('[data-ratebook-field="rateTableCard"]') ??
                     document.querySelector<HTMLElement>('[data-slot="card"]')
        } else if (step.field === 'confirmAll') {
            target = document.querySelector<HTMLElement>('[data-ratebook-field="confirmAll"]') ??
                     document.querySelector<HTMLElement>('[data-ratebook-field="needsReviewFilter"]')
        }
    }

    if (!card && target) {
        card = target.closest<HTMLElement>('[data-slot="sheet-content"]') ??
               target.closest<HTMLElement>('[data-slot="popover-content"]') ??
               target.closest<HTMLElement>('tbody tr') ??
               target.closest<HTMLElement>('[data-ratebook-section-card]') ??
               target.closest<HTMLElement>('[data-slot="card"]') ??
               target.closest<HTMLElement>('table') ??
               target
    }

    return { target, card }
}

export function RateBookTutorialLauncher({
    onClick,
    disabled = false,
    className = '',
}: {
    onClick: () => void
    disabled?: boolean
    className?: string
}) {
    const { language, languageStatus } = useTranslation()
    const copy = rateBookTutorialCopy[language] ?? rateBookTutorialCopy.en
    const [replayTitle, replaySubtitle] = copy.replay.includes(' · ')
        ? copy.replay.split(' · ')
        : [copy.replay, '']

    return (
        <button
            data-i18n-skip="true"
            lang={language}
            type="button"
            onClick={onClick}
            disabled={disabled || languageStatus === 'loading'}
            className={`group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-amber-200/90 bg-amber-50/75 px-3.5 py-2.5 text-left text-sm font-semibold text-slate-800 shadow-xs transition-all duration-150 hover:border-amber-300 hover:bg-amber-100/70 hover:shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-saffron active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 ${className}`}
            aria-label={copy.replay}
            title={copy.replay}
        >
            <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 transition-colors group-hover:bg-amber-200">
                    <Compass className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">{replayTitle}</p>
                    {replaySubtitle && (
                        <p className="truncate text-[11px] font-medium text-amber-700">{replaySubtitle}</p>
                    )}
                </div>
            </div>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100/90 text-amber-700 transition-colors group-hover:bg-amber-200">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
        </button>
    )
}

export function RateBookTutorial({
    accountDismissed,
    enabled,
    orgId,
    userId,
    requestTrigger,
    onPrepare,
    onOpenQuickEdit,
    onOpenRateDrawer,
    onActiveChange,
}: {
    accountDismissed: boolean
    enabled: boolean
    orgId: string
    userId: string
    requestTrigger?: number
    onPrepare?: () => void
    onOpenQuickEdit?: (open: boolean) => void
    onOpenRateDrawer?: (open: boolean) => void
    onActiveChange?: (active: boolean) => void
}) {
    const { language, languageStatus } = useTranslation()
    const copy = rateBookTutorialCopy[language] ?? rateBookTutorialCopy.en
    const [steps, setSteps] = useState<RatebookStep[]>([])
    const [index, setIndex] = useState(0)
    const [requested, setRequested] = useState(false)
    const [rects, setRects] = useState<{ field: DOMRect; card: DOMRect } | null>(null)
    const panel = useRef<HTMLDivElement>(null)
    const key = `weavly:ratebook-tutorial:v1:${orgId}:${userId}`
    const active = steps[index]
    const dismissed = useRef(accountDismissed)
    const syncing = useRef(false)
    const autoStarted = useRef(false)
    const [syncFailed, setSyncFailed] = useState(false)
    const prevSectionRef = useRef<number | null>(null)
    const [isSectionTransition, setIsSectionTransition] = useState(false)
    const [panelPlacement, setPanelPlacement] = useState<'top-right' | 'bottom-right'>('top-right')

    useEffect(() => {
        if (requestTrigger && requestTrigger > 0) {
            setRequested(true)
        }
    }, [requestTrigger])

    const syncDismissal = useCallback(async () => {
        if (syncing.current) return
        syncing.current = true
        try {
            const result = await dismissRatebookTutorial()
            setSyncFailed(!result.success)
            if (result.success) {
                try { localStorage.removeItem(key) } catch { /* Optional retry cache. */ }
            }
        } catch {
            setSyncFailed(true)
        } finally {
            syncing.current = false
        }
    }, [key])

    // Autostart on first visit for un-dismissed users
    useEffect(() => {
        if (!enabled || languageStatus === 'loading' || autoStarted.current) return
        const timer = window.setTimeout(() => {
            if (accountDismissed || dismissed.current) return
            try {
                if (localStorage.getItem(key) === 'done') {
                    dismissed.current = true
                    void syncDismissal()
                    return
                }
            } catch { /* Account state works without browser storage. */ }
            autoStarted.current = true
            setRequested(true)
        }, 0)
        return () => window.clearTimeout(timer)
    }, [enabled, key, accountDismissed, syncDismissal, languageStatus])

    // Offline retry
    useEffect(() => {
        const retry = () => { if (syncFailed) void syncDismissal() }
        window.addEventListener('online', retry)
        return () => window.removeEventListener('online', retry)
    }, [syncFailed, syncDismissal])

    const isTutorialActive = Boolean(active)
    useEffect(() => {
        onActiveChange?.(isTutorialActive)
    }, [isTutorialActive, onActiveChange])

    // Step preparation & collecting elements
    useEffect(() => {
        if (!requested || !enabled || languageStatus === 'loading') return
        onPrepare?.()
        const timer = window.setTimeout(() => {
            const root = document.querySelector('[data-ratebook-tutorial-root]')
            if (!root) { setRequested(false); return }

            const next: RatebookStep[] = ORDERED_STEPS.map(item => ({
                section: item.section,
                card: null,
                target: null,
                field: item.field,
                inSheet: item.inSheet,
                inPopover: item.inPopover,
            }))

            setIndex(0)
            setSteps(next)
            setRequested(false)
        }, 120)
        return () => window.clearTimeout(timer)
    }, [requested, enabled, onPrepare, languageStatus])

    // Orchestrating modal/popover/drawer states
    const isPopoverStep = active?.field === 'quickEditPopover'
    const isSheetStep = active?.field === 'rateDrawerFields'

    useEffect(() => {
        if (!active) {
            onOpenQuickEdit?.(false)
            onOpenRateDrawer?.(false)
            return
        }
        if (isPopoverStep) {
            onOpenQuickEdit?.(true)
            onOpenRateDrawer?.(false)
        } else if (isSheetStep) {
            onOpenRateDrawer?.(true)
            onOpenQuickEdit?.(false)
        } else {
            onOpenQuickEdit?.(false)
            onOpenRateDrawer?.(false)
        }
    }, [active, isPopoverStep, isSheetStep, onOpenQuickEdit, onOpenRateDrawer])

    const close = useCallback(() => {
        dismissed.current = true
        try { localStorage.setItem(key, 'done') } catch { /* Storage retry marker */ }
        void syncDismissal()
        prevSectionRef.current = null
        setIsSectionTransition(false)
        setPanelPlacement('top-right')
        setSteps([])
        setRects(null)
        onOpenQuickEdit?.(false)
        onOpenRateDrawer?.(false)
        if (typeof document !== 'undefined') {
            Array.from(document.body.children).forEach(el => {
                if (el instanceof HTMLElement && el.inert) {
                    el.inert = false
                }
            })
        }
    }, [key, syncDismissal, onOpenQuickEdit, onOpenRateDrawer])

    const handleNext = useCallback(() => {
        if (!steps.length) return
        if (index === steps.length - 1) {
            close()
        } else {
            setIndex(i => Math.min(steps.length - 1, i + 1))
        }
    }, [close, index, steps.length])

    const handleBack = useCallback(() => {
        setIndex(i => Math.max(0, i - 1))
    }, [])

    // Focus management and background element inertia
    useEffect(() => {
        if (!active) return
        const previousFocus = document.activeElement as HTMLElement | null
        const siblings = Array.from(document.body.children).filter(
            (el): el is HTMLElement =>
                el instanceof HTMLElement &&
                !el.contains(panel.current) &&
                el.getAttribute('data-testid') !== 'rate-book-tutorial' &&
                !el.hasAttribute('data-ratebook-portal') &&
                !el.hasAttribute('data-radix-popper-content-wrapper') &&
                !el.hasAttribute('data-radix-portal') &&
                !el.querySelector('[data-slot="popover-content"]') &&
                !el.querySelector('[data-slot="sheet-content"]') &&
                !el.querySelector('[data-ratebook-field="quickEditPopover"]') &&
                !el.querySelector('[data-ratebook-field="rateDrawerFields"]')
        )
        const prior = siblings.map(el => el.inert)
        siblings.forEach(el => { el.inert = true })
        panel.current?.focus({ preventScroll: true })
        const focusTimer = window.setTimeout(() => {
            if (panel.current && !panel.current.contains(document.activeElement)) {
                panel.current.focus({ preventScroll: true })
            }
        }, 50)
        return () => {
            window.clearTimeout(focusTimer)
            siblings.forEach((el, i) => { el.inert = prior[i] })
            previousFocus?.focus({ preventScroll: true })
        }
    }, [active])

    // Keyboard navigation
    useEffect(() => {
        if (!active) return
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                close()
                return
            }
            if (event.key === 'Enter') {
                const activeEl = document.activeElement
                if (activeEl instanceof HTMLButtonElement && (activeEl.dataset.tourControl === 'back' || activeEl.dataset.tourControl === 'skip')) {
                    return
                }
                event.preventDefault()
                handleNext()
                return
            }
            if (event.key === 'ArrowRight') {
                event.preventDefault()
                handleNext()
                return
            }
            if (event.key === 'ArrowLeft') {
                event.preventDefault()
                handleBack()
                return
            }
            if (event.key === 'Tab') {
                const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
                if (!buttons.length) return
                const first = buttons[0], last = buttons[buttons.length - 1]
                if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
                    event.preventDefault()
                    last.focus()
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault()
                    first.focus()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [active, close, handleNext, handleBack])

    // Spotlight measurement & adaptive viewport positioning
    useEffect(() => {
        if (!active) {
            setRects(null)
            return
        }

        let retryRaf: number | undefined
        let isMounted = true
        const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const scrollBehavior = prefersReducedMotion ? 'instant' : 'smooth'
        const viewportHeight = window.innerHeight
        const fixedPadding = 20

        const isModal = isPopoverStep || isSheetStep
        let stableFrames = 0
        let lastRect = { top: -9999, left: -9999, width: -9999, height: -9999 }
        const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now()

        const measureAndPosition = () => {
            if (!isMounted) return

            const { target: targetEl, card: cardEl } = resolveStepElements(active)

            if (!targetEl || !cardEl || !targetEl.getClientRects().length || !cardEl.getClientRects().length) {
                retryRaf = window.requestAnimationFrame(measureAndPosition)
                return
            }

            const cardRect = cardEl.getBoundingClientRect()
            const targetRect = targetEl.getBoundingClientRect()

            if (cardRect.width === 0 || cardRect.height === 0 || targetRect.width === 0 || targetRect.height === 0) {
                retryRaf = window.requestAnimationFrame(measureAndPosition)
                return
            }

            const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
            const elapsed = now - startTime
            const isMoving = Math.abs(cardRect.top - lastRect.top) > 0.5 ||
                             Math.abs(cardRect.left - lastRect.left) > 0.5 ||
                             Math.abs(cardRect.height - lastRect.height) > 0.5 ||
                             Math.abs(cardRect.width - lastRect.width) > 0.5

            if (isMoving && elapsed < 350) {
                lastRect = { top: cardRect.top, left: cardRect.left, width: cardRect.width, height: cardRect.height }
                stableFrames = 0
                retryRaf = window.requestAnimationFrame(measureAndPosition)
                return
            } else if (stableFrames < 1 && elapsed < 200) {
                stableFrames++
                lastRect = { top: cardRect.top, left: cardRect.left, width: cardRect.width, height: cardRect.height }
                retryRaf = window.requestAnimationFrame(measureAndPosition)
                return
            }

            const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
            const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
            const panelRect = panel.current?.getBoundingClientRect()
            const modalBottom = panelRect ? panelRect.bottom : 220
            const modalLeft = panelRect ? panelRect.left : viewportWidth - 268

            const rightThreshold = viewportWidth - 300
            const topThreshold = Math.max(380, modalBottom + 20)

            const targetOverlapsTopRight = !isSheetStep && (
                (targetRect.top < topThreshold && targetRect.bottom > 0 && targetRect.right > rightThreshold) ||
                (cardRect.top < topThreshold && cardRect.bottom > 0 && cardRect.right > rightThreshold)
            )

            const targetOverlapsBottomRight = (
                (targetRect.bottom > viewportHeight - 440 && targetRect.top < viewportHeight && targetRect.right > rightThreshold) ||
                (cardRect.bottom > viewportHeight - 440 && cardRect.top < viewportHeight && cardRect.right > rightThreshold)
            )

            const targetIsTopRight = (!isSheetStep && targetRect.top < 380 && (targetOverlapsTopRight || targetRect.right > rightThreshold)) || (targetOverlapsTopRight && !targetOverlapsBottomRight)
            setPanelPlacement(targetIsTopRight ? 'bottom-right' : 'top-right')

            const isNewSection = prevSectionRef.current !== null && prevSectionRef.current !== active.section
            prevSectionRef.current = active.section

            const isFixed = isModal ||
                window.getComputedStyle(targetEl).position === 'fixed' ||
                window.getComputedStyle(cardEl).position === 'fixed' ||
                Boolean(targetEl.closest('.fixed') || cardEl.closest('.fixed'))

            let deltaY = 0
            active.card = cardEl
            active.target = targetEl

            if (isFixed) {
                deltaY = 0
                targetEl.scrollIntoView({ block: 'nearest', behavior: 'auto' })
            } else {
                const isHorizontallyOverlapping = cardRect.right > modalLeft - fixedPadding && cardRect.left < (panelRect ? panelRect.right : window.innerWidth)
                const isPanelAtTop = !targetIsTopRight
                const minAllowedTop = isHorizontallyOverlapping && isPanelAtTop ? modalBottom + fixedPadding : 16

                if (isNewSection) {
                    setIsSectionTransition(true)
                    const centeredTop = Math.max(16, (viewportHeight - active.card.offsetHeight) / 2)
                    const targetCardTop = active.card.offsetHeight <= viewportHeight
                        ? Math.max(centeredTop, minAllowedTop)
                        : minAllowedTop
                    deltaY = cardRect.top - targetCardTop
                } else if (active.card.offsetHeight <= viewportHeight) {
                    const minAllowedTargetTop = isHorizontallyOverlapping ? modalBottom + fixedPadding : 16
                    if (targetRect.top < minAllowedTargetTop) {
                        deltaY = targetRect.top - minAllowedTargetTop
                    } else if (targetRect.bottom > viewportHeight - 20) {
                        deltaY = targetRect.bottom - (viewportHeight - 20)
                    } else {
                        deltaY = 0
                    }
                } else {
                    const minAllowedTargetTop = isHorizontallyOverlapping ? modalBottom + fixedPadding : 16
                    if (targetRect.top < minAllowedTargetTop) {
                        deltaY = targetRect.top - minAllowedTargetTop
                    } else if (targetRect.bottom > viewportHeight - 20) {
                        deltaY = targetRect.bottom - (viewportHeight - 20)
                    }
                }

                const maxScrollY = typeof document !== 'undefined'
                    ? Math.max(0, document.documentElement.scrollHeight - viewportHeight)
                    : 0
                const currentScrollY = typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0
                const maxDeltaDown = Math.max(0, maxScrollY - currentScrollY)
                const maxDeltaUp = -currentScrollY
                deltaY = Math.max(maxDeltaUp, Math.min(deltaY, maxDeltaDown))
            }

            if (Math.abs(deltaY) > 2) {
                window.scrollBy({ top: deltaY, behavior: scrollBehavior })
            }

            const updatedCard = cardEl.getBoundingClientRect()
            const updatedField = targetEl.getBoundingClientRect()
            setRects({ card: updatedCard, field: updatedField })

            if (isNewSection) {
                window.setTimeout(() => {
                    if (isMounted) setIsSectionTransition(false)
                }, 500)
            }
        }

        retryRaf = window.requestAnimationFrame(measureAndPosition)

        const handleManualScrollOrResize = () => {
            const { target: curTarget, card: curCard } = resolveStepElements(active)
            if (curTarget && curCard && curTarget.getClientRects().length && curCard.getClientRects().length) {
                setRects({
                    field: curTarget.getBoundingClientRect(),
                    card: curCard.getBoundingClientRect(),
                })
            }
        }

        window.addEventListener('scroll', handleManualScrollOrResize, true)
        window.addEventListener('resize', handleManualScrollOrResize)

        return () => {
            isMounted = false
            if (retryRaf) window.cancelAnimationFrame(retryRaf)
            window.removeEventListener('scroll', handleManualScrollOrResize, true)
            window.removeEventListener('resize', handleManualScrollOrResize)
        }
    }, [active, isPopoverStep, isSheetStep])

    const [replayTitle, replaySubtitle] = copy.replay.includes(' · ')
        ? copy.replay.split(' · ')
        : [copy.replay, '']

    return (
        <>
            {syncFailed && (
                <div data-i18n-skip="true" lang={language} role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/60 p-2.5 text-xs text-[var(--color-muted)]">
                    <span className="text-amber-900">{copy.syncFailed}</span>
                    <button type="button" className="font-semibold text-amber-800 underline hover:text-amber-900" onClick={() => void syncDismissal()}>{copy.retry}</button>
                </div>
            )}

            {enabled && (
                <button
                    data-i18n-skip="true"
                    lang={language}
                    type="button"
                    onClick={() => setRequested(true)}
                    disabled={languageStatus === 'loading'}
                    className="group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-amber-200/90 bg-amber-50/75 px-3.5 py-2.5 text-left text-sm font-semibold text-slate-800 shadow-xs transition-all duration-150 hover:border-amber-300 hover:bg-amber-100/70 hover:shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-saffron active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
                    aria-label={copy.replay}
                    title={copy.replay}
                >
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 transition-colors group-hover:bg-amber-200">
                            <Compass className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-900">{replayTitle}</p>
                            {replaySubtitle && (
                                <p className="truncate text-[11px] font-medium text-amber-700">{replaySubtitle}</p>
                            )}
                        </div>
                    </div>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100/90 text-amber-700 transition-colors group-hover:bg-amber-200">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                </button>
            )}

            {active && createPortal(
                <div data-i18n-skip="true" lang={language} data-ratebook-portal="true" className="fixed inset-0 z-[100]" data-testid="rate-book-tutorial">
                    <div
                        aria-hidden="true"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                        className="absolute inset-0 bg-black/55 backdrop-blur-xs transition-opacity duration-300 select-none cursor-default"
                        style={{
                            transition: 'clip-path 500ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
                            ...(rects ? {
                                clipPath: `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${rects.card.left}px ${rects.card.top}px, ${rects.card.left}px ${rects.card.bottom}px, ${rects.card.right}px ${rects.card.bottom}px, ${rects.card.right}px ${rects.card.top}px, ${rects.card.left}px ${rects.card.top}px)`
                            } : {})
                        }}
                    />

                    {rects && (
                        <div
                            className={`pointer-events-none fixed rounded-[18px] border-2 transition-all duration-500 ease-out ${
                                isSectionTransition
                                    ? 'border-saffron/80 shadow-[0_0_0_1px_rgba(217,119,6,0.5),0_0_50px_rgba(217,119,6,0.35)] ring-2 ring-saffron/30'
                                    : 'border-saffron/40 shadow-[0_0_0_1px_rgba(217,119,6,0.3),0_0_35px_rgba(217,119,6,0.2)]'
                            }`}
                            style={{
                                left: rects.card.left - 4,
                                top: rects.card.top - 4,
                                width: rects.card.width + 8,
                                height: rects.card.height + 8,
                            }}
                        />
                    )}

                    {rects && (
                        <div
                            className={`pointer-events-none fixed rounded-lg border-2 border-saffron ring-4 ring-saffron/30 transition-all ${
                                isSectionTransition ? 'duration-500 ease-out' : 'duration-300 ease-out'
                            }`}
                            style={{
                                left: rects.field.left - 4,
                                top: rects.field.top - 4,
                                width: rects.field.width + 8,
                                height: rects.field.height + 8,
                            }}
                        />
                    )}

                    <div
                        ref={panel}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ratebook-tour-title"
                        aria-describedby="ratebook-tour-description"
                        tabIndex={-1}
                        onClick={(e) => e.stopPropagation()}
                        className={`fixed z-[101] w-[calc(100vw-2rem)] sm:w-[260px] max-w-[268px] min-h-[420px] sm:min-h-[440px] max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border border-amber-200/90 dark:border-amber-500/30 bg-[var(--color-surface)] p-3.5 sm:p-4 text-[var(--color-ink)] shadow-2xl outline-none transition-all duration-300 flex flex-col justify-between ${
                            panelPlacement === 'bottom-right'
                                ? 'bottom-4 right-4 sm:bottom-5 sm:right-5'
                                : 'top-4 right-4 sm:top-5 sm:right-5'
                        }`}
                    >
                        <div className="flex-1 flex flex-col">
                            <div aria-live="polite" key={`step-${active.section}-${active.field}`} className="animate-in fade-in-0 slide-in-from-right-3 duration-300">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset transition-all duration-300 ${
                                        isSectionTransition
                                            ? 'bg-saffron text-white ring-saffron shadow-sm scale-105'
                                            : 'bg-saffron/10 text-saffron-deep ring-saffron/25'
                                    }`}>
                                        {copy.sectionProgress.replace('{current}', String(active.section + 1)).replace('{total}', String(copy.sections.length))}
                                    </span>
                                    <span className="text-[11px] font-semibold text-[var(--color-ink)]/70">· {copy.sections[active.section]}</span>
                                </div>
                                <h2 id="ratebook-tour-title" className="mt-2 text-sm sm:text-base font-bold tracking-tight text-[var(--color-ink)] leading-snug">
                                    {copy.fields[active.field]?.title}
                                </h2>
                                <p id="ratebook-tour-description" className="mt-2 text-xs leading-relaxed text-[var(--color-ink)]/90">
                                    {copy.fields[active.field]?.description}
                                </p>
                            </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-hairline/60 space-y-2.5 shrink-0">
                            <p className="text-[10.5px] text-[var(--color-muted)] leading-tight">{copy.hint}</p>

                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-100 dark:bg-amber-950/50" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={steps.length} aria-label={copy.progress}>
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-saffron to-amber-500 transition-all duration-300 ease-out"
                                    style={{ width: `${Math.round(((index + 1) / steps.length) * 100)}%` }}
                                />
                            </div>

                            <div className="flex items-center justify-between gap-1 pt-0.5">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    data-tour-control="skip"
                                    className="h-7 px-1.5 text-xs text-subtle hover:text-ink"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        close()
                                    }}
                                >
                                    {copy.skip}
                                </Button>
                                <span className="text-[11px] font-semibold text-[var(--color-muted)] shrink-0">{index + 1}/{steps.length}</span>
                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        data-tour-control="back"
                                        disabled={index === 0}
                                        className="h-7 px-2 text-xs"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleBack()
                                        }}
                                    >
                                        {copy.back}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        data-tour-control="next"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleNext()
                                        }}
                                        className="group h-7 gap-1 px-2.5 text-xs font-semibold bg-saffron text-white hover:bg-saffron-deep shadow-sm transition-all"
                                    >
                                        <span>{index === steps.length - 1 ? copy.finish : copy.next}</span>
                                        <kbd className="hidden sm:inline-flex h-3 items-center rounded border border-white/25 bg-white/20 px-1 text-[8.5px] font-sans font-semibold leading-none text-white shadow-xs group-hover:bg-white/30 transition-colors">↵</kbd>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
