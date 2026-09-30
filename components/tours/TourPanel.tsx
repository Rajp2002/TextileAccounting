'use client'

import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Language } from '@/lib/i18n/context'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { formatTourText } from '@/lib/tours/tour-text'
import type { TourStepStatus } from '@/hooks/use-guided-tour'

function Description({ title, body, detail, extra, titleId, bodyId, language }: {
    title: string; body: string; detail?: string; extra?: ReactNode; titleId: string; bodyId: string; language: Language
}) {
    const [expanded, setExpanded] = useState(false)
    const detailId = useId()
    return <>
        <h2 id={titleId} className="mt-2 text-lg font-semibold leading-snug text-ink">{title}</h2>
        <p id={bodyId} className="mt-2 text-base leading-relaxed text-body">{body}</p>
        {extra}
        {detail && <>
            <button type="button" data-tour-control="more" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpanded(value => !value)} className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4">
                {tourCommonCopy[language].moreDetail}<ChevronDown aria-hidden="true" className={expanded ? 'size-4 rotate-180' : 'size-4'} />
            </button>
            <p id={detailId} hidden={!expanded} className="mt-2 text-sm leading-relaxed text-body">{detail}</p>
        </>}
    </>
}

export function TourPanel({ tourId, stepId, title, body, detail, extra, index, total, sample, status, statusText, isLast, onExit, onBack, onNext, panelRef, style, language = 'en' }: {
    tourId: string; stepId: string; title: string; body: string; detail?: string; extra?: ReactNode
    index: number; total: number; sample: boolean; status: TourStepStatus; statusText?: string; isLast: boolean
    onExit: () => void; onBack: () => void; onNext: () => void
    panelRef: RefObject<HTMLDivElement | null>; style?: CSSProperties; language?: Language
}) {
    const id = useId()
    const copy = tourCommonCopy[language]
    const previous = useRef<{ left: number; top: number } | null>(null)
    useLayoutEffect(() => {
        const panel = panelRef.current
        if (!panel) return
        const { left, top } = panel.getBoundingClientRect()
        const before = previous.current
        previous.current = { left, top }
        if (!before || (before.left === left && before.top === top) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        // Position changes occur only while transparent: the panel never slides over the page.
        const animation = panel.animate([
            { opacity: 1, left: `${before.left}px`, top: `${before.top}px` },
            { opacity: 0, left: `${before.left}px`, top: `${before.top}px`, offset: 0.49 },
            { opacity: 0, left: `${left}px`, top: `${top}px`, offset: 0.5 },
            { opacity: 1, left: `${left}px`, top: `${top}px` },
        ], { duration: 120, easing: 'ease-out' })
        return () => animation.cancel()
    }, [panelRef, style?.left, style?.top])
    return <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-tour-title`} aria-describedby={`${id}-tour-description`} tabIndex={-1}
        data-testid="guided-tour-panel" data-tour-id={tourId} data-tour-step={stepId} data-tour-status={status}
        className="guided-tour-panel fixed z-[101] w-[360px] max-w-[calc(100vw-32px)] max-h-[calc(100dvh-32px)] bg-surface text-ink border border-hairline rounded-2xl shadow-[var(--shadow-card)] p-4 outline-none" style={style}>
        <div data-tour-description-scroll>
            <p data-tour-eyebrow className="text-[12px] font-semibold leading-tight text-subtle">{sample ? `${copy.sample} · ` : ''}{formatTourText(copy.stepOf, {}, { n: index + 1, total })}</p>
            <Description key={stepId} title={title} body={body} detail={detail} extra={extra} titleId={`${id}-tour-title`} bodyId={`${id}-tour-description`} language={language} />
            {statusText && <p role="status" className="mt-3 text-sm text-muted-foreground">{statusText}</p>}
        </div>
        <div className="guided-tour-controls mt-4 flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" data-tour-control="exit" onClick={onExit}>{copy.exit}</Button>
            <div className="ml-auto flex items-center justify-end gap-2">
                {index > 0 && <Button type="button" variant="outline" data-tour-control="back" onClick={onBack}>{copy.back}</Button>}
                <Button type="button" data-tour-control="next" onClick={onNext}>{isLast ? copy.done : copy.next}</Button>
            </div>
        </div>
        <span className="sr-only" aria-live="polite" aria-atomic="true">{status !== 'preparing' ? formatTourText(copy.announce, {}, { n: index + 1, total, title }) : ''}</span>
    </div>
}
