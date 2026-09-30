'use client'

import { useLayoutEffect, type RefObject } from 'react'
import { GuidedTour } from '@/components/tours/GuidedTour'
import { useTranslation } from '@/lib/i18n/context'
import { estimatorControlLabels, estimatorStepCopy } from '@/lib/i18n/cost-estimate-tutorial'
import { estimatorTourSteps, estimatorTourView, type EstimatorTourContext, type EstimatorTourStep } from '@/lib/estimator-tour'

export default function CostEstimateTourRuntime({ step, onStepChange, onDone, onOpenLiveCostModal, freePlan, existingCosting, productionPipeline, userId, launcher, returnFocus }: EstimatorTourContext & {
    step: EstimatorTourStep; onStepChange: (step: EstimatorTourStep | null) => void; onDone: () => void
    onOpenLiveCostModal: (open: boolean) => void; userId: string
    launcher: RefObject<HTMLElement | null>; returnFocus: RefObject<HTMLElement | null>
}) {
    const { language, t, tx } = useTranslation()
    const view = estimatorTourView(step)
    useLayoutEffect(() => { onOpenLiveCostModal(view.liveEstimateOpen) }, [onOpenLiveCostModal, view.liveEstimateOpen])
    const controls = estimatorControlLabels(t, tx, existingCosting)
    return <>
        {/* Reserve the reading column only while this runtime is mounted. The
            page's cards and sheet return to their normal width on every exit.
            On phones the Live cost sheet fits without scrolling, so the shared
            tracker finds no scrollport to lift Save above the docked panel; the
            extra room lets it scroll, and it then replaces this with its own
            measured reserve. On tablets (768-1023px) the fixed 248px sidebar
            leaves a 448px column, too narrow for the 360px panel beside a
            card, so the reading column goes on the left over the sidebar:
            cards start at 404px (248 + 36 gutter + 120) and the sheet joins
            them, 16px to their right so that, moving from the sheet to the
            name field, the outline never starts inside the panel's footprint. */}
        <style>{`
            @media (max-width: 767.98px) {
                #mobile-live-estimate-panel { padding-bottom: 100dvh; }
            }
            @media (min-width: 768px) {
                #mobile-live-estimate-panel {
                    left: 16px !important;
                    right: auto !important;
                    margin-inline: 0 !important;
                    width: min(38rem, calc(100vw - 416px)) !important;
                }
            }
            @media (min-width: 768px) and (max-width: 1023.98px) {
                [data-tour-anchor^="estimator.quick-"] { width: calc(100% - 120px); margin-inline-start: auto; }
                #mobile-live-estimate-panel {
                    left: 420px !important;
                    right: 20px !important;
                    width: auto !important;
                }
            }
            @media (min-width: 1024px) and (max-width: 1279.98px) {
                [data-tour-anchor^="estimator.quick-"] { width: calc(100% - 384px); }
            }
            @media (min-width: 1280px) {
                [data-tour-anchor^="estimator.quick-"] { width: calc(100% - 192px); }
            }
        `}</style>
        <GuidedTour tourId="cost-estimate" steps={estimatorTourSteps} step={step}
        copy={id => estimatorStepCopy(language, id, { freePlan, productionPipeline, controls })}
        onStepChange={onStepChange} onDone={onDone} userId={userId} launcher={launcher} returnFocus={returnFocus} />
    </>
}
