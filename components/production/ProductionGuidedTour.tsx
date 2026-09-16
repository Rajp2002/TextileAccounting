'use client'

import { useRef, useState, type ReactNode } from 'react'
import { TourInvitation } from '@/components/tours/TourInvitation'
import ProductionTutorial from '@/components/tours/ProductionTutorial'
import ProductionTourPreview from './ProductionTourPreview'
import { productionTourSteps, type ProductionTourStep } from '@/lib/production-tour'

/** Keep the live page mounted so leaving the isolated preview restores all user state. */
export default function ProductionGuidedTour({ userId, orgId, userMetadata, children }: {
    userId: string
    orgId: string
    userMetadata?: Record<string, unknown>
    children: ReactNode
}) {
    const [step, setStep] = useState<ProductionTourStep | null>(null)
    const launcher = useRef<HTMLDivElement>(null)
    const returnScroll = useRef({ x: 0, y: 0 })
    return <>
        <div ref={launcher} className="mx-auto mb-5 max-w-6xl">
            <TourInvitation tourId="production" userId={userId} orgId={orgId} userMetadata={userMetadata} onLaunch={() => {
                returnScroll.current = { x: window.scrollX, y: window.scrollY }
                setStep(productionTourSteps[0])
            }} />
        </div>
        <div hidden={step !== null}>{children}</div>
        {step && <>
            <ProductionTourPreview step={step} />
            <ProductionTutorial step={step} onStepChange={setStep} launcher={launcher} returnScroll={returnScroll} userId={userId} />
        </>}
    </>
}
