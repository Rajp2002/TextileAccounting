'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TourInvitation } from '@/components/tours/TourInvitation'
import type { EstimatorTourStep } from '@/lib/estimator-tour'

const CostEstimateTourRuntime = dynamic(() => import('./CostEstimateTourRuntime'), { ssr: false })

export function CostEstimateTutorial({ enabled, orgId, userId, userMetadata, accountDismissed, onPrepare, onOpenLiveCostModal, onActiveChange, freePlan = false, existingCosting = false, productionPipeline = false }: {
    accountDismissed: boolean; enabled: boolean; orgId: string; userId: string; userMetadata?: Record<string, unknown> | null
    onPrepare: () => () => void; onOpenLiveCostModal: (open: boolean) => void; onActiveChange: (active: boolean) => void
    freePlan?: boolean; existingCosting?: boolean; productionPipeline?: boolean
}) {
    const [step, setStep] = useState<EstimatorTourStep | null>(null)
    const launcher = useRef<HTMLDivElement>(null)
    const returnFocus = useRef<HTMLElement | null>(null)
    const restoreView = useRef<(() => void) | null>(null)
    const handoffPending = useRef(false)
    const onStepChange = useCallback((next: EstimatorTourStep | null) => {
        if (next === null) {
            restoreView.current?.()
            restoreView.current = null
            onActiveChange(false)
        }
        setStep(next)
    }, [onActiveChange])
    useEffect(() => () => {
        restoreView.current?.()
        restoreView.current = null
    }, [])
    // The Quick input is replaced when restoring Detailed. Resolve the live input
    // after that commit and the shared modal cleanup, never retain its old node.
    useEffect(() => {
        if (step !== null || !handoffPending.current) return
        handoffPending.current = false
        const input = Array.from(document.querySelectorAll<HTMLInputElement>('[data-estimator-field="qualityLabel"]'))
            .find(element => element.getClientRects().length > 0)
        input?.focus({ preventScroll: true })
    }, [step])
    return <>
        <div ref={launcher}>
            {enabled && <TourInvitation tourId="cost-estimate" userId={userId} orgId={orgId}
                userMetadata={{ ...userMetadata, cost_estimate_tutorial_dismissed: accountDismissed }} align="full" className="w-full"
                onLaunch={() => {
                    if (!enabled || restoreView.current) return
                    returnFocus.current = launcher.current?.querySelector<HTMLElement>('[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]') ?? null
                    restoreView.current = onPrepare()
                    onActiveChange(true)
                    setStep('est-purpose')
                }} />}
        </div>
        {step && <CostEstimateTourRuntime step={step} onStepChange={onStepChange} onDone={() => { handoffPending.current = true }}
            onOpenLiveCostModal={onOpenLiveCostModal} freePlan={freePlan} existingCosting={existingCosting} productionPipeline={productionPipeline}
            userId={userId} launcher={launcher} returnFocus={returnFocus} />}
    </>
}
