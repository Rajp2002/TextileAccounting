'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { HelpCircle, ReceiptText } from 'lucide-react'
import ReplicaGuidedTour from '@/components/tours/ReplicaGuidedTour'
import { GuideSection, PageTourProvider } from '@/components/tours/TourInvitation'
import type { GuidedTour as GuidedTourComponent } from '@/components/tours/GuidedTour'
import { useTranslation } from '@/lib/i18n/context'
import { payrollStepCopy, payrollTourControlLabels, payrollTutorialCopy } from '@/lib/i18n/payroll-tutorial'
import { payrollHelpSpecs, payrollTourSpecs, type PayrollTourStep, type PayrollTourVariant } from '@/lib/payroll-tour'
import { TourSampleProvider } from '@/lib/tours/sample-context'

const PayrollSampleWorkspace = dynamic(() => import('./PayrollSampleWorkspace'), { ssr: false })
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
    const extraLauncher = useRef<HTMLElement>(null)
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

    return <ReplicaGuidedTour tourId="payroll" steps={payrollTourSpecs} handoffStepId="pr-handoff"
        workspaceClassName=""
        userId={userId} orgId={orgId} userMetadata={userMetadata}
        copy={stepCopy} renderReplica={() => <PayrollSampleWorkspace />}
        topics={[
            {
                id: 'payroll-help', icon: HelpCircle, title: copy.launcher, control: 'payroll-help', lang: language, i18nSkip: true,
                onSelect: () => {
                    extraLauncher.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
                    extraScroll.current = { x: window.scrollX, y: window.scrollY }
                    setExtraStep('pra-advance')
                },
            },
            {
                id: 'payroll-calculation', icon: ReceiptText, title: copy.calculation.title, summary: copy.calculation.description, lang: language, i18nSkip: true,
                content: (['piece', 'salary', 'recovery'] as const).map(section =>
                    <GuideSection key={section} title={copy.calculation[`${section}.title`]}>{copy.calculation[`${section}.body`]}</GuideSection>),
            },
        ]}>
        <div hidden={extraStep !== null && extraStep !== 'pra-handoff'}>{children}</div>
        {extraStep !== null && extraStep !== 'pra-handoff' && <div data-tour-replica="payroll">
            <PageTourProvider value={{ tourId: 'payroll', sample: true }}>
                <TourSampleProvider tourId="payroll" step={extraStep}><PayrollSampleWorkspace /></TourSampleProvider>
            </PageTourProvider>
        </div>}
        {extraStep !== null && <GuidedTour tourId="payroll" steps={payrollHelpSpecs} step={extraStep}
            copy={stepCopy} onStepChange={setExtraStep} launcher={extraLauncher}
            recordCompletion={false} userId={userId} />}
    </ReplicaGuidedTour>
}
