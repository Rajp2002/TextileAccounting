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
            measured reserve. From 768px the Live cost sheet stays centred, where
            it opens outside the tour, and slides left only as far as it must to
            leave the 360px card beside it: left = clamp(16px, centred, viewport
            - sheet - 392px), where 392px is the card plus its 16px gap and
            16px edge margin. With the 14px root size the sheet is 532px wide, so it is centred from 1316px up. On tablets (768-1023px) the column beside the
            sidebar is too narrow for the 360px panel beside a card, so the
            reading column goes on the left over the sidebar: cards start at
            404px (sidebar + 36 gutter + the reservation, 368px - sidebar,
            which is 120px beside the full menu and 296px beside the rail) and the sheet joins
            them, 16px to their right so that, moving from the sheet to the
            name field, the outline never starts inside the panel's footprint. */}
        <style>{`
            @media (max-width: 767.98px) {
                #mobile-live-estimate-panel { padding-bottom: 100dvh; }
            }
            @media (min-width: 768px) {
                #mobile-live-estimate-panel {
                    --tour-sheet-width: min(38rem, calc(100vw - 416px));
                    width: var(--tour-sheet-width) !important;
                    left: clamp(16px, calc((100vw - var(--tour-sheet-width)) / 2), calc(100vw - var(--tour-sheet-width) - 392px)) !important;
                    right: auto !important;
                    margin-inline: 0 !important;
                }
            }
            @media (min-width: 768px) and (max-width: 1023.98px) {
                [data-tour-anchor^="estimator.quick-"] { width: calc(100% - (368px - var(--shell-sidebar-w))); margin-inline-start: auto; }
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
