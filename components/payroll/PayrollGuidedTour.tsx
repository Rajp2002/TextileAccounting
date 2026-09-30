'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight, HelpCircle, ReceiptText } from 'lucide-react'
import ReplicaGuidedTour from '@/components/tours/ReplicaGuidedTour'
import type { GuidedTour as GuidedTourComponent } from '@/components/tours/GuidedTour'
import { railButton, railIcon } from '@/components/ui/rail'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useTranslation } from '@/lib/i18n/context'
import { payrollStepCopy, payrollTourControlLabels, payrollTutorialCopy } from '@/lib/i18n/payroll-tutorial'
import { payrollHelpSpecs, payrollTourSpecs, type PayrollTourStep, type PayrollTourVariant } from '@/lib/payroll-tour'

const PayrollTourPreview = dynamic(() => import('./PayrollTourPreview'), { ssr: false })
const GuidedTour = dynamic(() => import('@/components/tours/GuidedTour').then(module => module.GuidedTour), { ssr: false }) as typeof GuidedTourComponent

/** The optional walkthrough uses the shared runtime without writing tour preferences. */
export default function PayrollGuidedTour({ userId, orgId, userMetadata, children }: {
    variant: PayrollTourVariant
    userId: string
    orgId: string
    userMetadata?: Record<string, unknown>
    children: ReactNode
}) {
    const { language, t } = useTranslation()
    const copy = payrollTutorialCopy[language]
    const [extraStep, setExtraStep] = useState<PayrollTourStep | null>(null)
    const extraLauncher = useRef<HTMLButtonElement>(null)
    const extraScroll = useRef<{ x: number; y: number } | null>(null)
    useEffect(() => {
        if (extraStep === null && extraScroll.current) {
            window.scrollTo({ left: extraScroll.current.x, top: extraScroll.current.y, behavior: 'instant' })
            extraScroll.current = null
        }
    }, [extraStep])
    // Read the live label even while its subtree is hidden. The same anchor covers
    // open, in-progress, ready-to-complete and settled periods without changing state.
    const controls = () => payrollTourControlLabels(t,
        document.querySelector<HTMLElement>('[data-tour-anchor="payroll.settle"]')?.textContent?.trim())
    const stepCopy = (step: PayrollTourStep) => payrollStepCopy(language, step, controls())
    const preview = (step: PayrollTourStep) => <PayrollTourPreview step={step} settlementLabel={controls().settlePayroll} />

    return <ReplicaGuidedTour tourId="payroll" steps={payrollTourSpecs} handoffStepId="pr-handoff"
        workspaceClassName="payroll-workspace-shell space-y-5 pb-10"
        railClassName="payroll-left-rail" railLabel={t('navigation.payroll')}
        userId={userId} orgId={orgId} userMetadata={userMetadata}
        copy={stepCopy} renderReplica={preview}
        walkthrough={<div className="left-rail-bottom mt-auto space-y-2 pt-3" data-i18n-skip="true" lang={language}>
            <button ref={extraLauncher} type="button" data-tour-control="payroll-help"
                onClick={() => {
                    extraScroll.current = { x: window.scrollX, y: window.scrollY }
                    setExtraStep('pra-advance')
                }} className={cn('estimator-touch-target', railButton)}>
                <span className="flex min-w-0 items-center gap-2.5"><HelpCircle className={railIcon} aria-hidden="true" /><span>{copy.launcher}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>
            <Dialog>
                <DialogTrigger asChild><button type="button" className={cn('estimator-touch-target', railButton)}>
                    <span className="flex min-w-0 items-center gap-2.5"><ReceiptText className={railIcon} aria-hidden="true" /><span>{copy.calculation.title}</span></span>
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button></DialogTrigger>
                <DialogContent data-i18n-skip="true" lang={language} className="sm:max-w-lg rounded-2xl border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
                    <DialogHeader><DialogTitle>{copy.calculation.title}</DialogTitle><DialogDescription>{copy.calculation.description}</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                        {(['piece', 'salary', 'recovery'] as const).map(section => <section key={section}>
                            <h3 className="text-sm font-semibold text-ink">{copy.calculation[`${section}.title`]}</h3>
                            <p className="mt-1 text-sm leading-relaxed text-body">{copy.calculation[`${section}.body`]}</p>
                        </section>)}
                    </div>
                </DialogContent>
            </Dialog>
        </div>}>
        <div hidden={extraStep !== null && extraStep !== 'pra-handoff'}>{children}</div>
        {extraStep !== null && extraStep !== 'pra-handoff' && <div className="payroll-workspace-shell space-y-5 pb-10" data-tour-replica="payroll">{preview(extraStep)}</div>}
        {extraStep !== null && <GuidedTour tourId="payroll" steps={payrollHelpSpecs} step={extraStep}
            copy={stepCopy} onStepChange={setExtraStep} launcher={extraLauncher}
            recordCompletion={false} userId={userId} />}
    </ReplicaGuidedTour>
}
