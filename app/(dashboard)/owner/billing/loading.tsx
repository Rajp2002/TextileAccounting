import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
    return (
        <BaseRouteLoading route="/owner/billing" title="Subscription & Billing">
            <div className="billing-workspace-shell space-y-6">
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

            <aside className="billing-right-rail" aria-hidden="true">
                <div className="billing-rail-top space-y-3">
                    <div className="h-20 animate-pulse rounded-2xl border border-hairline bg-surface" />
                    <div className="h-20 animate-pulse rounded-2xl border border-hairline bg-surface" />
                    <div className="h-20 animate-pulse rounded-2xl border border-hairline bg-surface" />
                </div>
                <div className="billing-rail-bottom space-y-3">
                    <div className="h-12 animate-pulse rounded-xl border border-hairline bg-surface" />
                    <div className="h-12 animate-pulse rounded-2xl border border-hairline bg-surface" />
                </div>
            </aside>
        </BaseRouteLoading>
    )
}
