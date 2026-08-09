import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
    return (
        <BaseRouteLoading route="/owner/estimator" title="Cost Estimate">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                    <div className="h-36 animate-pulse rounded-2xl border border-hairline bg-surface" />
                    <div className="h-72 animate-pulse rounded-2xl border border-hairline bg-surface" />
                </div>
                <div className="h-80 animate-pulse rounded-2xl border border-hairline bg-surface" />
            </div>
        </BaseRouteLoading>
    )
}
