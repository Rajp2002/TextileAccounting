'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TourSampleBanner } from '@/components/tours/TourSampleBanner'
import { useLocalizedPageTitle } from '@/hooks/use-localized-page-title'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { useTranslation } from '@/lib/i18n/context'
import { readBaseProductionNavigation } from '@/lib/base-production-navigation'
import { trackPlanEvent } from '@/lib/plan-analytics'
import { useTourSample } from '@/lib/tours/sample-context'
import BaseAssignmentWorkspace from '../production/BaseAssignmentWorkspace'
import type { BaseAssignmentsInitialData } from './loaders'

export default function BaseAssignmentsClient({ initialData, tourMetadata }: {
    initialData: BaseAssignmentsInitialData
    tourMetadata?: Record<string, unknown>
}) {
    const { tx } = useTranslation()
    const searchParams = useSearchParams()
    const navigation = readBaseProductionNavigation(searchParams)
    const tourSample = useTourSample()
    useLocalizedPageTitle(`${tx('Worker–Machine Assignments')} | Weavly`)
    useEffect(() => {
        if (tourSample) return
        trackPlanEvent('production_viewed', { surface: 'base_production_core' })
    }, [tourSample])

    return (
        <div className="configuration-page-frame space-y-5 pb-8">
            <RouteMilestones route="/owner/assignments" shellVisible primaryUsable secondaryReady />
            <TourSampleBanner />
            {navigation.returnTo && (
                <Button asChild variant="outline" size="sm" className="h-9 rounded-xl border-hairline bg-surface text-ink shadow-xs hover:border-hairline-strong hover:bg-surface-soft hover:text-ink">
                    <Link href={navigation.returnTo} className="inline-flex items-center gap-1.5">
                        <ArrowLeft className="h-4 w-4" />
                        <span>{tx('Back to previous workspace')}</span>
                    </Link>
                </Button>
            )}
            <BaseAssignmentWorkspace
                key={`${initialData.orgId}:${navigation.worker ?? 'all'}:${navigation.machine ?? 'all'}:${navigation.shift ?? 'day'}`}
                initialData={initialData}
                focusWorkerId={searchParams.get('worker') ?? undefined}
                focusMachineId={searchParams.get('machine') ?? undefined}
                initialShift={navigation.shift}
                tourMetadata={tourMetadata}
            />
        </div>
    )
}
