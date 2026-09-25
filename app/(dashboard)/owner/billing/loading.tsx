import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
    return (
        <BaseRouteLoading route="/owner/billing" title="Subscription & Billing">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                {/* Primary Column Skeleton */}
                <div className="space-y-6 lg:col-span-7 xl:col-span-8">
                    <div className="space-y-2.5">
                        <div className="h-3 w-28 animate-pulse rounded bg-surface-soft" />
                        <div className="h-64 animate-pulse rounded-2xl border border-hairline bg-surface" />
                    </div>
                    <div className="space-y-2.5">
                        <div className="h-3 w-40 animate-pulse rounded bg-surface-soft" />
                        <div className="h-28 animate-pulse rounded-2xl border border-hairline bg-surface" />
                    </div>
                    <div className="space-y-2.5">
                        <div className="h-3 w-32 animate-pulse rounded bg-surface-soft" />
                        <div className="h-20 animate-pulse rounded-2xl border border-hairline bg-surface" />
                    </div>
                </div>

                {/* Secondary Column Skeleton */}
                <div className="space-y-4 lg:col-span-5 xl:col-span-4">
                    <div className="space-y-3">
                        <div className="h-20 animate-pulse rounded-2xl border border-hairline bg-surface" />
                        <div className="h-20 animate-pulse rounded-2xl border border-hairline bg-surface" />
                        <div className="h-20 animate-pulse rounded-2xl border border-hairline bg-surface" />
                    </div>
                    <div className="h-12 animate-pulse rounded-xl border border-hairline bg-surface" />
                    <div className="h-12 animate-pulse rounded-2xl border border-hairline bg-surface" />
                </div>
            </div>
        </BaseRouteLoading>
    )
}
