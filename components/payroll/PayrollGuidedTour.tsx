'use client'

import { useRef, useState, type ReactNode } from 'react'
import { TourInvitation } from '@/components/tours/TourInvitation'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import { payrollTutorialCopy } from '@/lib/i18n/payroll-tutorial'
import PayrollTutorial from '@/components/tours/PayrollTutorial'
import PayrollTourPreview from './PayrollTourPreview'
import { payrollTourSteps, type PayrollTourStep, type PayrollTourVariant, type PayrollTourTrack } from '@/lib/payroll-tour'

/** Keep the live page mounted so leaving the isolated preview restores all user state. */
export default function PayrollGuidedTour({ variant, userId, orgId, userMetadata, children }: {
    variant: PayrollTourVariant
    userId: string
    orgId: string
    userMetadata?: Record<string, unknown>
    children: ReactNode
}) {
    const [step, setStep] = useState<PayrollTourStep | null>(null)
    const [track, setTrack] = useState<PayrollTourTrack>('core')
    const { language } = useTranslation()
    const copy = payrollTutorialCopy[language]
    const launcher = useRef<HTMLDivElement>(null)
    const returnFocus = useRef<HTMLElement | null>(null)
    const returnScroll = useRef({ x: 0, y: 0 })
    const launch = (nextTrack: PayrollTourTrack) => {
        returnFocus.current = launcher.current?.querySelector<HTMLElement>(nextTrack === 'help' ? '[data-tour-control="payroll-help"]' : '[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]') ?? null
        returnScroll.current = { x: window.scrollX, y: window.scrollY }
        setTrack(nextTrack)
        setStep(payrollTourSteps(variant, nextTrack)[0])
    }
    return <>
        <aside className="payroll-left-rail guided-tour-left-rail space-y-2" aria-label="Payroll guides and tools">
            <div ref={launcher}>
                <TourInvitation
                    tourId="payroll"
                    userId={userId}
                    orgId={orgId}
                    userMetadata={userMetadata}
                    align="full"
                    className="w-full estimator-touch-target border-saffron-soft/90 bg-saffron-soft/75 text-saffron-deep shadow-xs hover:bg-saffron-soft"
                    onLaunch={() => launch('core')}
                />
                <div data-i18n-skip="true" lang={language} className="mt-2 space-y-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto min-h-9 w-full justify-start text-xs font-semibold text-subtle hover:text-ink"
                        data-tour-control="payroll-help"
                        onClick={() => launch('help')}
                    >
                        {copy.help}
                    </Button>
                    <p className="text-xs text-subtle px-1">{copy.helpDescription[variant]}</p>
                </div>
            </div>
        </aside>
        <div hidden={step !== null}>{children}</div>
        {step && <>
            <PayrollTourPreview step={step} variant={variant} />
            <PayrollTutorial step={step} onStepChange={setStep} variant={variant} track={track} launcher={launcher} returnFocus={returnFocus} returnScroll={returnScroll} userId={userId} />
        </>}
    </>
}
