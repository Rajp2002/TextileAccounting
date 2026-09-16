'use client'

import { useRef, useState, type ReactNode } from 'react'
import { TourInvitation } from '@/components/tours/TourInvitation'
import StockTutorial from '@/components/tours/StockTutorial'
import StockTourPreview from './StockTourPreview'
import { stockTourSteps, type StockTourStep, type StockTourKind } from '@/lib/stock-tour'

/** Keep the live page mounted so leaving the isolated preview restores all user state. */
export default function StockGuidedTour({ kind, userId, orgId, userMetadata, children }: {
    kind: StockTourKind
    userId: string
    orgId: string
    userMetadata?: Record<string, unknown>
    children: ReactNode
}) {
    const [step, setStep] = useState<StockTourStep | null>(null)
    const launcher = useRef<HTMLDivElement>(null)
    const returnScroll = useRef({ x: 0, y: 0 })
    return <>
        <div ref={launcher} className="mx-auto mb-5 max-w-6xl">
            <TourInvitation tourId={kind} userId={userId} orgId={orgId} userMetadata={userMetadata} onLaunch={() => {
                returnScroll.current = { x: window.scrollX, y: window.scrollY }
                setStep(stockTourSteps(kind)[0])
            }} />
        </div>
        <div hidden={step !== null}>{children}</div>
        {step && <>
            <StockTourPreview kind={kind} step={step} />
            <StockTutorial kind={kind} step={step} onStepChange={setStep} launcher={launcher} returnScroll={returnScroll} userId={userId} />
        </>}
    </>
}
