'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { dismissCostEstimateTutorial } from '@/app/(dashboard)/owner/estimator/tutorial-actions'
import { useTranslation } from '@/lib/i18n/context'
import { costEstimateTutorialCopy, isTutorialField, type TutorialField } from '@/lib/i18n/cost-estimate-tutorial'
import { Button } from '@/components/ui/button'
import { Compass, Sparkles } from 'lucide-react'

type Step = { section: number; target: HTMLElement | null; card: HTMLElement | null; field: TutorialField; inModal?: boolean }

function resolveStepElements(step: Step): { target: HTMLElement | null; card: HTMLElement | null } {
    let target = step.target && document.body.contains(step.target) ? step.target : null
    let card = step.card && document.body.contains(step.card) ? step.card : null

    if (!target) {
        target = document.querySelector<HTMLElement>(`[data-estimator-field="${step.field}"]`)
    }
    const isModalField = Boolean(step.inModal || ['liveCostReadiness', 'liveCostMetrics', 'liveCostAssumptions', 'liveCostActions'].includes(step.field))
    if (isModalField) {
        const modalPanel = document.getElementById('mobile-live-estimate-panel')
        if (modalPanel) {
            card = modalPanel
        }
    }
    if (!card && target) {
        card = target.closest<HTMLElement>('#mobile-live-estimate-panel') ??
               target.closest<HTMLElement>('[data-slot="card"]') ??
               target.closest<HTMLElement>('[data-testid="mobile-live-estimate-shortcut"]') ??
               target
    }
    return { target, card }
}

