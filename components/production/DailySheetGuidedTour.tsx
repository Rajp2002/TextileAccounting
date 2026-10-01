'use client'

import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import ReplicaGuidedTour from '@/components/tours/ReplicaGuidedTour'
import { useTranslation } from '@/lib/i18n/context'
import { dailySheetTourSpecs } from '@/lib/daily-sheet-tour'
import { useTourSample } from '@/lib/tours/sample-context'

const DailySheetSampleWorkspace = dynamic(() => import('./DailySheetSampleWorkspace'), { ssr: false })
type CopyModule = typeof import('@/lib/i18n/daily-sheet-tutorial')

export default function DailySheetGuidedTour({ userId, orgId, empty, controls, dialogOpen, children }: {
    userId: string; orgId: string; empty: boolean; controls: ReactNode; dialogOpen: boolean; children: ReactNode
}) {
    const { language, t } = useTranslation()
    const [content, setContent] = useState<CopyModule | null>(null)
    const sample = useTourSample('daily-sheet')
    // The sample is the real sheet shown by the tour, so it draws its own rail and never starts a tour of its own.
    if (sample) return <>
        <aside className="production-daily-sheet-rail min-w-0 !space-y-0 min-[1440px]:!left-auto" aria-label={t('navigation.production_daily_sheet')}>{controls}</aside>
        {children}
    </>
    // The existing rail is inline below 1280px. Keep one guide first inline and
    // last in that same rail on desktop; its live controls keep their mount too.
    return <div className="contents group/daily-tour">
        <ReplicaGuidedTour tourId="daily-sheet" steps={dailySheetTourSpecs(empty)} handoffStepId="ds-handoff"
            workspaceClassName=""
            railClassName={`production-daily-sheet-rail min-w-0 !space-y-0 min-[1440px]:!left-auto group-has-[[data-tour-replica]]/daily-tour:!hidden [&>div:first-child]:min-[1280px]:order-last ${dialogOpen ? '[&>div:first-child]:hidden' : ''}`}
            railLabel={t('navigation.production_daily_sheet')} userId={userId} orgId={orgId}
            prepare={async () => { setContent(await import('@/lib/i18n/daily-sheet-tutorial')) }}
            copy={step => {
                if (!content) throw new Error('Daily Sheet copy must load before launch')
                return content.dailySheetStepCopy(language, step, content.dailySheetTourControlLabels(t), empty)
            }}
            walkthrough={<div className="contents group-has-[[data-tour-replica]]/daily-tour:hidden">{controls}</div>}
            renderReplica={() => <DailySheetSampleWorkspace />}>
            {children}
        </ReplicaGuidedTour>
    </div>
}
