'use client'

import { useRef, useState, type ReactNode } from 'react'
import { ChevronRight, HelpCircle, ReceiptText } from 'lucide-react'
import { TourInvitation } from '@/components/tours/TourInvitation'
import { railButton, railIcon } from '@/components/ui/rail'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
            <div ref={launcher} className="flex min-h-0 flex-1 flex-col justify-between h-full">
                <TourInvitation
                    tourId="payroll"
                    userId={userId}
                    orgId={orgId}
                    userMetadata={userMetadata}
                    align="full"
                    className="w-full"
                    onLaunch={() => launch('core')}
                />
                <div className="left-rail-bottom mt-auto space-y-2 pt-3">
                    <div data-i18n-skip="true" lang={language}>
                        <button
                            type="button"
                            data-tour-control="payroll-help"
                            aria-describedby="payroll-help-description"
                            onClick={() => launch('help')}
                            className={cn('estimator-touch-target', railButton)}
                        >
                            <span className="flex min-w-0 items-center gap-2.5">
                                <HelpCircle className={railIcon} aria-hidden="true" />
                                <span className="min-w-0">{copy.help}</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </button>
                        <p id="payroll-help-description" className="sr-only">{copy.helpDescription[variant]}</p>
                    </div>
                    <div>
                        <Dialog>
                            <DialogTrigger asChild>
                                <button
                                    type="button"
                                    className={cn('estimator-touch-target', railButton)}
                                >
                                    <span className="flex min-w-0 items-center gap-2.5">
                                        <ReceiptText className={railIcon} aria-hidden="true" />
                                        <span className="min-w-0">How pay is calculated</span>
                                    </span>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                </button>
                            </DialogTrigger>
                        <DialogContent className="sm:max-w-lg rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
                            <DialogHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep shadow-xs border border-saffron/20">
                                        <ReceiptText className="h-5 w-5" aria-hidden="true" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-bold text-ink">
                                            How pay is calculated
                                        </DialogTitle>
                                        <DialogDescription className="text-sm text-body">
                                            Payroll settlement calculation and advance recovery rules
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>
                            <div className="mt-4 space-y-3.5">
                                <div className="rounded-xl border border-hairline/70 bg-surface-soft/60 p-3.5">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-saffron-deep">1. Piece-rate earnings</h4>
                                    <p className="mt-1 text-sm leading-relaxed text-body">
                                        Piece-rate pay uses saved machine rates multiplied by verified metres produced per machine.
                                    </p>
                                </div>
                                <div className="rounded-xl border border-hairline/70 bg-surface-soft/60 p-3.5">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-saffron-deep">2. Fixed salaries</h4>
                                    <p className="mt-1 text-sm leading-relaxed text-body">
                                        Fixed salaries accrue by calendar day, accounting for joining/leaving dates and effective-dated salary adjustments.
                                    </p>
                                </div>
                                <div className="rounded-xl border border-hairline/70 bg-surface-soft/60 p-3.5">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-saffron-deep">3. Advance recovery</h4>
                                    <p className="mt-1 text-sm leading-relaxed text-body">
                                        Recovery is capped at the lower of the outstanding advance balance or 50% of gross pay; any remaining balance carries forward to the next pay cycle.
                                    </p>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
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
