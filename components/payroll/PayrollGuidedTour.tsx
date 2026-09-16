'use client'

import { useRef, useState, type ReactNode } from 'react'
import { TourInvitation } from '@/components/tours/TourInvitation'
import PayrollTutorial from '@/components/tours/PayrollTutorial'
import PayrollTourPreview from './PayrollTourPreview'
import { payrollTourSteps, type PayrollTourStep, type PayrollTourVariant } from '@/lib/payroll-tour'

/** Keep the live page mounted so leaving the isolated preview restores all user state. */
export default function PayrollGuidedTour({ variant, userId, orgId, userMetadata, children }: {
    variant: PayrollTourVariant
    userId: string
    orgId: string
    userMetadata?: Record<string, unknown>
    children: ReactNode
}) {
    const [step, setStep] = useState<PayrollTourStep | null>(null)
    const launcher = useRef<HTMLDivElement>(null)
    const returnScroll = useRef({ x: 0, y: 0 })
    return <>
        <div ref={launcher} className="mx-auto mb-5 max-w-6xl">
            <TourInvitation tourId="payroll" userId={userId} orgId={orgId} userMetadata={userMetadata} onLaunch={() => {
                returnScroll.current = { x: window.scrollX, y: window.scrollY }
                setStep(payrollTourSteps(variant)[0])
            }} />
        </div>
        <div hidden={step !== null}>{children}</div>
        {step && <>
            <PayrollTourPreview step={step} variant={variant} />
            <PayrollTutorial step={step} onStepChange={setStep} variant={variant} launcher={launcher} returnScroll={returnScroll} userId={userId} />
        </>}
    </>
}
