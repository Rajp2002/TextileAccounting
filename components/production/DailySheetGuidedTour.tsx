'use client'

import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import ReplicaGuidedTour from '@/components/tours/ReplicaGuidedTour'
import { useTranslation } from '@/lib/i18n/context'
import { dailySheetTourSpecs } from '@/lib/daily-sheet-tour'
import { useTourSample } from '@/lib/tours/sample-context'

const DailySheetSampleWorkspace = dynamic(() => import('./DailySheetSampleWorkspace'), { ssr: false })
type CopyModule = typeof import('@/lib/i18n/daily-sheet-tutorial')

export default function DailySheetGuidedTour({ userId, orgId, empty, controls, children }: {
    userId: string; orgId: string; empty: boolean; controls: ReactNode; children: ReactNode
}) {
    const { language, t } = useTranslation()
    const [content, setContent] = useState<CopyModule | null>(null)
    const sample = useTourSample('daily-sheet')
    // The sample is the real sheet shown by the tour, so it draws its own header and never starts a tour of its own.
    if (sample) return <>
        <div className="production-daily-sheet-controls min-w-0 space-y-4" aria-label={t('navigation.production_daily_sheet')}>{controls}</div>
        {children}
    </>
    // The header (with the Guide for this tour) and the shift toolbar are mounted first in the children slot, so they
    // never move: the runtime hides that slot while a sample step shows.
    return <ReplicaGuidedTour tourId="daily-sheet" steps={dailySheetTourSpecs(empty)} handoffStepId="ds-handoff"
        workspaceClassName=""
        userId={userId} orgId={orgId}
        prepare={async () => { setContent(await import('@/lib/i18n/daily-sheet-tutorial')) }}
        copy={step => {
            if (!content) throw new Error('Daily Sheet copy must load before launch')
            return content.dailySheetStepCopy(language, step, content.dailySheetTourControlLabels(t), empty)
        }}
        renderReplica={() => <DailySheetSampleWorkspace />}>
        <div className="production-daily-sheet-controls min-w-0 space-y-4" aria-label={t('navigation.production_daily_sheet')}>{controls}</div>
        {children}
    </ReplicaGuidedTour>
}
