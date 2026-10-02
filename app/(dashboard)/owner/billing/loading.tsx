import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
    return (
        <BaseRouteLoading route="/owner/billing" title="Subscription & Billing">
            <div className="billing-workspace-shell space-y-6">
                <div className="space-y-2.5">
                    <div className="h-3 w-28 ui-skeleton rounded bg-surface-soft" />
                    <div className="h-64 ui-skeleton rounded-2xl border border-hairline bg-surface" />
                </div>
                <div className="space-y-2.5">
                    <div className="h-3 w-40 ui-skeleton rounded bg-surface-soft" />
                    <div className="h-28 ui-skeleton rounded-2xl border border-hairline bg-surface" />
                </div>
                <div className="space-y-2.5">
                    <div className="h-3 w-32 ui-skeleton rounded bg-surface-soft" />
                    <div className="h-20 ui-skeleton rounded-2xl border border-hairline bg-surface" />
                </div>
            </div>

            <aside className="billing-right-rail" aria-hidden="true">
                <div className="billing-rail-top space-y-3">
                    <div className="h-11 ui-skeleton rounded-lg bg-surface-soft" />
                    <div className="h-48 ui-skeleton rounded-xl border border-hairline bg-surface" />
                </div>
                <div className="billing-rail-bottom space-y-3">
                    <div className="h-11 ui-skeleton rounded-xl border border-hairline bg-surface" />
                    <div className="h-11 ui-skeleton rounded-xl border border-hairline bg-surface" />
                </div>
            </aside>
        </BaseRouteLoading>
    )
}
