'use client'

import { usePathname } from 'next/navigation'
import { BaseRouteLoading } from '@/components/navigation/base-route-loading'
import { BaseWorkspaceLoading } from '@/components/production/base-workspace-loading'

// The overview's shape: the today band, then the quality list, then loom output.
function ProductionOverviewLoading() {
    return (
        <BaseRouteLoading route="/owner/production" title="Production">
            <div className="space-y-8" aria-hidden="true">
                <div className="h-44 ui-skeleton rounded-2xl border border-hairline bg-surface lg:h-40" />
                <div className="space-y-3">
                    <div className="h-6 w-40 ui-skeleton rounded-lg bg-surface" />
                    <div className="h-48 ui-skeleton rounded-2xl border border-hairline bg-surface" />
                </div>
                <div className="space-y-3">
                    <div className="h-6 w-36 ui-skeleton rounded-lg bg-surface" />
                    <div className="h-56 ui-skeleton rounded-2xl border border-hairline bg-surface" />
                </div>
            </div>
        </BaseRouteLoading>
    )
}

export default function Loading() {
    const pathname = usePathname()
    if (!pathname?.startsWith('/owner/production/daily-sheet')) return <ProductionOverviewLoading />

    return <BaseWorkspaceLoading route="/owner/production/daily-sheet" title="Daily sheet" summaryCards={0} />
}
