import { BaseRouteLoading } from '@/components/navigation/base-route-loading'

export default function Loading() {
    return (
        <BaseRouteLoading route="/owner/billing" title="Plan & Billing">
            <div className="billing-workspace-shell space-y-6" aria-hidden="true">
                <div className="space-y-2.5">
                    <div className="h-3 w-28 ui-skeleton rounded bg-surface-soft" />
                    <div className="h-56 ui-skeleton rounded-2xl border border-hairline bg-surface" />
                </div>
                <div className="space-y-2.5">
                    <div className="h-3 w-40 ui-skeleton rounded bg-surface-soft" />
                    <div className="h-28 ui-skeleton rounded-2xl border border-hairline bg-surface" />
                </div>
            </div>

        </BaseRouteLoading>
    )
}
