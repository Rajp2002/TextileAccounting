'use client'

import dynamic from 'next/dynamic'
import { useState, type ReactNode } from 'react'
import ReplicaGuidedTour from '@/components/tours/ReplicaGuidedTour'
import { useTranslation } from '@/lib/i18n/context'
import { dailySheetTourSpecs } from '@/lib/daily-sheet-tour'

const DailySheetTourPreview = dynamic(() => import('./DailySheetTourPreview'), { ssr: false })
type CopyModule = typeof import('@/lib/i18n/daily-sheet-tutorial')

export default function DailySheetGuidedTour({ userId, orgId, empty, controls, dialogOpen, children }: {
    userId: string; orgId: string; empty: boolean; controls: ReactNode; dialogOpen: boolean; children: ReactNode
}) {
    const { language, t } = useTranslation()
    const [content, setContent] = useState<CopyModule | null>(null)
    // The existing rail is inline below 1280px. Keep one guide first inline and
    // last in that same rail on desktop; its live controls keep their mount too.
    return <div className="contents group/daily-tour">
        <ReplicaGuidedTour tourId="daily-sheet" steps={dailySheetTourSpecs(empty)} handoffStepId="ds-handoff"
            workspaceClassName="space-y-4"
            railClassName={`production-daily-sheet-rail min-w-0 !space-y-0 min-[1440px]:!left-auto group-has-[[data-tour-replica]]/daily-tour:!hidden [&>div:first-child]:min-[1280px]:order-last ${dialogOpen ? '[&>div:first-child]:hidden' : ''}`}
            railLabel={t('navigation.production_daily_sheet')} userId={userId} orgId={orgId}
            prepare={async () => { setContent(await import('@/lib/i18n/daily-sheet-tutorial')) }}
            copy={step => {
                if (!content) throw new Error('Daily Sheet copy must load before launch')
                return content.dailySheetStepCopy(language, step, content.dailySheetTourControlLabels(t), empty)
            }}
            walkthrough={<div className="contents group-has-[[data-tour-replica]]/daily-tour:hidden">{controls}</div>}
            renderReplica={step => <DailySheetTourPreview step={step} />}>
            {children}
        </ReplicaGuidedTour>
    </div>
}
