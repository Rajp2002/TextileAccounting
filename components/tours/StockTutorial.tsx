'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import { stockTutorialCopy, fabricStockTutorialHelp } from '@/lib/i18n/stock-tutorial'
import { stockTourSelector, stockTourSteps, stockTourSection, type StockTourStep, type StockTourKind } from '@/lib/stock-tour'
import { findTourTarget } from '@/lib/tutorial-target'
import { lockTourViewport } from '@/lib/tutorial-viewport-lock'
import { useMobileTour } from '@/hooks/use-mobile-tour'
import { persistTourCompleted } from '@/lib/tours/tour-preferences'

/** Keyed by step so optional detail closes when the user advances or goes back. */
function FabricStockHelp({ help }: { help: readonly [string, string] }) {
    const [expanded, setExpanded] = useState(false)
    return <div className="mt-3 border-t border-hairline pt-3">
        <button type="button" className="text-left text-sm font-semibold text-saffron-deep underline" aria-expanded={expanded} aria-controls="fabric-stock-tour-help" onClick={() => setExpanded(value => !value)}>{help[0]}</button>
        {expanded && <p id="fabric-stock-tour-help" className="mt-2 text-sm leading-relaxed">{help[1]}</p>}
    </div>
}

export default function StockTutorial({ step, onStepChange, launcher, userId, kind, returnScroll }: {
    kind: StockTourKind
    step: StockTourStep
    onStepChange: (step: StockTourStep | null) => void
    launcher: RefObject<HTMLDivElement | null>
    userId?: string
    returnScroll: RefObject<{ x: number; y: number }>
}) {
    const { language } = useTranslation()
    const copy = stockTutorialCopy[kind][language]
    const help = kind === 'fabric-stock' ? fabricStockTutorialHelp[language][step] : undefined
    const steps = stockTourSteps(kind)
    const sections = [...new Set(steps.map(step => stockTourSection(step, kind)))]
    const index = steps.indexOf(step)
    const panel = useRef<HTMLDivElement>(null)
    const portal = useRef<HTMLDivElement>(null)
    const resolve = useCallback((current: StockTourStep) => {
        const target = findTourTarget(stockTourSelector(current))
        return { target, card: target }
    }, [])
    const mobile = useMobileTour(step, panel, resolve)
    const [measurement, setMeasurement] = useState<{ step: StockTourStep; rect: DOMRect; bottom: boolean; left: boolean } | null>(null)
    const close = () => onStepChange(null)
    const next = () => {
        if (index === steps.length - 1) {
            void persistTourCompleted(kind, userId)
            close()
        } else onStepChange(steps[index + 1])
    }
    const back = () => onStepChange(steps[Math.max(0, index - 1)])
    const navigation = useRef({ close, next, back })
    useEffect(() => { navigation.current = { close, next, back } })

    useEffect(() => {
        if (!panel.current) return
        const trigger = launcher.current?.querySelector<HTMLButtonElement>('[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]')
        const scroll = returnScroll.current
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
            trigger?.focus({ preventScroll: true })
        }
    }, [launcher, returnScroll])

    useEffect(() => {
        if (mobile.mobile) return
        let frame = 0
        let positioned: HTMLElement | null = null
        const start = performance.now()
        const measure = () => {
            const { target } = resolve(step)
            if (target && panel.current) {
                if (target !== positioned) { target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); positioned = target }
                const rect = target.getBoundingClientRect()
                const bounds = panel.current.getBoundingClientRect()
                const inPreview = Boolean(target.closest('[data-stock-tour-preview="true"]'))
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
    }, [step, mobile.mobile, resolve, language])

    const current = measurement?.step === step ? measurement : null
    const rect = mobile.mobile ? mobile.rects?.field : current?.rect
    return createPortal(
        <div ref={portal} data-testid="stock-tutorial" data-i18n-skip="true" lang={language} className="fixed inset-0 z-[100]">
            <div aria-hidden="true" className="guided-tour-backdrop absolute inset-0 bg-black/55 backdrop-blur-xs" style={rect ? { clipPath: `polygon(evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)` } : undefined} />
            {rect && <div aria-hidden="true" className="guided-tour-highlight pointer-events-none fixed rounded-xl border-2 border-saffron ring-4 ring-saffron/30" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />}
            <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="stock-tour-title" aria-describedby="stock-tour-description" tabIndex={-1} className={`guided-tour-panel fixed z-[101] w-[320px] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl border border-amber-200/90 bg-surface p-4 text-ink shadow-2xl outline-none ${current?.bottom ? 'bottom-4' : 'top-4'} ${current?.left ? 'left-4' : 'right-4'}`}>
                <div data-tour-description-scroll aria-live="polite">
                    <p className="text-[11px] font-bold text-saffron-deep">{copy.sample}</p>
                    <p className="mt-2 text-xs font-semibold text-subtle">{sections.indexOf(stockTourSection(step, kind)) + 1}/{sections.length} · {copy.sections[stockTourSection(step, kind)]}</p>
                    <h2 id="stock-tour-title" className="mt-3 text-lg font-bold">{copy.fields[step]![0]}</h2>
                    <p id="stock-tour-description" className="mt-3 text-sm leading-relaxed">{copy.fields[step]![1]}</p>
                    {help && <FabricStockHelp key={step} help={help} />}
                </div>
                <div role="progressbar" aria-label={copy.progress} aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={steps.length} className="mt-4 h-1.5 rounded-full bg-amber-100"><div className="h-full rounded-full bg-saffron" style={{ width: `${(index + 1) / steps.length * 100}%` }} /></div>
                <div className="guided-tour-controls mt-3 flex items-center justify-between gap-1">
                    <Button variant="ghost" size="sm" data-tour-control="skip" onClick={close}>{copy.skip}</Button>
                    <span className="text-xs tabular-nums">{index + 1}/{steps.length}</span>
                    <Button variant="outline" size="sm" data-tour-control="back" disabled={index === 0} onClick={back}>{copy.back}</Button>
                    <Button size="sm" data-tour-control="next" onClick={next}>{index === steps.length - 1 ? copy.finish : copy.next}</Button>
                </div>
            </div>
        </div>, document.body,
    )
}
