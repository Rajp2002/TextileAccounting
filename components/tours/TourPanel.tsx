'use client'
import { useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Language } from '@/lib/i18n/context'
import { tourCommonCopy } from '@/lib/i18n/tour-common'

export function TourPanel({ tourId, stepId, title, body, detail, extra, index, total, sample, status, statusText, isLast, onExit, onBack, onNext, panelRef, style, language = 'en' }: {
  tourId: string; stepId: string; title: string; body: string; detail?: string; extra?: ReactNode; index: number; total: number; sample: boolean; status: 'preparing' | 'ready' | 'unavailable'; statusText?: string; isLast: boolean; onExit: () => void; onBack: () => void; onNext: () => void; panelRef: RefObject<HTMLDivElement | null>; style?: CSSProperties; language?: Language
}) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null); const expanded = expandedStep === stepId; const copy = tourCommonCopy[language]
  const titleId = `${tourId}-${stepId}-title`; const bodyId = `${tourId}-${stepId}-body`; const detailId = `${tourId}-${stepId}-detail`
  const step = copy.stepOf.replace('{n}', String(index + 1)).replace('{total}', String(total))
  return <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} tabIndex={-1} data-testid="guided-tour-panel" data-tour-id={tourId} data-tour-step={stepId} data-tour-status={status} style={style} className="guided-tour-panel fixed z-[101] w-[360px] max-w-[calc(100vw-32px)] rounded-2xl border border-hairline bg-surface p-4 text-ink shadow-[var(--shadow-card)]">
    <p className="text-[12px] font-semibold leading-tight text-subtle">{sample ? `${copy.sample} · ` : ''}{step}</p>
    <h2 id={titleId} className="mt-2 text-lg font-semibold leading-snug text-ink">{title}</h2>
    <div data-tour-description-scroll className="overflow-y-auto"><p id={bodyId} className="mt-2 text-base leading-relaxed text-body">{body}</p>{extra}
      {detail && <><button type="button" aria-expanded={expanded} aria-controls={detailId} data-tour-control="more" onClick={() => setExpandedStep(expanded ? null : stepId)} className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4">{copy.moreDetail}<ChevronDown className={expanded ? 'rotate-180' : ''} /></button>{expanded && <p id={detailId} className="mt-2 text-sm leading-relaxed text-body">{detail}</p>}</>}
    </div>
    {statusText && <p role="status" className="mt-3 text-sm text-muted-foreground">{statusText}</p>}
    <div className="guided-tour-controls mt-4 flex flex-wrap items-center justify-between gap-2"><Button variant="ghost" data-tour-control="exit" onClick={onExit}>{copy.exit}</Button><div className="ml-auto flex gap-2">{index > 0 && <Button variant="outline" data-tour-control="back" onClick={onBack}>{copy.back}</Button>}<Button data-tour-control="next" onClick={onNext}>{isLast ? copy.done : copy.next}</Button></div></div>
  </div>
}