export function CostEstimateTutorial({ enabled, orgId, userId, accountDismissed, onPrepare, onOpenLiveCostModal, onActiveChange }: {
    accountDismissed: boolean; enabled: boolean; orgId: string; userId: string; onPrepare: () => void
    onOpenLiveCostModal?: (open: boolean) => void
    onActiveChange?: (active: boolean) => void
}) {
    const { language, languageStatus } = useTranslation()
    const copy = costEstimateTutorialCopy[language]
    const [steps, setSteps] = useState<Step[]>([])
    const [index, setIndex] = useState(0)
    const [requested, setRequested] = useState(false)
    const [rects, setRects] = useState<{ field: DOMRect; card: DOMRect } | null>(null)
    const panel = useRef<HTMLDivElement>(null)
    const tutorialRows = useRef<HTMLElement[]>([])
    const key = `weavly:cost-estimate-tutorial:v1:${orgId}:${userId}`
    const active = steps[index]
    const dismissed = useRef(accountDismissed)
    const syncing = useRef(false)
    const autoStarted = useRef(false)
    const [syncFailed, setSyncFailed] = useState(false)
    const prevSectionRef = useRef<number | null>(null)
    const [isSectionTransition, setIsSectionTransition] = useState(false)
    const isScrollingRef = useRef(false)
    const [panelPlacement, setPanelPlacement] = useState<'top-right' | 'bottom-right'>('top-right')

    const syncDismissal = useCallback(async () => {
        if (syncing.current) return
        syncing.current = true
        try {
            const result = await dismissCostEstimateTutorial()
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

    useEffect(() => {
        if (!enabled || languageStatus === 'loading' || autoStarted.current) return
        const timer = window.setTimeout(() => {
            if (accountDismissed || dismissed.current) return
            // Migrate old browser-only completions and retry unconfirmed account saves.
            try {
                if (localStorage.getItem(key) === 'done') {
                    dismissed.current = true
                    void syncDismissal()
                    return
                }
            } catch { /* Account state still works without browser storage. */ }
            autoStarted.current = true
            setRequested(true)
        }, 0)
        return () => window.clearTimeout(timer)
    }, [enabled, key, accountDismissed, syncDismissal, languageStatus])

    useEffect(() => {
        const retry = () => { if (syncFailed) void syncDismissal() }
        window.addEventListener('online', retry)
        return () => window.removeEventListener('online', retry)
    }, [syncFailed, syncDismissal])

    useEffect(() => {
        return () => {
            tutorialRows.current.forEach(row => row.dispatchEvent(new CustomEvent('tutorial-expand-row', { detail: false })))
        }
    }, [])

    const isTutorialActive = Boolean(active)
    useEffect(() => {
        onActiveChange?.(isTutorialActive)
    }, [isTutorialActive, onActiveChange])

    const isModalStep = Boolean(active?.inModal || (active?.field && ['liveCostReadiness', 'liveCostMetrics', 'liveCostAssumptions', 'liveCostActions'].includes(active.field)))

    useEffect(() => {
        if (!active) {
            onOpenLiveCostModal?.(false)
            return
        }
        if (isModalStep) {
            onOpenLiveCostModal?.(true)
        } else {
            onOpenLiveCostModal?.(false)
        }
    }, [active, isModalStep, onOpenLiveCostModal])

    useEffect(() => {
        if (!isTutorialActive) return
        const root = document.querySelector<HTMLElement>('[data-costing-tutorial-root]')
        if (!root) return
        const originalPaddingBottom = root.style.paddingBottom
        root.style.paddingBottom = '40vh'
        return () => {
            root.style.paddingBottom = originalPaddingBottom
        }
    }, [isTutorialActive])

    useEffect(() => {
        if (!requested || !enabled || languageStatus === 'loading') return
        onPrepare()
        let observer: MutationObserver | undefined
        // Quick view can change on replay. Wait for its commit, then expand rows
        // and observe their actual DOM mount rather than guessing a render delay.
        const timer = window.setTimeout(() => {
            const root = document.querySelector('[data-costing-tutorial-root]')
            if (!root) { setRequested(false); return }
            tutorialRows.current = Array.from(root.querySelectorAll<HTMLElement>('[data-estimator-row]'))
            const collect = () => {
                if (tutorialRows.current.some(row => row.querySelector('[aria-expanded]')?.getAttribute('aria-expanded') !== 'true')) return
                const next: Step[] = []
                const headers = Array.from(document.querySelectorAll<HTMLElement>('[data-tutorial-section]'))
                    .sort((a, b) => Number(a.dataset.tutorialSection) - Number(b.dataset.tutorialSection))

                headers.forEach(header => {
                    const section = Number(header.dataset.tutorialSection) - 1
                    if (!costEstimateTutorialCopy.en.sections[section]) return
                    const card = header.closest<HTMLElement>('[data-slot="card"]') ?? header

                    if (header.dataset.estimatorField && isTutorialField(header.dataset.estimatorField)) {
                        if (header.dataset.estimatorField === 'liveCostShortcut') {
                            next.push({
                                section,
                                card: header.closest<HTMLElement>('[data-testid="mobile-live-estimate-shortcut"]') ?? header,
                                target: header,
                                field: 'liveCostShortcut'
                            })
                            const modalFields: TutorialField[] = ['liveCostReadiness', 'liveCostMetrics', 'liveCostAssumptions', 'liveCostActions']
                            modalFields.forEach(field => {
                                next.push({ section, card: null, target: null, field, inModal: true })
                            })
                            return
                        }

                        if (header.getClientRects().length) {
                            next.push({ section, card, target: header, field: header.dataset.estimatorField as TutorialField })
                        }
                        return
                    }

                    card.querySelectorAll<HTMLElement>('[data-estimator-field]').forEach(target => {
                        const field = target.dataset.estimatorField!
                        if (!isTutorialField(field) || !target.getClientRects().length) return
                        const targetSection = target.closest<HTMLElement>('[data-tutorial-section]')
                        if (targetSection && targetSection !== header) return
                        next.push({ section, card, target, field })
                    })
                })
                observer?.disconnect()
                setIndex(0)
                setSteps(next)
                setRequested(false)
            }
            observer = new MutationObserver(collect)
            observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded'] })
            tutorialRows.current.forEach(row => row.dispatchEvent(new CustomEvent('tutorial-expand-row', { detail: true })))
            collect()
        }, 150)
        return () => { window.clearTimeout(timer); observer?.disconnect() }
    }, [requested, enabled, onPrepare, languageStatus])

    const close = useCallback(() => {
        tutorialRows.current.forEach(row => row.dispatchEvent(new CustomEvent('tutorial-expand-row', { detail: false })))
        tutorialRows.current = []
        dismissed.current = true
        // Only a retry marker: the account flag is the source of truth.
        try { localStorage.setItem(key, 'done') } catch { /* Still allow dismissal. */ }
        void syncDismissal()
        prevSectionRef.current = null
        setIsSectionTransition(false)
        setPanelPlacement('top-right')
        setSteps([])
        setRects(null)
        onOpenLiveCostModal?.(false)
    }, [key, syncDismissal, onOpenLiveCostModal])

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

    useEffect(() => {
        if (!active) return
        const previousFocus = document.activeElement as HTMLElement | null
        const siblings = Array.from(document.body.children).filter((el): el is HTMLElement => el instanceof HTMLElement && !el.contains(panel.current))
        const prior = siblings.map(el => el.inert)
        siblings.forEach(el => { el.inert = true })
        panel.current?.focus({ preventScroll: true })
        return () => {
            siblings.forEach((el, i) => { el.inert = prior[i] })
            previousFocus?.focus({ preventScroll: true })
        }
    }, [active])

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
                // If focus is specifically on a non-next control (e.g. Back or Skip button), let native click handle it
                if (activeEl instanceof HTMLButtonElement && activeEl.dataset.tourControl !== 'next') {
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
    }, [active, handleNext, handleBack, close])

    useEffect(() => {
        if (!active) return

        let isMounted = true
        let settleTimer: number | undefined
        let retryRaf: number | undefined

        const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const scrollBehavior = prefersReducedMotion ? 'instant' : 'smooth'
        const viewportHeight = window.innerHeight
        const fixedPadding = 20

        const isModal = Boolean(active.inModal || ['liveCostReadiness', 'liveCostMetrics', 'liveCostAssumptions', 'liveCostActions'].includes(active.field))

        let stableFrames = 0
        let lastRect = { top: -9999, left: -9999, width: -9999, height: -9999 }
        const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now()

        const measureAndPosition = () => {
            if (!isMounted) return

            if (isModal) {
                onOpenLiveCostModal?.(true)
            }

            const { target: targetEl, card: cardEl } = resolveStepElements(active)

            if (!targetEl || !cardEl || !targetEl.getClientRects().length || !cardEl.getClientRects().length) {
                retryRaf = window.requestAnimationFrame(measureAndPosition)
                return
            }

            const cardRect = cardEl.getBoundingClientRect()
            const targetRect = targetEl.getBoundingClientRect()

            // If card or target has not been laid out (0 dimensions), retry on next frame
            if (cardRect.width === 0 || cardRect.height === 0 || targetRect.width === 0 || targetRect.height === 0) {
                retryRaf = window.requestAnimationFrame(measureAndPosition)
                return
            }

            // Ensure coordinates have stabilized across consecutive frames (handles modal mounting & CSS animation)
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

            // Measure explainer modal boundaries to adaptively prevent overlap
            const panelRect = panel.current?.getBoundingClientRect()
            const modalBottom = panelRect ? panelRect.bottom : 220
            const modalLeft = panelRect ? panelRect.left : window.innerWidth - 420

            const targetIsTopRight = !isModal && targetRect.top < 340 && targetRect.right > (typeof window !== 'undefined' ? window.innerWidth - 460 : 600)
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
                // Never scroll the window behind fixed elements or modal dialogs
                deltaY = 0
                if (isModal) {
                    targetEl.scrollIntoView({ block: 'nearest', behavior: 'auto' })
                }
            } else {
                const isHorizontallyOverlapping = cardRect.right > modalLeft - fixedPadding && cardRect.left < (panelRect ? panelRect.right : window.innerWidth)
                const minAllowedTop = isHorizontallyOverlapping ? modalBottom + fixedPadding : 16

                if (isNewSection) {
                    setIsSectionTransition(true)
                    // When entering a new section, frame the top of the card cleanly so the header and initial controls are visible
                    const centeredTop = Math.max(16, (viewportHeight - active.card.offsetHeight) / 2)
                    const targetCardTop = active.card.offsetHeight <= viewportHeight
                        ? Math.max(centeredTop, minAllowedTop)
                        : minAllowedTop
                    deltaY = cardRect.top - targetCardTop
                } else if (active.card.offsetHeight <= viewportHeight) {
                    // Card fits in viewport. When navigating between fields in the same section,
                    // never re-center the card; move directly from one field to the next without scrolling.
                    const minAllowedTargetTop = isHorizontallyOverlapping ? modalBottom + fixedPadding : 16
                    if (targetRect.top < minAllowedTargetTop) {
                        deltaY = targetRect.top - minAllowedTargetTop
                    } else if (targetRect.bottom > viewportHeight - 20) {
                        deltaY = targetRect.bottom - (viewportHeight - 20)
                    } else {
                        deltaY = 0
                    }
                } else {
                    // Card is taller than viewport. Ensure active field clears modal and remains visible in viewport.
                    const minAllowedTargetTop = isHorizontallyOverlapping ? modalBottom + fixedPadding : 16
                    if (targetRect.top < minAllowedTargetTop) {
                        deltaY = targetRect.top - minAllowedTargetTop
                    } else if (targetRect.bottom > viewportHeight - 20) {
                        deltaY = targetRect.bottom - (viewportHeight - 20)
                    }
                }

                // Clamp deltaY to the document's actual scrollable limits so we never subtract a phantom scroll distance
                const maxScrollY = typeof document !== 'undefined'
                    ? Math.max(0, document.documentElement.scrollHeight - viewportHeight)
                    : 0
                const currentScrollY = typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0
                const maxDeltaDown = Math.max(0, maxScrollY - currentScrollY)
                const maxDeltaUp = -currentScrollY
                deltaY = Math.max(maxDeltaUp, Math.min(deltaY, maxDeltaDown))
            }

            const update = () => {
                if (!isMounted) return
                const { target: curTarget, card: curCard } = resolveStepElements(active)
                if (curTarget && curCard && curTarget.getClientRects().length && curCard.getClientRects().length) {
                    setRects({
                        field: curTarget.getBoundingClientRect(),
                        card: curCard.getBoundingClientRect(),
                    })
                }
            }

            if (Math.abs(deltaY) > 2 && scrollBehavior === 'smooth') {
                isScrollingRef.current = true
                window.scrollBy({ top: deltaY, behavior: 'smooth' })

                // Set target rects immediately to the expected post-scroll viewport position.
                // This allows CSS transitions (duration-500) to smoothly morph from the old position
                // to the new section position without any pre-scroll snap down the screen.
                const targetCardRect = {
                    left: cardRect.left,
                    right: cardRect.right,
                    width: cardRect.width,
                    height: cardRect.height,
                    top: cardRect.top - deltaY,
                    bottom: cardRect.bottom - deltaY,
                    x: cardRect.x,
                    y: cardRect.y - deltaY,
                    toJSON: () => ({}),
                } as DOMRect

                const targetFieldRect = {
                    left: targetRect.left,
                    right: targetRect.right,
                    width: targetRect.width,
                    height: targetRect.height,
                    top: targetRect.top - deltaY,
                    bottom: targetRect.bottom - deltaY,
                    x: targetRect.x,
                    y: targetRect.y - deltaY,
                    toJSON: () => ({}),
                } as DOMRect

                setRects({ field: targetFieldRect, card: targetCardRect })

                settleTimer = window.setTimeout(() => {
                    isScrollingRef.current = false
                    update()
                    setIsSectionTransition(false)
                }, isNewSection ? 550 : 350)
            } else {
                if (Math.abs(deltaY) > 2) {
                    window.scrollBy({ top: deltaY, behavior: 'auto' })
                }
                update()
                if (isNewSection) {
                    setIsSectionTransition(true)
                }
                settleTimer = window.setTimeout(() => {
                    update()
                    if (isNewSection) setIsSectionTransition(false)
                }, isNewSection ? 500 : 200)
            }
        }

        const timer = window.setTimeout(() => {
            measureAndPosition()
        }, 0)

        const backupTimer = window.setTimeout(() => {
            if (!isMounted) return
            const { target: curTarget, card: curCard } = resolveStepElements(active)
            if (curTarget && curCard && curTarget.getClientRects().length && curCard.getClientRects().length) {
                setRects({
                    field: curTarget.getBoundingClientRect(),
                    card: curCard.getBoundingClientRect(),
                })
            }
        }, 350)

        return () => {
            isMounted = false
            window.clearTimeout(timer)
            window.clearTimeout(backupTimer)
            if (settleTimer) window.clearTimeout(settleTimer)
            if (retryRaf) window.cancelAnimationFrame(retryRaf)
        }
    }, [active])

    useEffect(() => {
        if (!active) return
        const { target: targetEl, card: cardEl } = resolveStepElements(active)
        if (!targetEl || !cardEl) return

        const handleManualScrollOrResize = () => {
            if (!isScrollingRef.current) {
                const { target: curTarget, card: curCard } = resolveStepElements(active)
                if (curTarget && curCard) {
                    setRects({
                        field: curTarget.getBoundingClientRect(),
                        card: curCard.getBoundingClientRect(),
                    })
                }
            }
        }
        window.addEventListener('scroll', handleManualScrollOrResize, true)
        window.addEventListener('resize', handleManualScrollOrResize)
        const observer = new ResizeObserver(handleManualScrollOrResize)
        observer.observe(cardEl)
        observer.observe(targetEl)
        return () => {
            window.removeEventListener('scroll', handleManualScrollOrResize, true)
            window.removeEventListener('resize', handleManualScrollOrResize)
            observer.disconnect()
        }
    }, [active])

    const [replayTitle, replaySubtitle] = copy.replay.includes(' · ')
        ? copy.replay.split(' · ')
        : [copy.replay, '']

    return <>
        {syncFailed && <div data-i18n-skip="true" lang={language} role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/60 p-2.5 text-xs text-[var(--color-muted)]">
            <span className="text-amber-900">{copy.syncFailed}</span>
            <button type="button" className="font-semibold text-amber-800 underline hover:text-amber-900" onClick={() => void syncDismissal()}>{copy.retry}</button>
        </div>}
        {enabled && (
            <button
                data-i18n-skip="true"
                lang={language}
                type="button"
                onClick={() => setRequested(true)}
                disabled={languageStatus === 'loading'}
                className="estimator-touch-target group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-amber-200/90 bg-amber-50/75 px-3.5 py-2.5 text-left text-sm font-semibold text-slate-800 shadow-xs transition-all duration-150 hover:border-amber-300 hover:bg-amber-100/70 hover:shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
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
        {active && createPortal(<div data-i18n-skip="true" lang={language} className="fixed inset-0 z-[100]" data-testid="cost-estimate-tutorial">
            <div
                className="absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-300"
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
                            ? 'border-orange-500/60 shadow-[0_0_0_1px_rgba(249,115,22,0.4),0_0_50px_rgba(249,115,22,0.32)] ring-2 ring-orange-400/25'
                            : 'border-orange-500/35 shadow-[0_0_0_1px_rgba(249,115,22,0.25),0_0_35px_rgba(249,115,22,0.2)]'
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
                    className={`pointer-events-none fixed rounded-lg border-2 border-orange-500 ring-4 ring-orange-400/30 transition-all ${
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
            <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="cost-tour-title" aria-describedby="cost-tour-description" tabIndex={-1}
                className={`fixed z-[101] w-[calc(100vw-2rem)] sm:w-[400px] max-w-[420px] max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-[var(--color-surface)] p-4 sm:p-5 text-[var(--color-ink)] shadow-2xl outline-none transition-all duration-300 ${
                    panelPlacement === 'bottom-right'
                        ? 'bottom-4 right-4 sm:bottom-6 sm:right-6'
                        : 'top-4 right-4 sm:top-6 sm:right-6'
                }`}>
                <div aria-live="polite" key={`step-${active.section}-${active.field}`} className="animate-in fade-in-0 slide-in-from-right-3 duration-300">
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset transition-all duration-300 ${
                            isSectionTransition
                                ? 'bg-orange-500 text-white ring-orange-500 shadow-sm scale-105'
                                : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/25'
                        }`}>
                            {copy.sectionProgress.replace('{current}', String(active.section + 1)).replace('{total}', String(copy.sections.length))}
                        </span>
                        <span className="text-xs font-semibold text-[var(--color-ink)]/70">· {copy.sections[active.section]}</span>
                    </div>
                    <h2 id="cost-tour-title" className="mt-1.5 text-base sm:text-lg font-semibold text-[var(--color-ink)]">{copy.fields[active.field].title}</h2>
                    <p id="cost-tour-description" className="mt-1 text-sm leading-relaxed text-[var(--color-ink)]/90">{copy.fields[active.field].description}</p>
                </div>
                <p className="mt-2.5 text-xs text-[var(--color-muted)]">{copy.hint}</p>
                <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-orange-100 dark:bg-orange-950/50" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={steps.length} aria-label={copy.progress}>
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300 ease-out"
                        style={{ width: `${Math.round(((index + 1) / steps.length) * 100)}%` }}
                    />
                </div>
                <div className="mt-3.5 flex items-center justify-between gap-2">
                    <Button variant="ghost" size="sm" data-tour-control="skip" onClick={close}>{copy.skip}</Button>
                    <span className="text-xs font-medium text-[var(--color-muted)]">{index + 1}/{steps.length}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-tour-control="back" disabled={index === 0} onClick={handleBack}>{copy.back}</Button>
                        <Button size="sm" data-tour-control="next" onClick={handleNext} className="group gap-1.5 font-medium shadow-sm transition-all">
                            <span>{index === steps.length - 1 ? copy.finish : copy.next}</span>
                            <kbd className="hidden sm:inline-flex h-4 items-center rounded border border-white/25 bg-white/20 px-1 text-[10px] font-sans font-semibold leading-none text-white shadow-xs group-hover:bg-white/30 transition-colors">↵</kbd>
                        </Button>
                    </div>
                </div>
            </div>
        </div>, document.body)}
    </>
}
