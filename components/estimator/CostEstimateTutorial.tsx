'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { dismissCostEstimateTutorial } from '@/app/(dashboard)/owner/estimator/tutorial-actions'
import { useTranslation } from '@/lib/i18n/context'
import { costEstimateTutorialCopy, isTutorialField, type TutorialField } from '@/lib/i18n/cost-estimate-tutorial'
import { Button } from '@/components/ui/button'

type Step = { section: number; target: HTMLElement; card: HTMLElement; field: TutorialField }

export function CostEstimateTutorial({ enabled, orgId, userId, accountDismissed, onPrepare }: {
    accountDismissed: boolean; enabled: boolean; orgId: string; userId: string; onPrepare: () => void
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
                root.querySelectorAll<HTMLElement>('[data-tutorial-section]').forEach(header => {
                    const section = Number(header.dataset.tutorialSection) - 1
                    const card = header.closest<HTMLElement>('[data-slot="card"]')
                    if (!card || !costEstimateTutorialCopy.en.sections[section]) return
                    card.querySelectorAll<HTMLElement>('[data-estimator-field]').forEach(target => {
                        const field = target.dataset.estimatorField!
                        if (!isTutorialField(field) || !target.getClientRects().length) return
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
        setSteps([])
        setRects(null)
    }, [key, syncDismissal])

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
        const update = () => setRects({ field: active.target.getBoundingClientRect(), card: active.card.getBoundingClientRect() })
        const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const scrollBehavior = prefersReducedMotion ? 'instant' : 'smooth'
        const viewportHeight = window.innerHeight
        const fixedPadding = 20

        // Measure explainer modal boundaries to adaptively prevent overlap
        const panelRect = panel.current?.getBoundingClientRect()
        const modalBottom = panelRect ? panelRect.bottom : 220
        const modalLeft = panelRect ? panelRect.left : window.innerWidth - 420

        const cardRect = active.card.getBoundingClientRect()
        const targetRect = active.target.getBoundingClientRect()
        const isHorizontallyOverlapping = cardRect.right > modalLeft - fixedPadding && cardRect.left < (panelRect ? panelRect.right : window.innerWidth)

        if (active.card.offsetHeight <= viewportHeight) {
            // Card fits in viewport. Compute default centered top position.
            const centeredTop = Math.max(16, (viewportHeight - active.card.offsetHeight) / 2)
            // If the card shares horizontal space with the top-right modal, ensure it clears modalBottom by fixedPadding.
            const minAllowedTop = isHorizontallyOverlapping ? modalBottom + fixedPadding : 16
            const targetCardTop = Math.max(centeredTop, minAllowedTop)
            const deltaY = cardRect.top - targetCardTop

            if (Math.abs(deltaY) > 2) {
                window.scrollBy({ top: deltaY, behavior: scrollBehavior })
            }
        } else {
            // Card is taller than viewport. Ensure active field clears modal and remains visible in viewport.
            const minAllowedTargetTop = isHorizontallyOverlapping ? modalBottom + fixedPadding : 16
            if (targetRect.top < minAllowedTargetTop) {
                window.scrollBy({ top: targetRect.top - minAllowedTargetTop, behavior: scrollBehavior })
            } else if (targetRect.bottom > viewportHeight - 20) {
                window.scrollBy({ top: targetRect.bottom - (viewportHeight - 20), behavior: scrollBehavior })
            }
        }

        update()

        // Sync spotlight cutout continuously during smooth scroll animation
        let rafId: number
        const startTime = performance.now()
        const syncLoop = (now: number) => {
            update()
            if (now - startTime < 750) {
                rafId = requestAnimationFrame(syncLoop)
            }
        }
        rafId = requestAnimationFrame(syncLoop)

        const observer = new ResizeObserver(update)
        observer.observe(active.card)
        observer.observe(active.target)
        window.addEventListener('scroll', update, true)
        window.addEventListener('resize', update)
        return () => {
            cancelAnimationFrame(rafId)
            observer.disconnect()
            window.removeEventListener('scroll', update, true)
            window.removeEventListener('resize', update)
        }
    }, [active])

    return <>
        {syncFailed && <div data-i18n-skip="true" lang={language} role="status" className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
            <span>{copy.syncFailed}</span>
            <Button type="button" variant="ghost" onClick={() => void syncDismissal()}>{copy.retry}</Button>
        </div>}
        {enabled && <Button data-i18n-skip="true" lang={language} type="button" variant="ghost" onClick={() => setRequested(true)} disabled={languageStatus === 'loading'}>{copy.replay}</Button>}
        {active && createPortal(<div data-i18n-skip="true" lang={language} className="fixed inset-0 z-[100]" data-testid="cost-estimate-tutorial">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-300" style={rects ? { clipPath: `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${rects.card.left}px ${rects.card.top}px, ${rects.card.left}px ${rects.card.bottom}px, ${rects.card.right}px ${rects.card.bottom}px, ${rects.card.right}px ${rects.card.top}px, ${rects.card.left}px ${rects.card.top}px)` } : undefined} />
            {rects && (
                <div
                    key={`section-glow-${active.section}`}
                    className="pointer-events-none fixed rounded-[18px] border-2 border-orange-500/35 shadow-[0_0_0_1px_rgba(249,115,22,0.25),0_0_35px_rgba(249,115,22,0.2)] animate-in fade-in-0 zoom-in-[0.99] duration-500"
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
                    className="pointer-events-none fixed rounded-lg border-2 border-orange-500 ring-4 ring-orange-400/30 transition-all duration-300 ease-out"
                    style={{
                        left: rects.field.left - 4,
                        top: rects.field.top - 4,
                        width: rects.field.width + 8,
                        height: rects.field.height + 8,
                    }}
                />
            )}
            <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="cost-tour-title" aria-describedby="cost-tour-description" tabIndex={-1}
                className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[101] w-[calc(100vw-2rem)] sm:w-[400px] max-w-[420px] max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-[var(--color-surface)] p-4 sm:p-5 text-[var(--color-ink)] shadow-2xl outline-none">
                <div aria-live="polite" key={`step-${active.section}-${active.field}`} className="animate-in fade-in-0 slide-in-from-right-3 duration-300">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-orange-500/10 px-2.5 py-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 ring-1 ring-inset ring-orange-500/25">
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
