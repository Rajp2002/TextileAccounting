'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { PageTourProvider, type GuideTopic, type PageTour } from './TourInvitation'
import { TourSampleProvider } from '@/lib/tours/sample-context'
import type { GuidedTour as GuidedTourComponent } from './GuidedTour'
import type { TourId, TourStepSpec } from '@/lib/tours/tour-types'

const GuidedTour = dynamic(() => import('./GuidedTour').then(module => module.GuidedTour), { ssr: false }) as typeof GuidedTourComponent

/** EC-21: the live subtree stays in the same position for its entire lifetime.
 * Only its visibility changes; the sample occupies the page's workspace until handoff.
 *
 * The sample must be the REAL page component rendered with sample data, never a hand-built lookalike: a tour
 * that looks different from the page it teaches is worse than no tour. Real components read the step through
 * useTourSample() to open the real dialog or sheet a step is about, and render <TourSampleBanner /> in their own
 * content column. (The prop keeps its historical name.)
 * prepare loads feature copy before launch; the runtime itself is loaded on demand.
 */
export default function ReplicaGuidedTour<S extends string>({
    tourId, workspaceClassName, steps, handoffStepId,
    copy, renderReplica, renderExtra, prepare, topics, userId, orgId, userMetadata, children,
}: {
    tourId: TourId
    workspaceClassName: string
    steps: readonly TourStepSpec<S>[]
    handoffStepId?: S
    copy: (step: S) => { title: string; body: string; detail?: string; unavailable?: string }
    renderReplica: (step: S) => ReactNode
    renderExtra?: (step: S) => ReactNode
    prepare?: () => Promise<void>
    /** Help the wrapper owns (a second walkthrough, an explainer), listed in the page's Guide. */
    topics?: readonly GuideTopic[]
    userId: string
    orgId: string
    userMetadata?: Record<string, unknown>
    children: ReactNode
}) {
    const [step, setStep] = useState<S | null>(null)
    const launcher = useRef<HTMLDivElement>(null)
    const returnFocus = useRef<HTMLElement | null>(null)
    const launching = useRef(false)
    const launchScroll = useRef<{ x: number; y: number } | null>(null)
    // Hiding a tall live page can clamp window scroll before the lazy runtime mounts.
    // Restore the pre-launch position after its own cleanup has restored scrollports.
    useEffect(() => {
        if (step === null && launchScroll.current) {
            window.scrollTo({ left: launchScroll.current.x, top: launchScroll.current.y, behavior: 'instant' })
            launchScroll.current = null
        }
    }, [step])

    // The page header draws the Guide for this tour (PageGuide), so the wrapper hands the tour down
    // instead of rendering a launcher of its own.
    const setLauncher = useCallback((element: HTMLDivElement | null) => { launcher.current = element }, [])
    const tour: PageTour = {
        tourId, userId, orgId, userMetadata, launcher: setLauncher, topics, onLaunch: async () => {
            if (launching.current || step !== null) return
            launching.current = true
            returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            try {
                await prepare?.()
                launchScroll.current = { x: window.scrollX, y: window.scrollY }
                setStep(steps[0].id)
            } finally { launching.current = false }
        },
    }
    return <>
        <PageTourProvider value={tour}>
            <div hidden={step !== null && step !== handoffStepId}>{children}</div>
        </PageTourProvider>
        {step !== null && step !== handoffStepId && <div className={workspaceClassName} data-tour-replica={tourId}>
            <PageTourProvider value={{ tourId, sample: true }}>
                <TourSampleProvider tourId={tourId} step={step}>{renderReplica(step)}</TourSampleProvider>
            </PageTourProvider>
        </div>}
        {step !== null && <GuidedTour tourId={tourId} steps={steps} step={step} copy={copy}
            extra={renderExtra?.(step)} onStepChange={setStep} launcher={launcher} returnFocus={returnFocus} userId={userId} />}
    </>
}
