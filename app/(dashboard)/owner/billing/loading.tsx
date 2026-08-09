import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
    return (
        <BaseRouteLoading route="/owner/billing" title="Subscription & Billing">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-4">
                    <div className="h-48 animate-pulse rounded-2xl border border-hairline bg-surface" />
                    <div className="h-72 animate-pulse rounded-2xl border border-hairline bg-surface" />
                </div>
                <div className="h-64 animate-pulse rounded-2xl border border-hairline bg-surface" />
            </div>
        </BaseRouteLoading>
    )
}
