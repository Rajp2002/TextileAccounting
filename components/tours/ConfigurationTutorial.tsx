'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import { configurationTutorialCopy } from '@/lib/i18n/configuration-tutorial'
import { configurationTourSelectors, configurationTourSteps, configurationTourSection, type ConfigurationTourStep } from '@/lib/configuration-tour'
import { findTourTarget } from '@/lib/tutorial-target'
import { useMobileTour } from '@/hooks/use-mobile-tour'
import { useGuidedTourModal, useGuidedTourPlacement } from '@/hooks/use-guided-tour'
import { persistTourCompleted } from '@/lib/tours/tour-preferences'

export default function ConfigurationTutorial({ step, onStepChange, launcher, userId, returnScroll }: {
    step: ConfigurationTourStep
    onStepChange: (step: ConfigurationTourStep | null) => void
    launcher: RefObject<HTMLDivElement | null>
    userId?: string
    returnScroll?: RefObject<{ x: number; y: number }>
}) {
    const { language } = useTranslation()
    const copy = configurationTutorialCopy[language]
    const index = configurationTourSteps.indexOf(step)
    const panel = useRef<HTMLDivElement>(null)
    const portal = useRef<HTMLDivElement>(null)
    const resolve = useCallback((current: ConfigurationTourStep) => {
        const target = findTourTarget(configurationTourSelectors[current])
        return { target, card: target }
    }, [])
    const mobile = useMobileTour(step, panel, resolve)
    const close = () => onStepChange(null)
    const next = () => {
        if (index === configurationTourSteps.length - 1) {
            void persistTourCompleted('configuration', userId)
            close()
        } else onStepChange(configurationTourSteps[index + 1])
    }
    const back = () => onStepChange(configurationTourSteps[Math.max(0, index - 1)])
    const navigation = useRef({ close, next, back })
    useEffect(() => { navigation.current = { close, next, back } })

    useGuidedTourModal({ panel, portal, navigation, launcher, returnScroll })

    const current = useGuidedTourPlacement({ step, mobile: mobile.mobile, resolve, language, panel, previewSelector: '[data-configuration-tour-preview="true"], [data-configuration-picker-preview="true"]' })

    const stepCopy = copy.fields[step]
    const rect = mobile.mobile ? mobile.rects?.field : current?.rect
    return createPortal(
        <div ref={portal} data-testid="configuration-tutorial" data-i18n-skip="true" lang={language} className="guided-tour-portal fixed inset-0 z-[100]">
            <div aria-hidden="true" className="guided-tour-backdrop absolute inset-0 bg-black/55 backdrop-blur-xs" style={rect ? { clipPath: `polygon(evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)` } : undefined} />
            {rect && <div aria-hidden="true" className="guided-tour-highlight pointer-events-none fixed rounded-xl border-2 border-saffron ring-4 ring-saffron/30" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />}
            <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="configuration-tour-title" aria-describedby="configuration-tour-description" tabIndex={-1} className={`guided-tour-panel fixed z-[101] w-[320px] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] rounded-2xl border border-[var(--wv-saffron-200)]/90 bg-surface p-4 text-ink shadow-2xl outline-none ${current?.bottom ? 'bottom-4' : 'top-4'} ${current?.left ? 'left-4' : 'right-4'}`}>
                <div data-tour-description-scroll aria-live="polite">
                    <p className="text-[11px] font-bold text-saffron-deep">{copy.sample}</p>
                    <p className="mt-2 text-xs font-semibold text-subtle">{configurationTourSection(step) + 1}/{copy.sections.length} · {copy.sections[configurationTourSection(step)]}</p>
                    <h2 id="configuration-tour-title" className="mt-3 text-lg font-bold">{stepCopy[0]}</h2>
                    <p id="configuration-tour-description" className="mt-3 text-sm leading-relaxed">{stepCopy[1]}</p>
                </div>
                <div role="progressbar" aria-label={copy.progress} aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={configurationTourSteps.length} className="mt-4 h-1.5 rounded-full bg-[var(--wv-saffron-50)]"><div className="h-full rounded-full bg-saffron" style={{ width: `${(index + 1) / configurationTourSteps.length * 100}%` }} /></div>
                <div className="guided-tour-controls mt-3 flex items-center justify-between gap-1">
                    <Button variant="ghost" size="sm" data-tour-control="skip" onClick={close}>{copy.skip}</Button>
                    <span className="text-xs tabular-nums">{index + 1}/{configurationTourSteps.length}</span>
                    <Button variant="outline" size="sm" data-tour-control="back" disabled={index === 0} onClick={back}>{copy.back}</Button>
                    <Button size="sm" data-tour-control="next" onClick={next}>{index === configurationTourSteps.length - 1 ? copy.finish : copy.next}</Button>
                </div>
            </div>
        </div>, document.body,
    )
}
