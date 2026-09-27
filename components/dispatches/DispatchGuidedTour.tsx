'use client'

import { useRef, useState, type ReactNode } from 'react'
import { TourInvitation } from '@/components/tours/TourInvitation'
import DispatchTutorial from '@/components/tours/DispatchTutorial'
import DispatchTourPreview from './DispatchTourPreview'
import { dispatchTourSteps, type DispatchTourStep } from '@/lib/dispatch-tour'

/** Keep the live page mounted so leaving the isolated preview restores all user state. */
export default function DispatchGuidedTour({ userId, orgId, userMetadata, children }: {
    userId: string
    orgId: string
    userMetadata?: Record<string, unknown>
    children: ReactNode
}) {
    const [step, setStep] = useState<DispatchTourStep | null>(null)
    const launcher = useRef<HTMLDivElement>(null)
    const returnScroll = useRef({ x: 0, y: 0 })
    return <>
        <aside className="dispatch-left-rail guided-tour-left-rail space-y-2" aria-label="Dispatch guides and tools">
            <div ref={launcher}>
                <TourInvitation
                    tourId="dispatch"
                    userId={userId}
                    orgId={orgId}
                    userMetadata={userMetadata}
                    align="full"
                    className="w-full"
                    onLaunch={() => {
                        returnScroll.current = { x: window.scrollX, y: window.scrollY }
                        setStep(dispatchTourSteps[0])
                    }}
                />
            </div>
        </aside>
        <div hidden={step !== null}>{children}</div>
        {step && <>
            <DispatchTourPreview step={step} />
            <DispatchTutorial step={step} onStepChange={setStep} launcher={launcher} returnScroll={returnScroll} userId={userId} />
        </>}
    </>
}
