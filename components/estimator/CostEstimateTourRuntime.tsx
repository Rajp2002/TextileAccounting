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
            page's cards and sheet return to their normal width on every exit. */}
        <style>{`
            @media (min-width: 768px) {
                #mobile-live-estimate-panel {
                    left: 16px !important;
                    right: auto !important;
                    margin-inline: 0 !important;
                    width: min(38rem, calc(100vw - 416px)) !important;
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
