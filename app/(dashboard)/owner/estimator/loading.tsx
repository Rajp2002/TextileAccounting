'use client'

import { BaseRouteLoading } from '@/components/navigation/base-route-loading'
import { useOwnerPlan } from '@/components/providers/owner-plan-provider'

export default function Loading() {
    return (
        // Lite phones show the estimator's compact title; keep the skeleton's in the same place.
        <BaseRouteLoading route="/owner/estimator" title="Cost Estimate" headerClassName={useOwnerPlan() === 'lite' ? 'lite-mobile-page-header' : undefined}>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                    <div className="h-36 ui-skeleton rounded-2xl border border-hairline bg-surface" />
                    <div className="h-72 ui-skeleton rounded-2xl border border-hairline bg-surface" />
                </div>
                <div className="h-80 ui-skeleton rounded-2xl border border-hairline bg-surface" />
            </div>
        </BaseRouteLoading>
    )
}
