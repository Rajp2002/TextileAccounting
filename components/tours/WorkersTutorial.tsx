'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import { workersTutorialCopy } from '@/lib/i18n/workers-tutorial'
import { workersTourSelectors, workersTourPaths, type WorkersTourStep, type WorkersTourPath } from '@/lib/workers-tour'
import { findTourTarget } from '@/lib/tutorial-target'
import { useMobileTour } from '@/hooks/use-mobile-tour'
import { useGuidedTourModal, useGuidedTourPlacement } from '@/hooks/use-guided-tour'
import { persistTourCompleted } from '@/lib/tours/tour-preferences'

export default function WorkersTutorial({ step, path, onPathChange, onStepChange, launcher, userId }: {
    step: WorkersTourStep
    path: WorkersTourPath
    onPathChange: (path: WorkersTourPath) => void
    onStepChange: (step: WorkersTourStep | null) => void
    launcher: RefObject<HTMLDivElement | null>
    userId?: string
}) {
    const { language } = useTranslation()
    const copy = workersTutorialCopy[language]
    const steps: readonly WorkersTourStep[] = workersTourPaths[path]
    const index = steps.indexOf(step)
    const panel = useRef<HTMLDivElement>(null)
    const portal = useRef<HTMLDivElement>(null)
    const resolve = useCallback((current: WorkersTourStep) => {
        const target = findTourTarget(workersTourSelectors[current])
        return { target, card: target }
    }, [])
    const mobile = useMobileTour(step, panel, resolve)
    const close = () => onStepChange(null)
    const next = () => {
        if (index === steps.length - 1) {
            void persistTourCompleted('workers', userId)
            close()
        } else onStepChange(steps[index + 1])
    }
    const back = () => onStepChange(steps[Math.max(0, index - 1)])
    const navigation = useRef({ close, next, back })
    useEffect(() => { navigation.current = { close, next, back } })

    useGuidedTourModal({ panel, portal, navigation, launcher })

    const current = useGuidedTourPlacement({ step, mobile: mobile.mobile, resolve, language, panel, previewSelector: '[data-workers-tour-preview="true"]' })

    const rect = mobile.mobile ? mobile.rects?.field : current?.rect
    return createPortal(
        <div ref={portal} data-testid="workers-tutorial" data-i18n-skip="true" lang={language} className="guided-tour-portal fixed inset-0 z-[100]">
            <div aria-hidden="true" className="guided-tour-backdrop absolute inset-0 bg-black/55 backdrop-blur-xs" style={rect ? { clipPath: `polygon(evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)` } : undefined} />
            {rect && <div aria-hidden="true" className="guided-tour-highlight pointer-events-none fixed rounded-xl border-2 border-saffron ring-4 ring-saffron/30" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />}
            <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="workers-tour-title" aria-describedby="workers-tour-description" tabIndex={-1} className={`guided-tour-panel fixed z-[101] w-[320px] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl border border-[var(--wv-saffron-200)]/90 bg-surface p-4 text-ink shadow-2xl outline-none ${current?.bottom ? 'bottom-4' : 'top-4'} ${current?.left ? 'left-4' : 'right-4'}`}>
                <div data-tour-description-scroll aria-live="polite">
                    <p className="text-[11px] font-bold text-saffron-deep">{copy.sample}</p>
                    <p className="mt-2 text-xs font-semibold text-subtle">{copy.paths[path]}</p>
                    <h2 id="workers-tour-title" className="mt-3 text-lg font-bold">{copy.fields[step][0]}</h2>
                    <p id="workers-tour-description" className="mt-3 text-sm leading-relaxed">{copy.fields[step][1]}</p>
                    {step === 'purpose' && <div className="mt-3 flex flex-col gap-2">
                        {(['piece', 'salary'] as const).map(option => (
                            <Button key={option} size="sm" variant={path === option ? 'default' : 'outline'} aria-pressed={path === option} onClick={() => onPathChange(option)}>{copy.paths[option]}</Button>
                        ))}
                    </div>}
                </div>
                <div role="progressbar" aria-label={copy.progress} aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={steps.length} className="mt-4 h-1.5 rounded-full bg-[var(--wv-saffron-50)]"><div className="h-full rounded-full bg-saffron" style={{ width: `${(index + 1) / steps.length * 100}%` }} /></div>
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
